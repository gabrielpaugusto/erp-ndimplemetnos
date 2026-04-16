import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';

interface ApprovalLevelDto {
  ordem: number;
  roleId: string;
  prazoHoras: number;
  acaoEsgotado: string;
}

interface UpsertPolicyDto {
  module: string;
  documentType: string;
  enabled: boolean;
  triggerType: string;
  triggerValue?: number;
  description?: string;
  levels: ApprovalLevelDto[];
}

@Injectable()
export class ApprovalConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async listPolicies(companyId: string) {
    return this.prisma.approvalPolicy.findMany({
      where: { companyId },
      include: {
        levels: {
          include: { role: true },
          orderBy: { ordem: 'asc' },
        },
      },
      orderBy: [{ module: 'asc' }, { documentType: 'asc' }],
    });
  }

  async upsertPolicy(companyId: string, dto: UpsertPolicyDto) {
    const { module, documentType, enabled, triggerType, triggerValue, description, levels } = dto;

    return this.prisma.$transaction(async (tx) => {
      // Find existing policy for this company+module+documentType
      const existing = await tx.approvalPolicy.findUnique({
        where: { companyId_module_documentType: { companyId, module: module as any, documentType: documentType as any } },
      });

      let policy;
      if (existing) {
        // Update
        policy = await tx.approvalPolicy.update({
          where: { id: existing.id },
          data: {
            enabled,
            triggerType: triggerType as any,
            triggerValue: triggerValue != null ? triggerValue : null,
            description: description ?? null,
          },
        });
        // Delete existing levels and recreate
        await tx.approvalLevel.deleteMany({ where: { policyId: existing.id } });
      } else {
        // Create
        policy = await tx.approvalPolicy.create({
          data: {
            companyId,
            module: module as any,
            documentType: documentType as any,
            enabled,
            triggerType: triggerType as any,
            triggerValue: triggerValue != null ? triggerValue : null,
            description: description ?? null,
          },
        });
      }

      // Recreate levels
      if (levels && levels.length > 0) {
        await tx.approvalLevel.createMany({
          data: levels.map((l) => ({
            policyId: policy.id,
            ordem: l.ordem,
            roleId: l.roleId,
            prazoHoras: l.prazoHoras,
            acaoEsgotado: l.acaoEsgotado as any,
          })),
        });
      }

      return tx.approvalPolicy.findUnique({
        where: { id: policy.id },
        include: { levels: { include: { role: true }, orderBy: { ordem: 'asc' } } },
      });
    });
  }

  async deletePolicy(companyId: string, id: string) {
    const policy = await this.prisma.approvalPolicy.findFirst({
      where: { id, companyId },
    });
    if (!policy) {
      throw new NotFoundException('Regra de aprovação não encontrada');
    }
    await this.prisma.approvalPolicy.delete({ where: { id } });
    return { deleted: true };
  }
}
