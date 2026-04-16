import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';
import { IntegrationService } from '@/modules/core/integration/integration.service';
import { ApprovalEngineService } from '@/modules/corporate/approvals/approval-engine.service';
import { DocumentEventService } from '@/modules/core/audit/document-event.service';
import { CreateRequisitionDto } from './dto/create-requisition.dto';
import { UpdateRequisitionDto } from './dto/update-requisition.dto';
import { ApproveRequisitionDto } from './dto/approve-requisition.dto';
import { DeliverRequisitionDto } from './dto/deliver-requisition.dto';
import { ApproveRequisitionSingleItemDto, ApproveItemAction } from './dto/approve-item.dto';

@Injectable()
export class RequisitionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly integration: IntegrationService,
    private readonly approvalEngine: ApprovalEngineService,
    private readonly documentEvents: DocumentEventService,
  ) {}

  async findAll(
    companyId: string,
    query: {
      search?: string;
      type?: string;
      status?: string;
      page?: string;
      limit?: string;
    },
  ) {
    const page = parseInt(query.page || '1', 10);
    const limit = parseInt(query.limit || '20', 10);
    const skip = (page - 1) * limit;

    const where: any = { companyId };

    if (query.search) {
      where.OR = [
        { numero: { contains: query.search, mode: 'insensitive' } },
        { justificativa: { contains: query.search, mode: 'insensitive' } },
        { observations: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.type) {
      where.type = query.type;
    }

    if (query.status) {
      where.status = query.status;
    }

    const [data, total] = await Promise.all([
      this.prisma.requisition.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ createdAt: 'desc' }],
        include: {
          solicitante: {
            select: { id: true, name: true },
          },
          aprovador: {
            select: { id: true, name: true },
          },
          serviceOrder: {
            select: { id: true, numero: true, status: true },
          },
          calderariaOrder: {
            select: { id: true, numero: true, status: true },
          },
          productionOrder: {
            select: { id: true, numero: true, status: true },
          },
          _count: {
            select: { items: true },
          },
        },
      }),
      this.prisma.requisition.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const requisition = await this.prisma.requisition.findUnique({
      where: { id },
      include: {
        solicitante: {
          select: { id: true, name: true, email: true },
        },
        aprovador: {
          select: { id: true, name: true, email: true },
        },
        serviceOrder: {
          select: { id: true, numero: true, status: true },
        },
        calderariaOrder: {
          select: { id: true, numero: true, status: true },
        },
        productionOrder: {
          select: { id: true, numero: true, status: true },
        },
        items: {
          include: {
            product: {
              select: { id: true, description: true, code: true, unit: true },
            },
          },
        },
      },
    });

    if (!requisition) {
      throw new NotFoundException(`Requisition ${id} not found`);
    }

    return requisition;
  }

  async create(companyId: string, userId: string, data: CreateRequisitionDto) {
    const numero = await this.generateNumero(companyId);

    return this.prisma.requisition.create({
      data: {
        companyId,
        numero,
        type: data.type as any,
        solicitanteId: userId,
        serviceOrderId: data.serviceOrderId || null,
        calderariaOrderId: data.calderariaOrderId || null,
        productionOrderId: data.productionOrderId || null,
        justificativa: data.justificativa,
        observations: data.observations,
        status: 'RASCUNHO' as any,
        items: {
          create: data.items.map((item) => ({
            product: { connect: { id: item.productId } },
            quantityRequested: item.quantityRequested,
            quantityApproved: 0,
            quantityDelivered: 0,
            unit: item.unit || 'UN',
          })),
        },
      },
      include: {
        solicitante: {
          select: { id: true, name: true },
        },
        items: {
          include: {
            product: {
              select: { id: true, description: true, code: true, unit: true },
            },
          },
        },
      },
    });
  }

  async update(id: string, data: UpdateRequisitionDto) {
    const existing = await this.prisma.requisition.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Requisition ${id} not found`);
    }

    if (existing.status !== 'RASCUNHO') {
      throw new BadRequestException(
        `Cannot update requisition with status ${existing.status}. Only RASCUNHO can be edited.`,
      );
    }

    const updateData: any = {};

    if (data.type !== undefined) updateData.type = data.type;
    if (data.serviceOrderId !== undefined) updateData.serviceOrderId = data.serviceOrderId;
    if (data.calderariaOrderId !== undefined) updateData.calderariaOrderId = data.calderariaOrderId;
    if (data.productionOrderId !== undefined) updateData.productionOrderId = data.productionOrderId;
    if (data.justificativa !== undefined) updateData.justificativa = data.justificativa;
    if (data.observations !== undefined) updateData.observations = data.observations;

    return this.prisma.requisition.update({
      where: { id },
      data: updateData,
      include: {
        solicitante: {
          select: { id: true, name: true },
        },
        items: {
          include: {
            product: {
              select: { id: true, description: true, code: true, unit: true },
            },
          },
        },
      },
    });
  }

  /**
   * Submit: RASCUNHO -> SOLICITADA
   */
  async submit(id: string) {
    const requisition = await this.prisma.requisition.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!requisition) {
      throw new NotFoundException(`Requisition ${id} not found`);
    }

    if (requisition.status !== 'RASCUNHO') {
      throw new BadRequestException(
        `Cannot submit requisition with status ${requisition.status}. Expected RASCUNHO.`,
      );
    }

    if (requisition.items.length === 0) {
      throw new BadRequestException(
        'Cannot submit requisition with no items.',
      );
    }

    return this.prisma.requisition.update({
      where: { id },
      data: { status: 'SOLICITADA' as any },
      include: {
        solicitante: { select: { id: true, name: true } },
        items: {
          include: {
            product: {
              select: { id: true, description: true, code: true, unit: true },
            },
          },
        },
      },
    });
  }

  /**
   * Approve: SOLICITADA -> APROVADA
   * Sets quantityApproved per item and aprovadorId.
   */
  async approve(id: string, userId: string, data: ApproveRequisitionDto, companyId?: string) {
    const requisition = await this.prisma.requisition.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!requisition) {
      throw new NotFoundException(`Requisition ${id} not found`);
    }

    if (requisition.status !== 'SOLICITADA' && requisition.status !== 'AGUARDANDO_APROVACAO') {
      throw new BadRequestException(
        `Cannot approve requisition with status ${requisition.status}. Expected SOLICITADA.`,
      );
    }

    // Check if approval engine is needed
    if (companyId && requisition.status === 'SOLICITADA') {
      const needsApproval = await this.approvalEngine.shouldApprove(
        companyId,
        'ESTOQUE',
        'REQUISICAO',
      );

      if (needsApproval) {
        await this.approvalEngine.createRequest(
          companyId,
          'ESTOQUE',
          'REQUISICAO',
          id,
          userId,
        );
        return this.prisma.requisition.update({
          where: { id },
          data: { status: 'AGUARDANDO_APROVACAO' as any },
          include: {
            solicitante: { select: { id: true, name: true } },
            aprovador: { select: { id: true, name: true } },
            items: {
              include: {
                product: {
                  select: { id: true, description: true, code: true, unit: true },
                },
              },
            },
          },
        });
      }
    }

    return this.prisma.$transaction(async (tx) => {
      // Update each item's quantityApproved
      for (const approvalItem of data.items) {
        const existingItem = requisition.items.find(
          (i) => i.id === approvalItem.id,
        );

        if (!existingItem) {
          throw new BadRequestException(
            `Requisition item ${approvalItem.id} not found in this requisition.`,
          );
        }

        if (approvalItem.quantityApproved > existingItem.quantityRequested) {
          throw new BadRequestException(
            `Approved quantity (${approvalItem.quantityApproved}) cannot exceed requested quantity (${existingItem.quantityRequested}) for item ${approvalItem.id}.`,
          );
        }

        await tx.requisitionItem.update({
          where: { id: approvalItem.id },
          data: { quantityApproved: approvalItem.quantityApproved },
        });
      }

      return tx.requisition.update({
        where: { id },
        data: {
          status: 'APROVADA' as any,
          aprovadorId: userId,
        },
        include: {
          solicitante: { select: { id: true, name: true } },
          aprovador: { select: { id: true, name: true } },
          items: {
            include: {
              product: {
                select: { id: true, description: true, code: true, unit: true },
              },
            },
          },
        },
      });
    });
  }

  /**
   * Separate: APROVADA -> SEPARADA
   */
  async separate(id: string) {
    const requisition = await this.prisma.requisition.findUnique({
      where: { id },
    });

    if (!requisition) {
      throw new NotFoundException(`Requisition ${id} not found`);
    }

    if (requisition.status !== 'APROVADA') {
      throw new BadRequestException(
        `Cannot separate requisition with status ${requisition.status}. Expected APROVADA.`,
      );
    }

    return this.prisma.requisition.update({
      where: { id },
      data: { status: 'SEPARADA' as any },
      include: {
        solicitante: { select: { id: true, name: true } },
        aprovador: { select: { id: true, name: true } },
      },
    });
  }

  /**
   * Deliver: SEPARADA -> ENTREGUE
   * Sets quantityDelivered per item.
   */
  async deliver(id: string, data: DeliverRequisitionDto) {
    const requisition = await this.prisma.requisition.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!requisition) {
      throw new NotFoundException(`Requisition ${id} not found`);
    }

    if (requisition.status !== 'SEPARADA') {
      throw new BadRequestException(
        `Cannot deliver requisition with status ${requisition.status}. Expected SEPARADA.`,
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      for (const deliveryItem of data.items) {
        const existingItem = requisition.items.find(
          (i) => i.id === deliveryItem.id,
        );

        if (!existingItem) {
          throw new BadRequestException(
            `Requisition item ${deliveryItem.id} not found in this requisition.`,
          );
        }

        if (deliveryItem.quantityDelivered > (existingItem.quantityApproved ?? 0)) {
          throw new BadRequestException(
            `Delivered quantity (${deliveryItem.quantityDelivered}) cannot exceed approved quantity (${existingItem.quantityApproved}) for item ${deliveryItem.id}.`,
          );
        }

        await tx.requisitionItem.update({
          where: { id: deliveryItem.id },
          data: { quantityDelivered: deliveryItem.quantityDelivered },
        });
      }

      return tx.requisition.update({
        where: { id },
        data: { status: 'ENTREGUE' as any },
        include: {
          solicitante: { select: { id: true, name: true } },
          aprovador: { select: { id: true, name: true } },
          items: {
            include: {
              product: {
                select: { id: true, description: true, code: true, unit: true },
              },
            },
          },
        },
      });
    });

    // Fire integration (non-blocking)
    this.integration.onRequisitionDelivered(id, requisition.companyId, 'system').catch(err => console.error('Integration error:', err));

    return result;
  }

  /**
   * Cancel: any active status -> CANCELADA
   */
  async cancel(id: string) {
    const requisition = await this.prisma.requisition.findUnique({
      where: { id },
    });

    if (!requisition) {
      throw new NotFoundException(`Requisition ${id} not found`);
    }

    if (requisition.status === 'ENTREGUE' || requisition.status === 'CANCELADA') {
      throw new BadRequestException(
        `Cannot cancel requisition with status ${requisition.status}.`,
      );
    }

    return this.prisma.requisition.update({
      where: { id },
      data: { status: 'CANCELADA' as any },
      include: {
        solicitante: { select: { id: true, name: true } },
      },
    });
  }

  async getStats(companyId: string) {
    const [byStatus, byType] = await Promise.all([
      this.prisma.requisition.groupBy({
        by: ['status'],
        where: { companyId },
        _count: { id: true },
      }),
      this.prisma.requisition.groupBy({
        by: ['type'],
        where: { companyId },
        _count: { id: true },
      }),
    ]);

    return {
      byStatus: byStatus.map((s) => ({
        status: s.status,
        count: s._count.id,
      })),
      byType: byType.map((t) => ({
        type: t.type,
        count: t._count.id,
      })),
    };
  }

  private async generateNumero(companyId: string): Promise<string> {
    const today = new Date();
    const dateStr =
      today.getFullYear().toString() +
      (today.getMonth() + 1).toString().padStart(2, '0') +
      today.getDate().toString().padStart(2, '0');

    const prefix = `REQ-${dateStr}-`;

    const lastRequisition = await this.prisma.requisition.findFirst({
      where: {
        companyId,
        numero: { startsWith: prefix },
      },
      orderBy: { numero: 'desc' },
    });

    let sequence = 1;
    if (lastRequisition && lastRequisition.numero) {
      const lastSequence = parseInt(
        lastRequisition.numero.replace(prefix, ''),
        10,
      );
      if (!isNaN(lastSequence)) {
        sequence = lastSequence + 1;
      }
    }

    return `${prefix}${sequence.toString().padStart(3, '0')}`;
  }

  // ── Sprint 2.3 — Timeline ───────────────────────────────────────────────

  async getTimeline(id: string, companyId: string) {
    return this.documentEvents.getTimeline('Requisition', id, companyId);
  }

  // ── Sprint 2.2 — Aprovação Parcial por Item ─────────────────────────────

  /**
   * Aprova ou rejeita um item individual de uma requisição.
   * Atualiza o status geral para PARCIALMENTE_APROVADA quando há mix de aprovados/rejeitados.
   */
  async approveItem(
    requisitionId: string,
    itemId: string,
    dto: ApproveRequisitionSingleItemDto,
    userId: string,
    companyId: string,
  ) {
    const requisition = await this.prisma.requisition.findFirst({
      where: { id: requisitionId, companyId },
      include: { items: true },
    });

    if (!requisition) {
      throw new NotFoundException(`Requisição ${requisitionId} não encontrada`);
    }

    const item = requisition.items.find((i) => i.id === itemId);
    if (!item) {
      throw new NotFoundException(`Item ${itemId} não encontrado na requisição`);
    }

    const allowedStatuses = ['SOLICITADA', 'AGUARDANDO_APROVACAO', 'APROVADA'];
    if (!allowedStatuses.includes(requisition.status as string)) {
      throw new BadRequestException(
        `Não é possível alterar aprovação de item com status "${requisition.status}"`,
      );
    }

    if (dto.action === ApproveItemAction.APROVAR) {
      const qty = dto.quantityApproved ?? (item as any).quantityRequested;
      if (qty > (item as any).quantityRequested) {
        throw new BadRequestException(
          `Quantidade aprovada (${qty}) não pode exceder a solicitada (${(item as any).quantityRequested})`,
        );
      }
      await this.prisma.requisitionItem.update({
        where: { id: itemId },
        data: {
          statusAprovacao: 'APROVADO' as any,
          quantityApproved: qty,
          motivoRejeicao: null,
        },
      });
    } else {
      if (!dto.motivoRejeicao?.trim()) {
        throw new BadRequestException('O campo "motivoRejeicao" é obrigatório ao rejeitar um item');
      }
      await this.prisma.requisitionItem.update({
        where: { id: itemId },
        data: {
          statusAprovacao: 'REJEITADO' as any,
          quantityApproved: 0,
          motivoRejeicao: dto.motivoRejeicao,
        },
      });
    }

    // Recalcula status geral da requisição
    const updatedItems = await this.prisma.requisitionItem.findMany({
      where: { requisitionId },
      select: { statusAprovacao: true },
    });

    const total    = updatedItems.length;
    const approved = updatedItems.filter((i) => i.statusAprovacao === 'APROVADO').length;
    const rejected = updatedItems.filter((i) => i.statusAprovacao === 'REJEITADO').length;

    let newStatus: string;
    if (approved === total)                  newStatus = 'APROVADA';
    else if (rejected === total)             newStatus = 'REJEITADA';
    else if (approved > 0 || rejected > 0)  newStatus = 'PARCIALMENTE_APROVADA';
    else                                     newStatus = requisition.status as string;

    const updated = await this.prisma.requisition.update({
      where: { id: requisitionId },
      data: {
        status: newStatus as any,
        aprovadorId: userId,
      },
      include: {
        items: {
          include: { product: { select: { id: true, code: true, description: true, unit: true } } },
        },
      },
    });

    // Registra na timeline
    this.documentEvents.record({
      companyId,
      entityType: 'Requisition',
      entityId:   requisitionId,
      eventType:  dto.action === ApproveItemAction.APROVAR ? 'ITEM_APROVADO' : 'ITEM_REJEITADO',
      description: dto.action === ApproveItemAction.APROVAR
        ? `Item aprovado (qtd: ${dto.quantityApproved ?? (item as any).quantityRequested})`
        : `Item rejeitado: ${dto.motivoRejeicao}`,
      userId,
    });

    return updated;
  }
}
