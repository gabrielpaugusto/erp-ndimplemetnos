import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';
import { CreatePurchaseRequestDto } from './dto/create-purchase-request.dto';
import { UpdatePurchaseRequestDto } from './dto/update-purchase-request.dto';

@Injectable()
export class PurchaseRequestsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    companyId: string,
    query: {
      search?: string;
      status?: string;
      priority?: string;
      startDate?: string;
      endDate?: string;
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
        { numero: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
        { justificativa: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.priority) {
      where.priority = parseInt(query.priority, 10);
    }

    if (query.startDate || query.endDate) {
      where.dataSolicitacao = {};
      if (query.startDate) {
        where.dataSolicitacao.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        where.dataSolicitacao.lte = new Date(query.endDate);
      }
    }

    const [data, total] = await Promise.all([
      this.prisma.purchaseRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          solicitante: {
            select: { id: true, name: true },
          },
          aprovador: {
            select: { id: true, name: true },
          },
          _count: {
            select: { items: true },
          },
        },
      }),
      this.prisma.purchaseRequest.count({ where }),
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
    const request = await this.prisma.purchaseRequest.findUnique({
      where: { id },
      include: {
        solicitante: {
          select: { id: true, name: true, email: true },
        },
        aprovador: {
          select: { id: true, name: true, email: true },
        },
        items: {
          include: {
            product: {
              select: { id: true, code: true, description: true, unit: true },
            },
          },
        },
        supplierQuotations: {
          select: { id: true, status: true, totalValue: true },
        },
        purchaseOrders: {
          select: { id: true, numero: true, status: true },
        },
      },
    });

    if (!request) {
      throw new NotFoundException(`Purchase request ${id} not found`);
    }

    return request;
  }

  async create(companyId: string, userId: string, data: CreatePurchaseRequestDto) {
    const numero = await this.generateNumero(companyId, 'SC');

    return this.prisma.purchaseRequest.create({
      data: {
        companyId,
        numero,
        solicitanteId: userId,
        description: data.description,
        justificativa: data.justificativa,
        priority: data.priority || 5,
        observations: data.observations,
        status: 'RASCUNHO' as any,
        items: {
          create: data.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unit: item.unit,
            estimatedPrice: item.estimatedPrice,
            description: item.description,
          })),
        },
      },
      include: {
        solicitante: {
          select: { id: true, name: true },
        },
        items: {
          include: {
            product: {
              select: { id: true, code: true, description: true, unit: true },
            },
          },
        },
      },
    });
  }

  async update(id: string, data: UpdatePurchaseRequestDto) {
    const existing = await this.prisma.purchaseRequest.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Purchase request ${id} not found`);
    }

    if (existing.status !== 'RASCUNHO') {
      throw new BadRequestException(
        `Cannot update purchase request with status ${existing.status}. Only RASCUNHO can be edited.`,
      );
    }

    const updateData: any = {};
    if (data.description !== undefined) updateData.description = data.description;
    if (data.justificativa !== undefined) updateData.justificativa = data.justificativa;
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.observations !== undefined) updateData.observations = data.observations;

    return this.prisma.purchaseRequest.update({
      where: { id },
      data: updateData,
      include: {
        solicitante: {
          select: { id: true, name: true },
        },
        items: {
          include: {
            product: {
              select: { id: true, code: true, description: true, unit: true },
            },
          },
        },
      },
    });
  }

  async submit(id: string) {
    const request = await this.prisma.purchaseRequest.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!request) {
      throw new NotFoundException(`Purchase request ${id} not found`);
    }

    if (request.status !== 'RASCUNHO') {
      throw new BadRequestException(
        `Cannot submit purchase request with status ${request.status}. Expected RASCUNHO.`,
      );
    }

    if (request.items.length === 0) {
      throw new BadRequestException(
        'Cannot submit purchase request with no items.',
      );
    }

    return this.prisma.purchaseRequest.update({
      where: { id },
      data: { status: 'SOLICITADA' as any },
      include: {
        solicitante: { select: { id: true, name: true } },
        items: {
          include: {
            product: {
              select: { id: true, code: true, description: true, unit: true },
            },
          },
        },
      },
    });
  }

  async approve(id: string, userId: string) {
    const request = await this.prisma.purchaseRequest.findUnique({
      where: { id },
    });

    if (!request) {
      throw new NotFoundException(`Purchase request ${id} not found`);
    }

    if (request.status !== 'SOLICITADA') {
      throw new BadRequestException(
        `Cannot approve purchase request with status ${request.status}. Expected SOLICITADA.`,
      );
    }

    return this.prisma.purchaseRequest.update({
      where: { id },
      data: {
        status: 'APROVADA' as any,
        aprovadorId: userId,
        dataAprovacao: new Date(),
      },
      include: {
        solicitante: { select: { id: true, name: true } },
        aprovador: { select: { id: true, name: true } },
        items: {
          include: {
            product: {
              select: { id: true, code: true, description: true, unit: true },
            },
          },
        },
      },
    });
  }

  async cancel(id: string) {
    const request = await this.prisma.purchaseRequest.findUnique({
      where: { id },
    });

    if (!request) {
      throw new NotFoundException(`Purchase request ${id} not found`);
    }

    if (request.status === 'CANCELADA' || request.status === 'RECEBIDA') {
      throw new BadRequestException(
        `Cannot cancel purchase request with status ${request.status}.`,
      );
    }

    return this.prisma.purchaseRequest.update({
      where: { id },
      data: { status: 'CANCELADA' as any },
      include: {
        solicitante: { select: { id: true, name: true } },
      },
    });
  }

  async getStats(companyId: string) {
    const [byStatus, byPriority] = await Promise.all([
      this.prisma.purchaseRequest.groupBy({
        by: ['status'],
        where: { companyId },
        _count: { id: true },
      }),
      this.prisma.purchaseRequest.groupBy({
        by: ['priority'],
        where: { companyId },
        _count: { id: true },
      }),
    ]);

    return {
      byStatus: byStatus.map((s) => ({
        status: s.status,
        count: s._count.id,
      })),
      byPriority: byPriority.map((p) => ({
        priority: p.priority,
        count: p._count.id,
      })),
    };
  }

  private async generateNumero(companyId: string, prefix: string): Promise<string> {
    const today = new Date();
    const dateStr =
      today.getFullYear().toString() +
      (today.getMonth() + 1).toString().padStart(2, '0') +
      today.getDate().toString().padStart(2, '0');

    const fullPrefix = `${prefix}-${dateStr}-`;

    const last = await this.prisma.purchaseRequest.findFirst({
      where: {
        companyId,
        numero: { startsWith: fullPrefix },
      },
      orderBy: { numero: 'desc' },
    });

    let sequence = 1;
    if (last && last.numero) {
      const lastSequence = parseInt(last.numero.replace(fullPrefix, ''), 10);
      if (!isNaN(lastSequence)) {
        sequence = lastSequence + 1;
      }
    }

    return `${fullPrefix}${sequence.toString().padStart(3, '0')}`;
  }
}
