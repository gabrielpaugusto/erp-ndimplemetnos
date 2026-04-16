import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';
import { IntegrationService } from '@/modules/core/integration/integration.service';
import { CreateFinancialMovementDto } from './dto/create-financial-movement.dto';
import { UpdateFinancialMovementDto } from './dto/update-financial-movement.dto';
import { PayMovementDto } from './dto/pay-movement.dto';

@Injectable()
export class FinancialMovementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly integration: IntegrationService,
  ) {}

  private async generateNumero(
    companyId: string,
    type: string,
  ): Promise<string> {
    const today = new Date();
    const dateStr =
      today.getFullYear().toString() +
      (today.getMonth() + 1).toString().padStart(2, '0') +
      today.getDate().toString().padStart(2, '0');
    const prefix = type === 'RECEITA' ? `CR-${dateStr}` : `CP-${dateStr}`;

    const last = await this.prisma.financialMovement.findFirst({
      where: {
        companyId,
        numero: { startsWith: prefix },
      },
      orderBy: { numero: 'desc' },
    });

    let seq = 1;
    if (last) {
      const parts = last.numero.split('-');
      seq = parseInt(parts[parts.length - 1], 10) + 1;
    }

    return `${prefix}-${seq.toString().padStart(3, '0')}`;
  }

  async findAll(
    companyId: string,
    query: {
      type?: string;
      status?: string;
      dateFrom?: string;
      dateTo?: string;
      personId?: string;
      search?: string;
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

    if (query.status) {
      where.status = query.status;
    }

    if (query.personId) {
      where.personId = query.personId;
    }

    if (query.dateFrom || query.dateTo) {
      where.dataVencimento = {};
      if (query.dateFrom) {
        where.dataVencimento.gte = new Date(query.dateFrom);
      }
      if (query.dateTo) {
        where.dataVencimento.lte = new Date(query.dateTo);
      }
    }

    if (query.search) {
      where.OR = [
        { numero: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
        {
          person: {
            razaoSocial: { contains: query.search, mode: 'insensitive' },
          },
        },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.financialMovement.findMany({
        where,
        skip,
        take: limit,
        orderBy: { dataVencimento: 'asc' },
        include: {
          person: { select: { id: true, razaoSocial: true, cpfCnpj: true } },
          bankAccount: { select: { id: true, name: true } },
          category: { select: { id: true, code: true, name: true } },
        },
      }),
      this.prisma.financialMovement.count({ where }),
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
    const movement = await this.prisma.financialMovement.findUnique({
      where: { id },
      include: {
        person: { select: { id: true, razaoSocial: true, cpfCnpj: true } },
        bankAccount: { select: { id: true, name: true } },
        category: { select: { id: true, code: true, name: true } },
        costCenter: { select: { id: true, code: true, name: true } },
        bankTransactions: true,
      },
    });

    if (!movement) {
      throw new NotFoundException(`Financial movement ${id} not found`);
    }

    return movement;
  }

  async create(companyId: string, data: CreateFinancialMovementDto) {
    const numero =
      data.numero ||
      (await this.generateNumero(companyId, data.type));

    return this.prisma.financialMovement.create({
      data: {
        companyId,
        type: data.type as any,
        personId: data.personId,
        description: data.description,
        numero,
        parcela: data.parcela || 1,
        totalParcelas: data.totalParcelas || 1,
        valor: data.valor,
        dataEmissao: new Date(data.dataEmissao),
        dataVencimento: new Date(data.dataVencimento),
        paymentMethod: data.paymentMethod as any,
        bankAccountId: data.bankAccountId,
        categoryId: data.categoryId,
        costCenterId: data.costCenterId,
        nfeDocumentId: data.nfeDocumentId,
        saleOrderId: data.saleOrderId,
        observations: data.observations,
      },
      include: {
        person: { select: { id: true, razaoSocial: true, cpfCnpj: true } },
      },
    });
  }

  async update(id: string, data: UpdateFinancialMovementDto) {
    const existing = await this.prisma.financialMovement.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Financial movement ${id} not found`);
    }

    if (existing.status === 'PAGO') {
      throw new BadRequestException('Cannot update a paid movement');
    }

    const updateData: any = { ...data };

    if (data.dataEmissao) {
      updateData.dataEmissao = new Date(data.dataEmissao);
    }
    if (data.dataVencimento) {
      updateData.dataVencimento = new Date(data.dataVencimento);
    }

    return this.prisma.financialMovement.update({
      where: { id },
      data: updateData,
      include: {
        person: { select: { id: true, razaoSocial: true, cpfCnpj: true } },
      },
    });
  }

  async pay(id: string, data: PayMovementDto) {
    const movement = await this.prisma.financialMovement.findUnique({
      where: { id },
    });

    if (!movement) {
      throw new NotFoundException(`Financial movement ${id} not found`);
    }

    if (movement.status === 'PAGO') {
      throw new BadRequestException('Movement is already paid');
    }

    if (movement.status === 'CANCELADO') {
      throw new BadRequestException('Cannot pay a cancelled movement');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.financialMovement.update({
        where: { id },
        data: {
          status: 'PAGO',
          dataPagamento: new Date(data.dataPagamento),
          valorPago: data.valorPago,
          paymentMethod: data.paymentMethod as any,
          bankAccountId: data.bankAccountId || movement.bankAccountId,
        },
        include: {
          person: { select: { id: true, razaoSocial: true, cpfCnpj: true } },
        },
      });

      // Create bank transaction if bankAccountId is provided
      const bankAccountId = data.bankAccountId || movement.bankAccountId;
      if (bankAccountId) {
        const account = await tx.bankAccount.findUnique({
          where: { id: bankAccountId },
        });

        if (account) {
          const transactionType =
            movement.type === 'RECEITA' ? 'CREDITO' : 'DEBITO';
          const newBalance =
            movement.type === 'RECEITA'
              ? Number(account.saldoAtual) + data.valorPago
              : Number(account.saldoAtual) - data.valorPago;

          await tx.bankTransaction.create({
            data: {
              companyId: movement.companyId,
              bankAccountId,
              type: transactionType,
              date: new Date(data.dataPagamento),
              value: data.valorPago,
              balance: newBalance,
              description: `${movement.type === 'RECEITA' ? 'Recebimento' : 'Pagamento'}: ${movement.description}`,
              financialMovementId: id,
            },
          });

          await tx.bankAccount.update({
            where: { id: bankAccountId },
            data: { saldoAtual: newBalance },
          });
        }
      }

      return updated;
    });

    // Fire integration (non-blocking)
    this.integration.onFinancialMovementPaid(id, movement.companyId, 'system').catch(err => console.error('Integration error:', err));

    return result;
  }

  async getOverdue(companyId: string) {
    const now = new Date();

    const data = await this.prisma.financialMovement.findMany({
      where: {
        companyId,
        status: 'PENDENTE',
        dataVencimento: { lt: now },
      },
      orderBy: { dataVencimento: 'asc' },
      include: {
        person: { select: { id: true, razaoSocial: true, cpfCnpj: true } },
      },
    });

    return { data, total: data.length };
  }

  async getStats(companyId: string) {
    const movements = await this.prisma.financialMovement.findMany({
      where: { companyId },
      select: { type: true, status: true, valor: true, valorPago: true },
    });

    const byType: Record<string, { count: number; total: number }> = {};
    const byStatus: Record<string, { count: number; total: number }> = {};

    for (const m of movements) {
      if (!byType[m.type]) {
        byType[m.type] = { count: 0, total: 0 };
      }
      byType[m.type].count++;
      byType[m.type].total += Number(m.valor);

      if (!byStatus[m.status]) {
        byStatus[m.status] = { count: 0, total: 0 };
      }
      byStatus[m.status].count++;
      byStatus[m.status].total += Number(m.valor);
    }

    return { byType, byStatus };
  }

  async generateInstallments(
    companyId: string,
    data: CreateFinancialMovementDto & { installments: number },
  ) {
    const installments = data.installments || data.totalParcelas || 1;
    const valorParcela = +(data.valor / installments).toFixed(2);
    const baseDate = new Date(data.dataVencimento);
    const results = [];

    for (let i = 0; i < installments; i++) {
      const vencimento = new Date(baseDate);
      vencimento.setMonth(vencimento.getMonth() + i);

      const numero = await this.generateNumero(companyId, data.type);

      const movement = await this.prisma.financialMovement.create({
        data: {
          companyId,
          type: data.type as any,
          personId: data.personId,
          description: data.description,
          numero,
          parcela: i + 1,
          totalParcelas: installments,
          valor: i === installments - 1
            ? +(data.valor - valorParcela * (installments - 1)).toFixed(2)
            : valorParcela,
          dataEmissao: new Date(data.dataEmissao),
          dataVencimento: vencimento,
          paymentMethod: data.paymentMethod as any,
          bankAccountId: data.bankAccountId,
          categoryId: data.categoryId,
          costCenterId: data.costCenterId,
          observations: data.observations,
        },
      });

      results.push(movement);
    }

    return results;
  }
}
