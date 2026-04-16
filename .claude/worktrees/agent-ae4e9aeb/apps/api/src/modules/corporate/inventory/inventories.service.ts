import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';
import { CreateInventoryDto } from './dto/create-inventory.dto';
import { CountInventoryItemDto } from './dto/count-inventory-item.dto';

@Injectable()
export class InventoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    companyId: string,
    query: {
      search?: string;
      status?: string;
      locationId?: string;
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
      ];
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.locationId) {
      where.locationId = query.locationId;
    }

    const [data, total] = await Promise.all([
      this.prisma.inventory.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          location: {
            select: { id: true, code: true, name: true },
          },
          responsavel: {
            select: { id: true, name: true },
          },
          _count: {
            select: { items: true },
          },
        },
      }),
      this.prisma.inventory.count({ where }),
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
    const inventory = await this.prisma.inventory.findUnique({
      where: { id },
      include: {
        location: {
          select: { id: true, code: true, name: true, type: true },
        },
        responsavel: {
          select: { id: true, name: true, email: true },
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

    if (!inventory) {
      throw new NotFoundException(`Inventory ${id} not found`);
    }

    return inventory;
  }

  async create(companyId: string, userId: string, data: CreateInventoryDto) {
    const numero = await this.generateNumero(companyId);

    // Get current stock balances for the requested products at the given location
    const balances = await this.prisma.stockBalance.findMany({
      where: {
        companyId,
        locationId: data.locationId,
        productId: { in: data.items.map((i) => i.productId) },
      },
    });

    const balanceMap = new Map(
      balances.map((b) => [b.productId, b]),
    );

    return this.prisma.inventory.create({
      data: {
        companyId,
        numero,
        locationId: data.locationId,
        description: data.description,
        observations: data.observations,
        dataInicio: new Date(),
        responsavelId: userId,
        status: 'PLANEJADO' as any,
        items: {
          create: data.items.map((item) => {
            const balance = balanceMap.get(item.productId);
            const quantidadeSistema = balance ? Number(balance.quantity) : 0;
            const custoUnitario = balance ? Number(balance.averageCost) : 0;
            return {
              productId: item.productId,
              quantidadeSistema,
              custoUnitario,
            };
          }),
        },
      },
      include: {
        location: {
          select: { id: true, code: true, name: true },
        },
        responsavel: {
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

  async start(id: string) {
    const inventory = await this.prisma.inventory.findUnique({
      where: { id },
    });

    if (!inventory) {
      throw new NotFoundException(`Inventory ${id} not found`);
    }

    if (inventory.status !== 'PLANEJADO') {
      throw new BadRequestException(
        `Cannot start inventory with status ${inventory.status}. Expected PLANEJADO.`,
      );
    }

    return this.prisma.inventory.update({
      where: { id },
      data: {
        status: 'EM_ANDAMENTO' as any,
        dataInicio: new Date(),
      },
      include: {
        location: { select: { id: true, code: true, name: true } },
        responsavel: { select: { id: true, name: true } },
      },
    });
  }

  async countItem(id: string, itemId: string, data: CountInventoryItemDto) {
    const inventory = await this.prisma.inventory.findUnique({
      where: { id },
    });

    if (!inventory) {
      throw new NotFoundException(`Inventory ${id} not found`);
    }

    if (inventory.status !== 'EM_ANDAMENTO') {
      throw new BadRequestException(
        `Cannot count items on inventory with status ${inventory.status}. Expected EM_ANDAMENTO.`,
      );
    }

    const item = await this.prisma.inventoryItem.findUnique({
      where: { id: itemId },
    });

    if (!item || item.inventoryId !== id) {
      throw new NotFoundException(
        `Inventory item ${itemId} not found in this inventory.`,
      );
    }

    const diferenca = data.quantidadeContada - Number(item.quantidadeSistema);
    const valorDiferenca = diferenca * Number(item.custoUnitario);

    return this.prisma.inventoryItem.update({
      where: { id: itemId },
      data: {
        quantidadeContada: data.quantidadeContada,
        diferenca,
        valorDiferenca,
        justificativa: data.justificativa,
      },
      include: {
        product: {
          select: { id: true, code: true, description: true, unit: true },
        },
      },
    });
  }

  async finish(id: string, userId: string) {
    const inventory = await this.prisma.inventory.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!inventory) {
      throw new NotFoundException(`Inventory ${id} not found`);
    }

    if (inventory.status !== 'EM_ANDAMENTO') {
      throw new BadRequestException(
        `Cannot finish inventory with status ${inventory.status}. Expected EM_ANDAMENTO.`,
      );
    }

    // Check all items have been counted
    const uncounted = inventory.items.filter((i) => i.quantidadeContada === null);
    if (uncounted.length > 0) {
      throw new BadRequestException(
        `Cannot finish inventory. ${uncounted.length} items have not been counted yet.`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // Generate stock movements for differences
      for (const item of inventory.items) {
        const diferenca = Number(item.diferenca);
        if (diferenca === 0) continue;

        const movType = diferenca > 0 ? 'AJUSTE_POSITIVO' : 'AJUSTE_NEGATIVO';
        const absQuantity = Math.abs(diferenca);

        await tx.stockMovement.create({
          data: {
            companyId: inventory.companyId,
            productId: item.productId,
            locationId: inventory.locationId,
            type: movType as any,
            source: 'INVENTARIO' as any,
            quantity: absQuantity,
            unitCost: item.custoUnitario,
            totalCost: absQuantity * Number(item.custoUnitario),
            documentNumber: inventory.numero,
            userId,
            observations: `Ajuste de inventario ${inventory.numero}. ${item.justificativa || ''}`.trim(),
          },
        });

        // Update stock balance
        await tx.stockBalance.upsert({
          where: {
            productId_locationId: {
              productId: item.productId,
              locationId: inventory.locationId,
            },
          },
          create: {
            companyId: inventory.companyId,
            productId: item.productId,
            locationId: inventory.locationId,
            quantity: Number(item.quantidadeContada),
            availableQuantity: Number(item.quantidadeContada),
            averageCost: item.custoUnitario,
            totalCost: Number(item.quantidadeContada) * Number(item.custoUnitario),
            lastMovementAt: new Date(),
          },
          update: {
            quantity: Number(item.quantidadeContada),
            availableQuantity: Number(item.quantidadeContada),
            lastMovementAt: new Date(),
          },
        });
      }

      return tx.inventory.update({
        where: { id },
        data: {
          status: 'CONCLUIDO' as any,
          dataFim: new Date(),
        },
        include: {
          location: { select: { id: true, code: true, name: true } },
          responsavel: { select: { id: true, name: true } },
          items: {
            include: {
              product: {
                select: { id: true, code: true, description: true, unit: true },
              },
            },
          },
        },
      });
    });
  }

  async cancel(id: string) {
    const inventory = await this.prisma.inventory.findUnique({
      where: { id },
    });

    if (!inventory) {
      throw new NotFoundException(`Inventory ${id} not found`);
    }

    if (inventory.status === 'CONCLUIDO' || inventory.status === 'CANCELADO') {
      throw new BadRequestException(
        `Cannot cancel inventory with status ${inventory.status}.`,
      );
    }

    return this.prisma.inventory.update({
      where: { id },
      data: { status: 'CANCELADO' as any },
      include: {
        location: { select: { id: true, code: true, name: true } },
        responsavel: { select: { id: true, name: true } },
      },
    });
  }

  async getStats(companyId: string) {
    const [byStatus, totalItems] = await Promise.all([
      this.prisma.inventory.groupBy({
        by: ['status'],
        where: { companyId },
        _count: { id: true },
      }),
      this.prisma.inventoryItem.count({
        where: {
          inventory: { companyId },
        },
      }),
    ]);

    return {
      byStatus: byStatus.map((s) => ({
        status: s.status,
        count: s._count.id,
      })),
      totalItems,
    };
  }

  private async generateNumero(companyId: string): Promise<string> {
    const today = new Date();
    const dateStr =
      today.getFullYear().toString() +
      (today.getMonth() + 1).toString().padStart(2, '0') +
      today.getDate().toString().padStart(2, '0');

    const prefix = `INV-${dateStr}-`;

    const last = await this.prisma.inventory.findFirst({
      where: {
        companyId,
        numero: { startsWith: prefix },
      },
      orderBy: { numero: 'desc' },
    });

    let sequence = 1;
    if (last && last.numero) {
      const lastSequence = parseInt(last.numero.replace(prefix, ''), 10);
      if (!isNaN(lastSequence)) {
        sequence = lastSequence + 1;
      }
    }

    return `${prefix}${sequence.toString().padStart(3, '0')}`;
  }
}
