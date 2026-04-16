import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';

@Injectable()
export class ApprovalEngineService {
  constructor(private readonly prisma: PrismaService) {}

  async shouldApprove(
    companyId: string,
    module: string,
    documentType: string,
    valor?: number,
  ): Promise<boolean> {
    const policy = await this.prisma.approvalPolicy.findUnique({
      where: {
        companyId_module_documentType: {
          companyId,
          module: module as any,
          documentType: documentType as any,
        },
      },
    });

    if (!policy || !policy.enabled) return false;

    if (policy.triggerType === 'SEMPRE') return true;

    if (policy.triggerType === 'VALOR_ACIMA' || policy.triggerType === 'PERCENTUAL_ACIMA') {
      if (valor == null || policy.triggerValue == null) return false;
      return valor > Number(policy.triggerValue);
    }

    return false;
  }

  async createRequest(
    companyId: string,
    module: string,
    documentType: string,
    documentId: string,
    solicitanteId: string,
    valor?: number,
  ) {
    const needed = await this.shouldApprove(companyId, module, documentType, valor);
    if (!needed) return null;

    const policy = await this.prisma.approvalPolicy.findUnique({
      where: {
        companyId_module_documentType: {
          companyId,
          module: module as any,
          documentType: documentType as any,
        },
      },
      include: { levels: true },
    });

    if (!policy) return null;

    const totalNiveis = policy.levels.length;

    return this.prisma.approvalRequest.create({
      data: {
        companyId,
        policyId: policy.id,
        module: module as any,
        documentType: documentType as any,
        documentId,
        solicitanteId,
        valorDocumento: valor != null ? valor : null,
        nivelAtual: 1,
        totalNiveis,
        status: 'PENDENTE',
      },
    });
  }

