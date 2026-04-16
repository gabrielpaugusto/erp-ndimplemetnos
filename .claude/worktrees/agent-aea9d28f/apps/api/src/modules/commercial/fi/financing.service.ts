import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';
import { CreateFinancingDto } from './dto/create-financing.dto';
import { UpdateFinancingDto } from './dto/update-financing.dto';

@Injectable()
export class FinancingService {
  constructor(private readonly prisma: PrismaService) {}

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
        { numero: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.type) {
      where.type = query.type;
    }

    if (query.status) {
      where.status = query.status;
    }

    const [data, total] = await Promise.all([
      this.prisma.financing.findMany({
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
          financeira: {
            select: {
              id: true,
              razaoSocial: true,
              nomeFantasia: true,
            },
          },
          saleOrder: {
            select: { id: true, numero: true, status: true },
          },
        },
      }),
      this.prisma.financing.count({ where }),
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
    const financing = await this.prisma.financing.findUnique({
      where: { id },
      include: {
        person: true,
        financeira: {
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
      },
    });

    if (!financing) {
      throw new NotFoundException(`Financing ${id} not found`);
    }

    return financing;
  }

  async create(companyId: string, data: CreateFinancingDto) {
    return this.prisma.financing.create({
      data: {
        companyId,
        personId: data.personId,
        saleOrderId: data.saleOrderId,
        type: data.type as any,
        financeiraId: data.financeiraId,
        valorBem: data.valorBem,
        valorEntrada: data.valorEntrada,
        valorFinanciado: data.valorFinanciado,
        taxaJuros: data.taxaJuros,
        parcelas: data.parcelas,
        valorParcela: data.valorParcela,
        codigoFiname: data.codigoFiname,
        linhaCredito: data.linhaCredito,
        carencia: data.carencia,
        comissaoPercent: data.comissaoPercent,
        observacoes: data.observacoes,
        dataSimulacao: new Date(),
      },
      include: {
        person: true,
        financeira: {
          select: { id: true, razaoSocial: true, nomeFantasia: true },
        },
      },
    });
  }

  async update(id: string, data: UpdateFinancingDto) {
    const existing = await this.prisma.financing.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Financing ${id} not found`);
    }

    // Handle automatic date setting on status transitions
    const updateData: any = { ...data };

    if (data.status && data.status !== existing.status) {
      switch (data.status) {
        case 'PROPOSTA_ENVIADA':
          if (!updateData.dataProposta) {
            updateData.dataProposta = new Date();
          }
          break;
        case 'APROVADO':
          if (!updateData.dataAprovacao) {
            updateData.dataAprovacao = new Date();
          }
          break;
        case 'CONTRATADO':
          if (!updateData.dataContratacao) {
            updateData.dataContratacao = new Date();
          }
          break;
        case 'LIBERADO':
          if (!updateData.dataLiberacao) {
            updateData.dataLiberacao = new Date();
          }
          break;
      }
    }

    return this.prisma.financing.update({
      where: { id },
      data: updateData,
      include: {
        person: true,
        financeira: {
          select: { id: true, razaoSocial: true, nomeFantasia: true },
        },
        saleOrder: {
          select: { id: true, numero: true, status: true },
        },
      },
    });
  }

  async getStats(companyId: string) {
    const [byStatus, byType] = await Promise.all([
      this.prisma.financing.groupBy({
        by: ['status'],
        where: { companyId },
        _count: { id: true },
      }),
      this.prisma.financing.groupBy({
        by: ['type'],
        where: { companyId },
        _count: { id: true },
        _sum: { valorFinanciado: true },
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
        totalFinanciado: t._sum.valorFinanciado,
      })),
    };
  }
}
