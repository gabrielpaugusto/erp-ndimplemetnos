import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';
import { CreateInsuranceDto } from './dto/create-insurance.dto';
import { UpdateInsuranceDto } from './dto/update-insurance.dto';

@Injectable()
export class InsuranceService {
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
        { descricaoBem: { contains: query.search, mode: 'insensitive' } },
        { numeroApolice: { contains: query.search, mode: 'insensitive' } },
        { placa: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.type) {
      where.type = query.type;
    }

    if (query.status) {
      where.status = query.status;
    }

    const [data, total] = await Promise.all([
      this.prisma.insurancePolicy.findMany({
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
          seguradora: {
            select: {
              id: true,
              razaoSocial: true,
              nomeFantasia: true,
            },
          },
        },
      }),
      this.prisma.insurancePolicy.count({ where }),
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
    const policy = await this.prisma.insurancePolicy.findUnique({
      where: { id },
      include: {
        person: true,
        seguradora: {
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

    if (!policy) {
      throw new NotFoundException(`Insurance policy ${id} not found`);
    }

    return policy;
  }

  async create(companyId: string, data: CreateInsuranceDto) {
    return this.prisma.insurancePolicy.create({
      data: {
        companyId,
        personId: data.personId,
        seguradoraId: data.seguradoraId,
        type: data.type as any,
        descricaoBem: data.descricaoBem,
        anoFabricacao: data.anoFabricacao,
        chassi: data.chassi,
        placa: data.placa,
        valorBem: data.valorBem,
        premio: data.premio,
        franquia: data.franquia,
        importanciaSegurada: data.importanciaSegurada,
        dataInicio: data.dataInicio ? new Date(data.dataInicio) : null,
        dataFim: data.dataFim ? new Date(data.dataFim) : null,
        saleOrderId: data.saleOrderId,
        comissaoPercent: data.comissaoPercent,
        observacoes: data.observacoes,
      },
      include: {
        person: true,
        seguradora: {
          select: { id: true, razaoSocial: true, nomeFantasia: true },
        },
      },
    });
  }

  async update(id: string, data: UpdateInsuranceDto) {
    const existing = await this.prisma.insurancePolicy.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Insurance policy ${id} not found`);
    }

    const updateData: any = { ...data };

    // Convert date strings to Date objects if present
    if (updateData.dataInicio) {
      updateData.dataInicio = new Date(updateData.dataInicio);
    }
    if (updateData.dataFim) {
      updateData.dataFim = new Date(updateData.dataFim);
    }
    if (updateData.dataRenovacao) {
      updateData.dataRenovacao = new Date(updateData.dataRenovacao);
    }

    return this.prisma.insurancePolicy.update({
      where: { id },
      data: updateData,
      include: {
        person: true,
        seguradora: {
          select: { id: true, razaoSocial: true, nomeFantasia: true },
        },
        saleOrder: {
          select: { id: true, numero: true, status: true },
        },
      },
    });
  }

  async getExpiringPolicies(companyId: string, days: number) {
    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);

    return this.prisma.insurancePolicy.findMany({
      where: {
        companyId,
        status: 'VIGENTE',
        dataFim: {
          gte: now,
          lte: futureDate,
        },
      },
      orderBy: { dataFim: 'asc' },
      include: {
        person: {
          select: {
            id: true,
            razaoSocial: true,
            nomeFantasia: true,
            cpfCnpj: true,
          },
        },
        seguradora: {
          select: {
            id: true,
            razaoSocial: true,
            nomeFantasia: true,
          },
        },
      },
    });
  }

  async getStats(companyId: string) {
    const [byStatus, byType] = await Promise.all([
      this.prisma.insurancePolicy.groupBy({
        by: ['status'],
        where: { companyId },
        _count: { id: true },
      }),
      this.prisma.insurancePolicy.groupBy({
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
}
