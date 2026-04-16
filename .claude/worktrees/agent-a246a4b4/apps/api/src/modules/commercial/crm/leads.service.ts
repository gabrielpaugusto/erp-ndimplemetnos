import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { CreateActivityDto } from './dto/create-activity.dto';

@Injectable()
export class LeadsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    companyId: string,
    query: {
      search?: string;
      status?: string;
      vendedorId?: string;
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
        { title: { contains: query.search, mode: 'insensitive' } },
        {
          person: {
            razaoSocial: { contains: query.search, mode: 'insensitive' },
          },
        },
      ];
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.vendedorId) {
      where.vendedorId = query.vendedorId;
    }

    const [data, total] = await Promise.all([
      this.prisma.lead.findMany({
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
          vendedor: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
      this.prisma.lead.count({ where }),
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
    const lead = await this.prisma.lead.findUnique({
      where: { id },
      include: {
        person: true,
        vendedor: {
          select: { id: true, name: true, email: true },
        },
        activities: {
          orderBy: { createdAt: 'desc' },
          include: {
            user: { select: { id: true, name: true } },
          },
        },
        quotations: {
          select: {
            id: true,
            numero: true,
            status: true,
            total: true,
            createdAt: true,
          },
        },
      },
    });

    if (!lead) {
      throw new NotFoundException(`Lead ${id} not found`);
    }

    return lead;
  }

  async create(companyId: string, userId: string, data: CreateLeadDto) {
    return this.prisma.lead.create({
      data: {
        companyId,
        personId: data.personId,
        contactName: data.contactName,
        contactEmail: data.contactEmail,
        contactPhone: data.contactPhone,
        companyName: data.companyName,
        title: data.title,
        description: data.description,
        source: data.source as any,
        valorEstimado: data.valorEstimado,
        probabilidade: data.probabilidade,
        vendedorId: data.vendedorId || userId,
        dataPrevisaoFechamento: data.dataPrevisaoFechamento
          ? new Date(data.dataPrevisaoFechamento)
          : undefined,
      },
      include: {
        person: true,
        vendedor: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async update(id: string, data: UpdateLeadDto) {
    const existing = await this.prisma.lead.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Lead ${id} not found`);
    }

    const updateData: any = { ...data };

    // Convert date strings to Date objects
    if (data.dataPrevisaoFechamento) {
      updateData.dataPrevisaoFechamento = new Date(data.dataPrevisaoFechamento);
    }

    // If status changed to GANHO, set dataFechamento
    if (data.status === 'GANHO' && existing.status !== 'GANHO') {
      updateData.dataFechamento = new Date();
    }

    // If status changed to PERDIDO, set dataFechamento
    if (data.status === 'PERDIDO' && existing.status !== 'PERDIDO') {
      updateData.dataFechamento = new Date();
    }

    return this.prisma.lead.update({
      where: { id },
      data: updateData,
      include: {
        person: true,
        vendedor: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async remove(id: string) {
    const existing = await this.prisma.lead.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Lead ${id} not found`);
    }

    return this.prisma.lead.delete({ where: { id } });
  }

  async addActivity(
    leadId: string,
    userId: string,
    data: CreateActivityDto,
  ) {
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) {
      throw new NotFoundException(`Lead ${leadId} not found`);
    }

    return this.prisma.leadActivity.create({
      data: {
        leadId,
        userId,
        type: data.type as any,
        title: data.title,
        description: data.description,
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : undefined,
        completedAt: data.completedAt ? new Date(data.completedAt) : undefined,
      },
      include: {
        user: { select: { id: true, name: true } },
      },
    });
  }

  async getActivities(leadId: string) {
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) {
      throw new NotFoundException(`Lead ${leadId} not found`);
    }

    return this.prisma.leadActivity.findMany({
      where: { leadId },
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true } },
      },
    });
  }

  async getPipelineStats(companyId: string) {
    const [countByStatus, sumByStatus] = await Promise.all([
      this.prisma.lead.groupBy({
        by: ['status'],
        where: { companyId },
        _count: { id: true },
      }),
      this.prisma.lead.groupBy({
        by: ['status'],
        where: { companyId },
        _sum: { valorEstimado: true },
      }),
    ]);

    const stats = countByStatus.map((item) => {
      const sumItem = sumByStatus.find((s) => s.status === item.status);
      return {
        status: item.status,
        count: item._count.id,
        valorEstimado: sumItem?._sum.valorEstimado || 0,
      };
    });

    return stats;
  }
}
