import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';
import { IntegrationService } from '@/modules/core/integration/integration.service';
import { CreateProductionOrderDto } from './dto/create-production-order.dto';
import { UpdateProductionOrderDto } from './dto/update-production-order.dto';

@Injectable()
export class ProductionOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly integration: IntegrationService,
  ) {}

  async findAll(
    companyId: string,
    query: {
      search?: string;
      status?: string;
      strategy?: string;
      type?: string;
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
        { observations: { contains: query.search, mode: 'insensitive' } },
        {
          product: {
            description: { contains: query.search, mode: 'insensitive' },
          },
        },
      ];
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.strategy) {
      where.strategy = query.strategy;
    }

    if (query.type) {
      where.type = query.type;
    }

    if (query.startDate || query.endDate) {
      where.dataInicioPrevista = {};
      if (query.startDate) {
        where.dataInicioPrevista.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        where.dataInicioPrevista.lte = new Date(query.endDate);
      }
    }

    const [data, total] = await Promise.all([
      this.prisma.productionOrder.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
        include: {
          product: {
            select: { id: true, description: true, code: true },
          },
          routing: {
            select: { id: true, version: true, description: true },
          },
          saleOrder: {
            select: { id: true, numero: true, status: true },
          },
        },
      }),
      this.prisma.productionOrder.count({ where }),
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
    const order = await this.prisma.productionOrder.findUnique({
      where: { id },
      include: {
        product: {
          select: { id: true, description: true, code: true },
        },
        routing: {
          select: { id: true, version: true, description: true },
        },
        saleOrder: {
          select: { id: true, numero: true, status: true },
        },
        items: {
          include: {
            product: {
              select: { id: true, description: true, code: true, unit: true },
            },
          },
        },
        pointings: {
          include: {
            workCenter: {
              select: { id: true, code: true, name: true },
            },
          },
          orderBy: { dataInicio: 'desc' },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Production Order ${id} not found`);
    }

    return order;
  }

  async create(companyId: string, data: CreateProductionOrderDto) {
    const numero = await this.generateNumero(companyId);

    return this.prisma.productionOrder.create({
      data: {
        companyId,
        numero,
        productId: data.productId,
        routingId: data.routingId,
        saleOrderId: data.saleOrderId,
        strategy: data.strategy as any,
        type: (data.type || 'NORMAL') as any,
        quantity: data.quantity,
        quantityProduced: 0,
        dataInicioPrevista: new Date(data.dataInicioPrevista),
        dataFimPrevista: new Date(data.dataFimPrevista),
        priority: data.priority || 5,
        observations: data.observations,
        status: 'PLANEJADA' as any,
      },
      include: {
        product: {
          select: { id: true, description: true, code: true },
        },
        routing: {
          select: { id: true, version: true, description: true },
        },
      },
    });
  }

  async update(id: string, data: UpdateProductionOrderDto) {
    const existing = await this.prisma.productionOrder.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Production Order ${id} not found`);
    }

    const updateData: any = { ...data };

    if (data.dataInicioPrevista) {
      updateData.dataInicioPrevista = new Date(data.dataInicioPrevista);
    }
    if (data.dataFimPrevista) {
      updateData.dataFimPrevista = new Date(data.dataFimPrevista);
    }

    return this.prisma.productionOrder.update({
      where: { id },
      data: updateData,
      include: {
        product: {
          select: { id: true, description: true, code: true },
        },
        routing: {
          select: { id: true, version: true, description: true },
        },
      },
    });
  }

  /**
   * Release: PLANEJADA -> LIBERADA
   * Explodes BOM into production order items.
   */
  async release(id: string) {
    const order = await this.prisma.productionOrder.findUnique({
      where: { id },
    });

    if (!order) {
      throw new NotFoundException(`Production Order ${id} not found`);
    }

    if (order.status !== 'PLANEJADA') {
      throw new BadRequestException(
        `Cannot release order with status ${order.status}. Expected PLANEJADA.`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // Find BOM for the product
      const bom = await tx.billOfMaterial.findFirst({
        where: { productId: order.productId },
        include: { items: true },
        orderBy: { createdAt: 'desc' },
      });

      if (bom && bom.items.length > 0) {
        // Explode BOM items into production order items
        await tx.productionOrderItem.createMany({
          data: bom.items.map((item) => ({
            productionOrderId: id,
            productId: item.productId,
            quantityRequired:
              item.quantity *
              order.quantity *
              (1 + (item.wastagePercent || 0) / 100),
            quantityConsumed: 0,
            unit: item.unit,
          })),
        });
      }

      return tx.productionOrder.update({
        where: { id },
        data: { status: 'LIBERADA' as any },
        include: {
          product: {
            select: { id: true, description: true, code: true },
          },
          items: {
            include: {
              product: {
                select: { id: true, description: true, code: true, unit: true },
              },
            },
          },
        },
      });
    });
  }

  /**
   * Start: LIBERADA -> EM_PRODUCAO
   * Sets dataInicioReal.
   */
  async start(id: string) {
    const order = await this.prisma.productionOrder.findUnique({
      where: { id },
    });

    if (!order) {
      throw new NotFoundException(`Production Order ${id} not found`);
    }

    if (order.status !== 'LIBERADA') {
      throw new BadRequestException(
        `Cannot start order with status ${order.status}. Expected LIBERADA.`,
      );
    }

    return this.prisma.productionOrder.update({
      where: { id },
      data: {
        status: 'EM_PRODUCAO' as any,
        dataInicioReal: new Date(),
      },
      include: {
        product: {
          select: { id: true, description: true, code: true },
        },
      },
    });
  }

  /**
   * Complete: EM_PRODUCAO -> CONCLUIDA
   * Sets dataFimReal.
   */
  async complete(id: string) {
    const order = await this.prisma.productionOrder.findUnique({
      where: { id },
    });

    if (!order) {
      throw new NotFoundException(`Production Order ${id} not found`);
    }

    if (order.status !== 'EM_PRODUCAO') {
      throw new BadRequestException(
        `Cannot complete order with status ${order.status}. Expected EM_PRODUCAO.`,
      );
    }

    const result = await this.prisma.productionOrder.update({
      where: { id },
      data: {
        status: 'CONCLUIDA' as any,
        dataFimReal: new Date(),
      },
      include: {
        product: {
          select: { id: true, description: true, code: true },
        },
      },
    });

    // Fire integration (non-blocking)
    this.integration.onProductionOrderCompleted(id, order.companyId, 'system').catch(err => console.error('Integration error:', err));

    return result;
  }

  /**
   * Cancel: any active status -> CANCELADA
   */
  async cancel(id: string) {
    const order = await this.prisma.productionOrder.findUnique({
      where: { id },
    });

    if (!order) {
      throw new NotFoundException(`Production Order ${id} not found`);
    }

    if (order.status === 'CONCLUIDA' || order.status === 'CANCELADA') {
      throw new BadRequestException(
        `Cannot cancel order with status ${order.status}.`,
      );
    }

    return this.prisma.productionOrder.update({
      where: { id },
      data: { status: 'CANCELADA' as any },
      include: {
        product: {
          select: { id: true, description: true, code: true },
        },
      },
    });
  }

  async getStats(companyId: string) {
    const [byStatus, byStrategy] = await Promise.all([
      this.prisma.productionOrder.groupBy({
        by: ['status'],
        where: { companyId },
        _count: { id: true },
      }),
      this.prisma.productionOrder.groupBy({
        by: ['strategy'],
        where: { companyId },
        _count: { id: true },
        _sum: { quantity: true },
      }),
    ]);

    return {
      byStatus: byStatus.map((s) => ({
        status: s.status,
        count: s._count.id,
      })),
      byStrategy: byStrategy.map((s) => ({
        strategy: s.strategy,
        count: s._count.id,
        totalQuantity: s._sum.quantity,
      })),
    };
  }

  private async generateNumero(companyId: string): Promise<string> {
    const today = new Date();
    const dateStr =
      today.getFullYear().toString() +
      (today.getMonth() + 1).toString().padStart(2, '0') +
      today.getDate().toString().padStart(2, '0');

    const prefix = `OP-${dateStr}-`;

    const lastOrder = await this.prisma.productionOrder.findFirst({
      where: {
        companyId,
        numero: { startsWith: prefix },
      },
      orderBy: { numero: 'desc' },
    });

    let sequence = 1;
    if (lastOrder && lastOrder.numero) {
      const lastSequence = parseInt(
        lastOrder.numero.replace(prefix, ''),
        10,
      );
      if (!isNaN(lastSequence)) {
        sequence = lastSequence + 1;
      }
    }

    return `${prefix}${sequence.toString().padStart(3, '0')}`;
  }
}
