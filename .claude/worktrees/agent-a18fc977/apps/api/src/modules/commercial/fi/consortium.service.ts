import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';
import { CreateConsortiumDto } from './dto/create-consortium.dto';
import { UpdateConsortiumDto } from './dto/update-consortium.dto';
import { CreateConsortiumPaymentDto } from './dto/create-consortium-payment.dto';
import { UpdateConsortiumPaymentDto } from './dto/update-consortium-payment.dto';

@Injectable()
export class ConsortiumService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    companyId: string,
    query: {
      search?: string;
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
        {
          person: {
            razaoSocial: { contains: query.search, mode: 'insensitive' },
          },
        },
        {
          person: {
            nomeFantasia: { contains: query.search, mode: 'insensitive' },
          },
        },
        { grupo: { contains: query.search, mode: 'insensitive' } },
        { cota: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.status) {
      where.status = query.status;
    }

    const [data, total] = await Promise.all([
      this.prisma.consortiumQuota.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          person: {
            select: {
              id: true,
              razaoSocial: true,
              nomeFantasia: true,
              cpfCnpj: true,
            },
          },
          administradora: {
            select: {
              id: true,
              razaoSocial: true,
              nomeFantasia: true,
            },
          },
        },
      }),
      this.prisma.consortiumQuota.count({ where }),
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
    const quota = await this.prisma.consortiumQuota.findUnique({
      where: { id },
      include: {
        person: true,
        administradora: {
          select: {
            id: true,
            razaoSocial: true,
            nomeFantasia: true,
            cpfCnpj: true,
          },
        },
        saleOrder: {
          select: { id: true, numero: true, status: true },
        },
        payments: {
          orderBy: { numeroParcela: 'asc' },
        },
      },
    });

    if (!quota) {
      throw new NotFoundException(`Consortium quota ${id} not found`);
    }

    return quota;
  }

  async create(companyId: string, data: CreateConsortiumDto) {
    return this.prisma.consortiumQuota.create({
      data: {
        companyId,
        personId: data.personId,
        administradoraId: data.administradoraId,
        grupo: data.grupo,
        cota: data.cota,
        valorCredito: data.valorCredito,
        parcelasMensais: data.parcelasMensais,
        valorParcelaMensal: data.valorParcelaMensal,
        saleOrderId: data.saleOrderId,
        comissaoPercent: data.comissaoPercent,
        dataAdesao: data.dataAdesao ? new Date(data.dataAdesao) : null,
        observacoes: data.observacoes,
        saldoDevedor: data.valorCredito,
      },
      include: {
        person: true,
        administradora: {
          select: { id: true, razaoSocial: true, nomeFantasia: true },
        },
      },
    });
  }

  async update(id: string, data: UpdateConsortiumDto) {
    const existing = await this.prisma.consortiumQuota.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Consortium quota ${id} not found`);
    }

    return this.prisma.consortiumQuota.update({
      where: { id },
      data: data as any,
      include: {
        person: true,
        administradora: {
          select: { id: true, razaoSocial: true, nomeFantasia: true },
        },
      },
    });
  }

  async addPayment(quotaId: string, data: CreateConsortiumPaymentDto) {
    const quota = await this.prisma.consortiumQuota.findUnique({
      where: { id: quotaId },
    });

    if (!quota) {
      throw new NotFoundException(`Consortium quota ${quotaId} not found`);
    }

    return this.prisma.consortiumPayment.create({
      data: {
        quotaId,
        numeroParcela: data.numeroParcela,
        dataVencimento: new Date(data.dataVencimento),
        valor: data.valor,
        status: 'PENDENTE',
      },
    });
  }

  async updatePayment(paymentId: string, data: UpdateConsortiumPaymentDto) {
    const payment = await this.prisma.consortiumPayment.findUnique({
      where: { id: paymentId },
    });

    if (!payment) {
      throw new NotFoundException(`Payment ${paymentId} not found`);
    }

    const updateData: any = { ...data };

    // If marking as paid, set dataPagamento and update quota totals
    if (data.status === 'PAGO' && payment.status !== 'PAGO') {
      if (!updateData.dataPagamento) {
        updateData.dataPagamento = new Date();
      }
      if (!updateData.valorPago) {
        updateData.valorPago = payment.valor;
      }

      // Update quota running totals
      await this.prisma.consortiumQuota.update({
        where: { id: payment.quotaId },
        data: {
          valorPago: { increment: updateData.valorPago },
          saldoDevedor: { decrement: updateData.valorPago },
          parcelasPagas: { increment: 1 },
        },
      });
    }

    if (updateData.dataPagamento && typeof updateData.dataPagamento === 'string') {
      updateData.dataPagamento = new Date(updateData.dataPagamento);
    }

    return this.prisma.consortiumPayment.update({
      where: { id: paymentId },
      data: updateData,
    });
  }

  async contemplate(
    id: string,
    data: { tipoContemplacao: string; valorLance?: number; dataContemplacao?: string },
  ) {
    const quota = await this.prisma.consortiumQuota.findUnique({
      where: { id },
    });

    if (!quota) {
      throw new NotFoundException(`Consortium quota ${id} not found`);
    }

    return this.prisma.consortiumQuota.update({
      where: { id },
      data: {
        status: 'CONTEMPLADO',
        tipoContemplacao: data.tipoContemplacao,
        valorLance: data.valorLance,
        dataContemplacao: data.dataContemplacao
          ? new Date(data.dataContemplacao)
          : new Date(),
      },
      include: {
        person: true,
        administradora: {
          select: { id: true, razaoSocial: true, nomeFantasia: true },
        },
      },
    });
  }

  async getStats(companyId: string) {
    const [byStatus, totalCredito] = await Promise.all([
      this.prisma.consortiumQuota.groupBy({
        by: ['status'],
        where: { companyId },
        _count: { id: true },
        _sum: { valorCredito: true },
      }),
      this.prisma.consortiumQuota.aggregate({
        where: { companyId },
        _sum: { valorCredito: true },
      }),
    ]);

    return {
      byStatus: byStatus.map((s) => ({
        status: s.status,
        count: s._count.id,
        totalCredito: s._sum.valorCredito,
      })),
      totalCredito: totalCredito._sum.valorCredito,
    };
  }
}
