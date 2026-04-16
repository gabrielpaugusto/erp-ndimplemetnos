import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';
import { CreateInsightDto } from './dto/create-insight.dto';

@Injectable()
export class InsightsService {
  constructor(private readonly prisma: PrismaService) {}

  async getActive(companyId: string) {
    return this.prisma.aiInsight.findMany({
      where: {
        companyId,
        dismissed: false,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: [
        { severity: 'desc' },
        { createdAt: 'desc' },
      ],
    });
  }

  async create(companyId: string, userId: string, dto: CreateInsightDto) {
    return this.prisma.aiInsight.create({
      data: {
        companyId,
        userId,
        title: dto.title,
        description: dto.description,
        category: dto.category,
        severity: dto.severity,
        actionable: dto.actionable ?? false,
        actionUrl: dto.actionUrl,
      },
    });
  }

  async dismiss(id: string) {
    const insight = await this.prisma.aiInsight.findUnique({ where: { id } });

    if (!insight) {
      throw new NotFoundException(`Insight ${id} not found`);
    }

    return this.prisma.aiInsight.update({
      where: { id },
      data: { dismissed: true },
    });
  }

  async generateInsights(companyId: string, userId: string) {
    const insights: CreateInsightDto[] = [];

    // Check for overdue financial movements
    try {
      const overdueCount = await this.prisma.financialMovement.count({
        where: { companyId, status: 'VENCIDO' },
      });
      if (overdueCount > 0) {
        insights.push({
          title: `${overdueCount} titulo(s) vencido(s) no financeiro`,
          description: `Existem ${overdueCount} titulo(s) com data de vencimento ultrapassada que precisam de atencao imediata.`,
          category: 'financeiro',
          severity: overdueCount > 5 ? 'critical' : 'warning',
          actionable: true,
          actionUrl: '/financeiro/movimentacoes?status=VENCIDO',
        });
      }
    } catch {
      // Module may not have data yet
    }

    // Check for low stock
    try {
      const lowStockCount = await this.prisma.$queryRawUnsafe<
        [{ count: number }]
      >(
        `SELECT COUNT(*)::int as count FROM stock_balances WHERE "companyId" = $1 AND quantity < "minStock" AND "minStock" > 0`,
        companyId,
      );
      const count = Number(lowStockCount[0]?.count || 0);
      if (count > 0) {
        insights.push({
          title: `${count} produto(s) com estoque abaixo do minimo`,
          description: `Ha ${count} produto(s) cujo saldo em estoque esta abaixo do nivel minimo configurado.`,
          category: 'estoque',
          severity: count > 10 ? 'critical' : 'warning',
          actionable: true,
          actionUrl: '/estoque/saldos?filter=abaixo-minimo',
        });
      }
    } catch {
      // Module may not have data yet
    }

    // Check for pending production orders
    try {
      const pendingOPs = await this.prisma.productionOrder.count({
        where: {
          companyId,
          status: { in: ['PLANEJADA', 'LIBERADA'] },
        },
      });
      if (pendingOPs > 0) {
        insights.push({
          title: `${pendingOPs} ordem(ns) de producao pendente(s)`,
          description: `Existem ${pendingOPs} ordens de producao aguardando inicio.`,
          category: 'producao',
          severity: 'info',
          actionable: true,
          actionUrl: '/producao/ordens?status=pendente',
        });
      }
    } catch {
      // Module may not have data yet
    }

    // Save generated insights
    const created = [];
    for (const dto of insights) {
      // Check if similar insight already exists and is not dismissed
      const existing = await this.prisma.aiInsight.findFirst({
        where: {
          companyId,
          title: dto.title,
          dismissed: false,
        },
      });

      if (!existing) {
        const insight = await this.create(companyId, userId, dto);
        created.push(insight);
      }
    }

    return created;
  }
}