  async getMyPendingApprovals(userId: string, companyId: string) {
    // Get user's roles
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      select: { roleId: true },
    });
    const roleIds = userRoles.map((ur) => ur.roleId);

    // Find PENDENTE requests where the current level matches one of user's roles
    const requests = await this.prisma.approvalRequest.findMany({
      where: {
        companyId,
        status: 'PENDENTE',
        policy: {
          levels: {
            some: {
              roleId: { in: roleIds },
            },
          },
        },
      },
      include: {
        policy: {
          include: {
            levels: {
              include: { role: true },
              orderBy: { ordem: 'asc' },
            },
          },
        },
        solicitante: {
          select: { id: true, name: true, email: true },
        },
        actions: {
          orderBy: { atuadoEm: 'desc' },
        },
      },
      orderBy: { criadoEm: 'desc' },
    });

    // Filter to those where the nivelAtual level matches one of user's roles
    return requests.filter((req) => {
      const currentLevel = req.policy.levels.find((l) => l.ordem === req.nivelAtual);
      return currentLevel && roleIds.includes(currentLevel.roleId);
    });
  }

  async approve(
    requestId: string,
    userId: string,
    roleId: string,
    comentario?: string,
  ): Promise<{ status: string; advanced: boolean }> {
    const request = await this.prisma.approvalRequest.findUniqueOrThrow({
      where: { id: requestId },
    });

    // Log the action
    await this.prisma.approvalAction.create({
      data: {
        approvalRequestId: requestId,
        nivelOrdem: request.nivelAtual,
        userId,
        roleId,
        acao: 'APROVADO',
        comentario: comentario ?? null,
      },
    });

    if (request.nivelAtual < request.totalNiveis) {
      // Advance to next level
      await this.prisma.approvalRequest.update({
        where: { id: requestId },
        data: { nivelAtual: request.nivelAtual + 1 },
      });
      return { status: 'PENDENTE', advanced: true };
    } else {
      // Final approval
      await this.prisma.approvalRequest.update({
        where: { id: requestId },
        data: { status: 'APROVADO', resolvidoEm: new Date() },
      });
      // Advance the underlying document
      await this.onApproved(requestId);
      return { status: 'APROVADO', advanced: false };
    }
  }

  async reject(
    requestId: string,
    userId: string,
    roleId: string,
    comentario: string,
  ): Promise<void> {
    const request = await this.prisma.approvalRequest.findUniqueOrThrow({
      where: { id: requestId },
    });

    await this.prisma.approvalAction.create({
      data: {
        approvalRequestId: requestId,
        nivelOrdem: request.nivelAtual,
        userId,
        roleId,
        acao: 'REJEITADO',
        comentario,
      },
    });

    await this.prisma.approvalRequest.update({
      where: { id: requestId },
      data: { status: 'REJEITADO', resolvidoEm: new Date() },
    });
    // Return underlying document to RASCUNHO
    await this.onRejected(requestId);
  }

  async getRequestStatus(documentId: string, companyId: string) {
    return this.prisma.approvalRequest.findFirst({
      where: { documentId, companyId },
      orderBy: { criadoEm: 'desc' },
      include: {
        policy: true,
        actions: {
          include: { user: { select: { id: true, name: true } }, role: true },
          orderBy: { atuadoEm: 'asc' },
        },
      },
    });
  }

  /**
   * Called when an ApprovalRequest reaches final APROVADO.
   * Advances the underlying document to its post-approval status.
   */
  async onApproved(requestId: string): Promise<void> {
    const request = await this.prisma.approvalRequest.findUnique({
      where: { id: requestId },
    });
    if (!request) return;

    switch (request.documentType) {
      case 'SOLICITACAO_COMPRA':
        await this.prisma.purchaseRequest.updateMany({
          where: { id: request.documentId, status: 'AGUARDANDO_APROVACAO' as any },
          data: { status: 'APROVADA' as any, dataAprovacao: new Date() },
        });
        break;
      case 'ORDEM_COMPRA':
        await this.prisma.purchaseOrder.updateMany({
          where: { id: request.documentId, status: 'AGUARDANDO_APROVACAO' as any },
          data: { status: 'ENVIADA' as any },
        });
        break;
      case 'PEDIDO_VENDA':
        await this.prisma.saleOrder.updateMany({
          where: { id: request.documentId, status: 'PENDENTE_APROVACAO' as any },
          data: { status: 'APROVADO' as any, dataAprovacao: new Date() },
        });
        break;
      case 'PAGAMENTO':
        // Unlock for payment — return to PENDENTE so user can pay
        await this.prisma.financialMovement.updateMany({
          where: { id: request.documentId, status: 'AGUARDANDO_APROVACAO' as any },
          data: { status: 'PENDENTE' as any },
        });
        break;
      case 'FOLHA_PAGAMENTO':
        await this.prisma.payroll.updateMany({
          where: { id: request.documentId, status: 'AGUARDANDO_APROVACAO' as any },
          data: { status: 'APROVADA' as any },
        });
        break;
      case 'REQUISICAO':
        // Auto-approve all items at requested quantities then approve
        const reqDoc = await this.prisma.requisition.findUnique({
          where: { id: request.documentId },
          include: { items: true },
        });
        if (reqDoc && reqDoc.status === ('AGUARDANDO_APROVACAO' as any)) {
          await this.prisma.$transaction([
            ...reqDoc.items.map((item: any) =>
              this.prisma.requisitionItem.update({
                where: { id: item.id },
                data: { quantityApproved: item.quantityRequested },
              }),
            ),
            this.prisma.requisition.update({
              where: { id: request.documentId },
              data: {
                status: 'APROVADA' as any,
                aprovadorId: request.solicitanteId,
              },
            }),
          ]);
        }
        break;
      default:
        break;
    }
  }

  /**
   * Called when an ApprovalRequest is REJEITADO.
   * Returns the document to RASCUNHO so the requester can edit and resubmit.
   */
  async onRejected(requestId: string): Promise<void> {
    const request = await this.prisma.approvalRequest.findUnique({
      where: { id: requestId },
    });
    if (!request) return;

    switch (request.documentType) {
      case 'SOLICITACAO_COMPRA':
        await this.prisma.purchaseRequest.updateMany({
          where: { id: request.documentId },
          data: { status: 'RASCUNHO' as any },
        });
        break;
      case 'ORDEM_COMPRA':
        await this.prisma.purchaseOrder.updateMany({
          where: { id: request.documentId },
          data: { status: 'RASCUNHO' as any },
        });
        break;
      case 'PEDIDO_VENDA':
        await this.prisma.saleOrder.updateMany({
          where: { id: request.documentId },
          data: { status: 'RASCUNHO' as any },
        });
        break;
      case 'PAGAMENTO':
        // Return to PENDENTE so user can resubmit for approval later
        await this.prisma.financialMovement.updateMany({
          where: { id: request.documentId },
          data: { status: 'PENDENTE' as any },
        });
        break;
      case 'FOLHA_PAGAMENTO':
        await this.prisma.payroll.updateMany({
          where: { id: request.documentId },
          data: { status: 'CALCULADA' as any },
        });
        break;
      case 'REQUISICAO':
        await this.prisma.requisition.updateMany({
          where: { id: request.documentId },
          data: { status: 'SOLICITADA' as any },
        });
        break;
      default:
        break;
    }
  }

  /**
   * Returns the most recent approval request for a document (any status).
   */
  async getDocumentApprovalStatus(documentId: string, companyId: string) {
    return this.prisma.approvalRequest.findFirst({
      where: { documentId, companyId },
      orderBy: { criadoEm: 'desc' },
      include: {
        policy: { select: { id: true, description: true } },
        actions: {
          include: {
            user: { select: { id: true, name: true } },
            role: { select: { id: true, name: true } },
          },
          orderBy: { atuadoEm: 'asc' },
        },
      },
    });
  }
}
