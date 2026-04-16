import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';
import { CreateBankTransactionDto } from './dto/create-bank-transaction.dto';

@Injectable()
export class BankTransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    companyId: string,
    query: {
      bankAccountId?: string;
      dateFrom?: string;
      dateTo?: string;
      search?: string;
      page?: string;
      limit?: string;
    },
  ) {
    const page = parseInt(query.page || '1', 10);
    const limit = parseInt(query.limit || '20', 10);
    const skip = (page - 1) * limit;

    const where: any = { companyId };

    if (query.bankAccountId) {
      where.bankAccountId = query.bankAccountId;
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

    if (query.search) {
      where.description = { contains: query.search, mode: 'insensitive' };
    }

    const [data, total] = await Promise.all([
      this.prisma.bankTransaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { date: 'desc' },
        include: {
          bankAccount: { select: { id: true, name: true } },
        },
      }),
      this.prisma.bankTransaction.count({ where }),
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
    const transaction = await this.prisma.bankTransaction.findUnique({
      where: { id },
      include: {
        bankAccount: { select: { id: true, name: true } },
        financialMovement: {
          select: { id: true, numero: true, description: true },
        },
      },
    });

    if (!transaction) {
      throw new NotFoundException(`Bank transaction ${id} not found`);
    }

    return transaction;
  }

  async create(companyId: string, data: CreateBankTransactionDto) {
    return this.prisma.$transaction(async (tx) => {
      const account = await tx.bankAccount.findUnique({
        where: { id: data.bankAccountId },
      });

      if (!account) {
        throw new NotFoundException(
          `Bank account ${data.bankAccountId} not found`,
        );
      }

      const valueNum = Number(data.value);
      const currentBalance = Number(account.saldoAtual);
      const newBalance =
        data.type === 'CREDITO' || data.type === 'RESGATE'
          ? currentBalance + valueNum
          : data.type === 'DEBITO' || data.type === 'APLICACAO'
            ? currentBalance - valueNum
            : currentBalance; // TRANSFERENCIA handled separately

      const transaction = await tx.bankTransaction.create({
        data: {
          companyId,
          bankAccountId: data.bankAccountId,
          type: data.type as any,
          date: new Date(data.date),
          value: data.value,
          balance: newBalance,
          description: data.description,
          financialMovementId: data.financialMovementId,
        },
        include: {
          bankAccount: { select: { id: true, name: true } },
        },
      });

      await tx.bankAccount.update({
        where: { id: data.bankAccountId },
        data: { saldoAtual: newBalance },
      });

      return transaction;
    });
  }

  async getStatement(
    companyId: string,
    query: {
      bankAccountId: string;
      dateFrom?: string;
      dateTo?: string;
    },
  ) {
    const where: any = {
      companyId,
      bankAccountId: query.bankAccountId,
    };

    if (query.dateFrom || query.dateTo) {
      where.date = {};
      if (query.dateFrom) {
        where.date.gte = new Date(query.dateFrom);
      }
      if (query.dateTo) {
        where.date.lte = new Date(query.dateTo);
      }
    }

    const transactions = await this.prisma.bankTransaction.findMany({
      where,
      orderBy: { date: 'asc' },
      include: {
        financialMovement: {
          select: { id: true, numero: true, type: true },
        },
      },
    });

    const account = await this.prisma.bankAccount.findUnique({
      where: { id: query.bankAccountId },
      select: { id: true, name: true, saldoInicial: true, saldoAtual: true },
    });

    return {
      account,
      transactions,
      totalCredits: transactions
        .filter((t) => t.type === 'CREDITO' || t.type === 'RESGATE')
        .reduce((sum, t) => sum + Number(t.value), 0),
      totalDebits: transactions
        .filter((t) => t.type === 'DEBITO' || t.type === 'APLICACAO')
        .reduce((sum, t) => sum + Number(t.value), 0),
    };
  }

  async reconcile(id: string) {
    const transaction = await this.prisma.bankTransaction.findUnique({
      where: { id },
    });

    if (!transaction) {
      throw new NotFoundException(`Bank transaction ${id} not found`);
    }

    return this.prisma.bankTransaction.update({
      where: { id },
      data: { reconciled: !transaction.reconciled },
    });
  }
}
