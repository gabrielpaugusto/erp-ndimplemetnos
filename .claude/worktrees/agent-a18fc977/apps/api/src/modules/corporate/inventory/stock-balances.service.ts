import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';

@Injectable()
export class StockBalancesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    companyId: string,
    query: {
      locationId?: string;
      belowMinStock?: string;
      search?: string;
      page?: string;
      limit?: string;
    },
  ) {
    const page = parseInt(query.page || '1', 10);
    const limit = parseInt(query.limit || '20', 10);
    const skip = (page - 1) * limit;

    const where: any = { companyId };

    if (query.locationId) {
      where.locationId = query.locationId;
    }

    if (query.search) {
      where.product = {
        OR: [
          { code: { contains: query.search, mode: 'insensitive' } },
          { description: { contains: query.search, mode: 'insensitive' } },
        ],
      };
    }

    if (query.belowMinStock === 'true') {
      where.AND = [
        { minStock: { gt: 0 } },
        {
          quantity: {
            // We need raw comparison; use a workaround with Prisma
            // This filters where quantity < minStock
          },
        },
      ];
      // Prisma doesn't support comparing two fields directly in where clause,
      // so we'll filter in the service after fetching
      delete where.AND;
    }

    const [data, total] = await Promise.all([
      this.prisma.stockBalance.findMany({
        where,
        skip,
        take: limit,
        orderBy: { product: { description: 'asc' } },
        include: {
          product: {
            select: {
              id: true,
              code: true,
              description: true,
              unit: true,
              estoqueMinimo: true,
              estoqueMaximo: true,
            },
          },
          location: {
            select: { id: true, code: true, name: true, type: true },
          },
        },
      }),
      this.prisma.stockBalance.count({ where }),
    ]);

    let filteredData = data;
    if (query.belowMinStock === 'true') {
      filteredData = data.filter(
        (b) => Number(b.minStock) > 0 && Number(b.quantity) < Number(b.minStock),
      );
    }

    return {
      data: filteredData,
      meta: {
        total: query.belowMinStock === 'true' ? filteredData.length : total,
        page,
        limit,
        totalPages: Math.ceil(
          (query.belowMinStock === 'true' ? filteredData.length : total) / limit,
        ),
      },
    };
  }

  async getByProduct(productId: string, companyId: string) {
    return this.prisma.stockBalance.findMany({
      where: { productId, companyId },
      include: {
        location: {
          select: { id: true, code: true, name: true, type: true },
        },
      },
    });
  }

  async getAlerts(companyId: string) {
    const balances = await this.prisma.stockBalance.findMany({
      where: {
        companyId,
        reorderPoint: { gt: 0 },
      },
      include: {
        product: {
          select: {
            id: true,
            code: true,
            description: true,
            unit: true,
          },
        },
        location: {
          select: { id: true, code: true, name: true },
        },
      },
    });

    return balances.filter(
      (b) => Number(b.quantity) <= Number(b.reorderPoint),
    );
  }

  async recalculate(companyId: string) {
    // Get all unique product-location combinations from movements
    const movements = await this.prisma.stockMovement.findMany({
      where: { companyId },
      select: {
        productId: true,
        locationId: true,
        locationDestinationId: true,
        type: true,
        quantity: true,
        unitCost: true,
      },
    });

    // Build a map of balances
    const balanceMap = new Map<string, { quantity: number; totalCost: number }>();

    const getKey = (productId: string, locationId: string) =>
      `${productId}:${locationId}`;

    const increaseTypes = ['ENTRADA', 'AJUSTE_POSITIVO', 'DEVOLUCAO'];
    const decreaseTypes = ['SAIDA', 'AJUSTE_NEGATIVO', 'CONSUMO_INTERNO'];

    for (const mov of movements) {
      const key = getKey(mov.productId, mov.locationId);
      const qty = Number(mov.quantity);
      const cost = qty * Number(mov.unitCost);

      if (!balanceMap.has(key)) {
        balanceMap.set(key, { quantity: 0, totalCost: 0 });
      }

      const balance = balanceMap.get(key)!;

      if (increaseTypes.includes(mov.type)) {
        balance.quantity += qty;
        balance.totalCost += cost;
      } else if (decreaseTypes.includes(mov.type)) {
        balance.quantity -= qty;
        balance.totalCost -= cost;
      } else if (mov.type === 'TRANSFERENCIA') {
        balance.quantity -= qty;
        balance.totalCost -= cost;

        if (mov.locationDestinationId) {
          const destKey = getKey(mov.productId, mov.locationDestinationId);
          if (!balanceMap.has(destKey)) {
            balanceMap.set(destKey, { quantity: 0, totalCost: 0 });
          }
          const destBalance = balanceMap.get(destKey)!;
          destBalance.quantity += qty;
          destBalance.totalCost += cost;
        }
      }
    }

    // Update balances in the database
    let updated = 0;
    for (const [key, balance] of balanceMap) {
      const [productId, locationId] = key.split(':');
      const avgCost = balance.quantity > 0 ? balance.totalCost / balance.quantity : 0;

      await this.prisma.stockBalance.upsert({
        where: {
          productId_locationId: { productId, locationId },
        },
        create: {
          companyId,
          productId,
          locationId,
          quantity: Math.max(0, balance.quantity),
          availableQuantity: Math.max(0, balance.quantity),
          averageCost: avgCost,
          totalCost: Math.max(0, balance.totalCost),
          lastMovementAt: new Date(),
        },
        update: {
          quantity: Math.max(0, balance.quantity),
          availableQuantity: Math.max(0, balance.quantity),
          averageCost: avgCost,
          totalCost: Math.max(0, balance.totalCost),
          lastMovementAt: new Date(),
        },
      });
      updated++;
    }

    return { recalculated: updated };
  }
}
