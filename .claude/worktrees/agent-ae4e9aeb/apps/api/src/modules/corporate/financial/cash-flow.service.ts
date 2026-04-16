import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';
import { CreateCashFlowDto } from './dto/create-cash-flow.dto';

@Injectable()
export class CashFlowService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    companyId: string,
    query: {
      type?: string;
      dateFrom?: string;
      dateTo?: string;
      page?: string;
      limit?: string;
    },
  ) {
    const page = parseInt(query.page || '1', 10);
    const limit = parseInt(query.limit || '20', 10);
    const skip = (page - 1) * limit;

    const where: any = { companyId };

    if (query.type) {
      where.type = query.type;
    }

    if (query.dateFrom || query.dateTo) {
      where.date = {};
      if (query.dateFrom) {
        where.date.gte = new Date(query.dateFrom);
      }
      if (query.dateTo) {
        where.date.lte = new Date(query.dateTo);
      }
    }

    const [data, total] = await Promise.all([
      this.prisma.cashFlow.findMany({
        where,
        skip,
        take: limit,
        orderBy: { date: 'asc' },
        include: {
          category: { select: { id: true, code: true, name: true } },
          bankAccount: { select: { id: true, name: true } },
        },
      }),
      this.prisma.cashFlow.count({ where }),
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

  async create(companyId: string, data: CreateCashFlowDto) {
    return this.prisma.cashFlow.create({
      data: {
        companyId,
        date: new Date(data.date),
        description: data.description,
        type: data.type as any,
        valorPrevisto: data.valorPrevisto,
        valorRealizado: data.valorRealizado,
        categoryId: data.categoryId,
        bankAccountId: data.bankAccountId,
      },
    });
  }

  async getProjection(
    companyId: string,
    query: { months?: string },
  ) {
    const monthsAhead = parseInt(query.months || '6', 10);
    const now = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + monthsAhead);

    const entries = await this.prisma.cashFlow.findMany({
      where: {
        companyId,
        date: { gte: now, lte: endDate },
      },
      orderBy: { date: 'asc' },
    });

    // Group by month
    const projection: Record<
      string,
      {
        previsto: { receitas: number; despesas: number };
        realizado: { receitas: number; despesas: number };
      }
    > = {};

    for (const entry of entries) {
      const monthKey = `${entry.date.getFullYear()}-${(entry.date.getMonth() + 1).toString().padStart(2, '0')}`;

      if (!projection[monthKey]) {
        projection[monthKey] = {
          previsto: { receitas: 0, despesas: 0 },
          realizado: { receitas: 0, despesas: 0 },
        };
      }

      const category = entry.type === 'RECEITA' ? 'receitas' : 'despesas';
      projection[monthKey].previsto[category] += Number(entry.valorPrevisto);
      if (entry.valorRealizado) {
        projection[monthKey].realizado[category] += Number(
          entry.valorRealizado,
        );
      }
    }

    return Object.entries(projection).map(([month, values]) => ({
      month,
      ...values,
      saldoPrevisto:
        values.previsto.receitas - values.previsto.despesas,
      saldoRealizado:
        values.realizado.receitas - values.realizado.despesas,
    }));
  }

  async generateFromMovements(companyId: string) {
    const pendingMovements = await this.prisma.financialMovement.findMany({
      where: {
        companyId,
        status: { in: ['PENDENTE', 'VENCIDO'] },
      },
    });

    const created = [];

    for (const movement of pendingMovements) {
      const existing = await this.prisma.cashFlow.findFirst({
        where: {
          companyId,
          description: { contains: movement.numero },
          date: movement.dataVencimento,
        },
      });

      if (!existing) {
        const entry = await this.prisma.cashFlow.create({
          data: {
            companyId,
            date: movement.dataVencimento,
            description: `${movement.numero} - ${movement.description}`,
            type: movement.type,
            valorPrevisto: movement.valor,
            categoryId: movement.categoryId,
            bankAccountId: movement.bankAccountId,
          },
        });
        created.push(entry);
      }
    }

    return { created: created.length, entries: created };
  }
}
