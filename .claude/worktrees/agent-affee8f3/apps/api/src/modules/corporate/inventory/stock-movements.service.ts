import {
  Injectable,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';
import { CreateStockMovementDto } from './dto/create-stock-movement.dto';

@Injectable()
export class StockMovementsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    companyId: string,
    query: {
      productId?: string;
      locationId?: string;
      type?: string;
      source?: string;
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

    if (query.productId) {
      where.productId = query.productId;
    }

    if (query.locationId) {
      where.locationId = query.locationId;
    }

    if (query.type) {
      where.type = query.type;
    }

    if (query.source) {
      where.source = query.source;
    }

    if (query.startDate || query.endDate) {
      where.date = {};
      if (query.startDate) {
        where.date.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        where.date.lte = new Date(query.endDate);
      }
    }

    const [data, total] = await Promise.all([
      this.prisma.stockMovement.findMany({
        where,
        skip,
        take: limit,
        orderBy: { date: 'desc' },
        include: {
          product: {
            select: { id: true, code: true, description: true, unit: true },
          },
          location: {
            select: { id: true, code: true, name: true },
          },
          locationDestination: {
            select: { id: true, code: true, name: true },
          },
          user: {
            select: { id: true, name: true },
          },
        },
      }),
      this.prisma.stockMovement.count({ where }),
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

  async getByProduct(productId: string, companyId: string) {
    return this.prisma.stockMovement.findMany({
      where: { productId, companyId },
      orderBy: { date: 'desc' },
      take: 100,
      include: {
        location: {
          select: { id: true, code: true, name: true },
        },
        locationDestination: {
          select: { id: true, code: true, name: true },
        },
        user: {
          select: { id: true, name: true },
        },
      },
    });
  }

  async create(companyId: string, userId: string, data: CreateStockMovementDto) {
    if (data.type === 'TRANSFERENCIA' && !data.locationDestinationId) {
      throw new BadRequestException(
        'locationDestinationId is required for TRANSFERENCIA movements.',
      );
    }

    const unitCost = data.unitCost || 0;
    const totalCost = data.quantity * unitCost;

    return this.prisma.$transaction(async (tx) => {
      // Create the movement
      const movement = await tx.stockMovement.create({
        data: {
          companyId,
          productId: data.productId,
          locationId: data.locationId,
          locationDestinationId: data.locationDestinationId || null,
          type: data.type as any,
          source: data.source as any,
          quantity: data.quantity,
          unitCost,
          totalCost,
          documentNumber: data.documentNumber,
          purchaseOrderId: data.purchaseOrderId || null,
          saleOrderId: data.saleOrderId || null,
          productionOrderId: data.productionOrderId || null,
          requisitionId: data.requisitionId || null,
          userId,
          observations: data.observations,
        },
        include: {
          product: {
            select: { id: true, code: true, description: true, unit: true },
          },
          location: {
            select: { id: true, code: true, name: true },
          },
          locationDestination: {
            select: { id: true, code: true, name: true },
          },
        },
      });

      // Update stock balances based on movement type
      const increaseTypes = ['ENTRADA', 'AJUSTE_POSITIVO', 'DEVOLUCAO'];
      const decreaseTypes = ['SAIDA', 'AJUSTE_NEGATIVO', 'CONSUMO_INTERNO'];

      if (increaseTypes.includes(data.type)) {
        await this.upsertBalance(tx, companyId, data.productId, data.locationId, data.quantity);
      } else if (decreaseTypes.includes(data.type)) {
        await this.upsertBalance(tx, companyId, data.productId, data.locationId, -data.quantity);
      } else if (data.type === 'TRANSFERENCIA') {
        // Decrease from source
        await this.upsertBalance(tx, companyId, data.productId, data.locationId, -data.quantity);
        // Increase at destination
        await this.upsertBalance(tx, companyId, data.productId, data.locationDestinationId!, data.quantity);
      }

      return movement;
    });
  }

  async getStats(companyId: string) {
    const [byType, bySource, recentCount] = await Promise.all([
      this.prisma.stockMovement.groupBy({
        by: ['type'],
        where: { companyId },
        _count: { id: true },
        _sum: { quantity: true },
      }),
      this.prisma.stockMovement.groupBy({
        by: ['source'],
        where: { companyId },
        _count: { id: true },
      }),
      this.prisma.stockMovement.count({
        where: {
          companyId,
          date: {
            gte: new Date(new Date().setDate(new Date().getDate() - 30)),
          },
        },
      }),
    ]);

    return {
      byType: byType.map((t) => ({
        type: t.type,
        count: t._count.id,
        totalQuantity: t._sum.quantity,
      })),
      bySource: bySource.map((s) => ({
        source: s.source,
        count: s._count.id,
      })),
      last30Days: recentCount,
    };
  }

  private async upsertBalance(
    tx: any,
    companyId: string,
    productId: string,
    locationId: string,
    quantityDelta: number,
  ) {
    await tx.stockBalance.upsert({
      where: {
        productId_locationId: {
          productId,
          locationId,
        },
      },
      create: {
        companyId,
        productId,
        locationId,
        quantity: Math.max(0, quantityDelta),
        availableQuantity: Math.max(0, quantityDelta),
        lastMovementAt: new Date(),
      },
      update: {
        quantity: { increment: quantityDelta },
        availableQuantity: { increment: quantityDelta },
        lastMovementAt: new Date(),
      },
    });
  }
}
