import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';
import { CreateBankAccountDto } from './dto/create-bank-account.dto';
import { UpdateBankAccountDto } from './dto/update-bank-account.dto';

@Injectable()
export class BankAccountsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    companyId: string,
    query: {
      active?: string;
      search?: string;
      page?: string;
      limit?: string;
    },
  ) {
    const page = parseInt(query.page || '1', 10);
    const limit = parseInt(query.limit || '20', 10);
    const skip = (page - 1) * limit;

    const where: any = { companyId };

    if (query.active !== undefined) {
      where.active = query.active === 'true';
    }

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { banco: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.bankAccount.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
      }),
      this.prisma.bankAccount.count({ where }),
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
    const account = await this.prisma.bankAccount.findUnique({
      where: { id },
    });

    if (!account) {
      throw new NotFoundException(`Bank account ${id} not found`);
    }

    return account;
  }

  async create(companyId: string, data: CreateBankAccountDto) {
    return this.prisma.bankAccount.create({
      data: {
        companyId,
        name: data.name,
        banco: data.banco,
        agencia: data.agencia,
        conta: data.conta,
        tipoConta: data.tipoConta,
        saldoInicial: data.saldoInicial || 0,
        saldoAtual: data.saldoInicial || 0,
      },
    });
  }

  async update(id: string, data: UpdateBankAccountDto) {
    const existing = await this.prisma.bankAccount.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Bank account ${id} not found`);
    }

    return this.prisma.bankAccount.update({
      where: { id },
      data: data as any,
    });
  }

  async getBalance(id: string) {
    const account = await this.prisma.bankAccount.findUnique({
      where: { id },
    });

    if (!account) {
      throw new NotFoundException(`Bank account ${id} not found`);
    }

    return {
      id: account.id,
      name: account.name,
      saldoInicial: account.saldoInicial,
      saldoAtual: account.saldoAtual,
    };
  }

  async remove(id: string) {
    const existing = await this.prisma.bankAccount.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Bank account ${id} not found`);
    }

    return this.prisma.bankAccount.update({
      where: { id },
      data: { active: false },
    });
  }
}
