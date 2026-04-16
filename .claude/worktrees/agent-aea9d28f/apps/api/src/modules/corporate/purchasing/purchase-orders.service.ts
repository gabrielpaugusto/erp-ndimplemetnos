import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';
import { IntegrationService } from '@/modules/core/integration/integration.service';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { UpdatePurchaseOrderDto } from './dto/update-purchase-order.dto';
import { ReceiveItemsDto } from './dto/receive-items.dto';

@Injectable()
export class PurchaseOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly integration: IntegrationService,
  ) {}

  async findAll(
    companyId: string,
    query: {
      search?: string;
      status?: string;
      supplierId?: string;
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
        {
          supplier: {
            razaoSocial: { contains: query.search, mode: 'insensitive' },
          },
        },
        {
          supplier: {
            nomeFantasia: { contains: query.search, mode: 'insensitive' },
          },
        },
      ];
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.supplierId) {
      where.supplierId = query.supplierId;
    }

    if (query.startDate || query.endDate) {
      where.dataEmissao = {};
      if (query.startDate) {
        where.dataEmissao.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        where.dataEmissao.lte = new Date(query.endDate);
      }
    }

    const [data, total] = await Promise.all([
      this.prisma.purchaseOrder.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          supplier: {
            select: { id: true, razaoSocial: true, nomeFantasia: true },
          },
          purchaseRequest: {
            select: { id: true, numero: true },
          },
          _count: {
            select: { items: true },
          },
        },
      }),
      this.prisma.purchaseOrder.count({ where }),
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
    const order = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        supplier: {
          select: { id: true, razaoSocial: true, nomeFantasia: true, cpfCnpj: true },
        },
        purchaseRequest: {
          select: { id: true, numero: true, description: true },
        },
        items: {
          include: {
            product: {
              select: { id: true, code: true, description: true, unit: true },
            },
          },
        },
        stockMovements: {
          select: { id: true, type: true, quantity: true, date: true },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Purchase order ${id} not found`);
    }

    return order;
  }

  async create(companyId: string, data: CreatePurchaseOrderDto) {
    const numero = await this.generateNumero(companyId);

    const subtotal = data.items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0,
    );
    const frete = data.frete || 0;
    const desconto = data.desconto || 0;
    const totalValue = subtotal + frete - desconto;

    return this.prisma.purchaseOrder.create({
      data: {
        companyId,
        numero,
        supplierId: data.supplierId,
        purchaseRequestId: data.purchaseRequestId || null,
        dataEntregaPrevista: data.dataEntregaPrevista
          ? new Date(data.dataEntregaPrevista)
          : null,
        condicaoPagamento: data.condicaoPagamento,
        frete,
        desconto,
        subtotal,
        totalValue,
        observations: data.observations,
        status: 'RASCUNHO' as any,
        items: {
          create: data.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            quantityReceived: 0,
            unit: item.unit,
            unitPrice: item.unitPrice,
            totalPrice: item.quantity * item.unitPrice,
            icms: item.icms || 0,
            ipi: item.ipi || 0,
          })),
        },
      },
      include: {
        supplier: {
          select: { id: true, razaoSocial: true, nomeFantasia: true },
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

  async update(id: string, data: UpdatePurchaseOrderDto) {
    const existing = await this.prisma.purchaseOrder.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Purchase order ${id} not found`);
    }

    if (existing.status !== 'RASCUNHO') {
      throw new BadRequestException(
        `Cannot update purchase order with status ${existing.status}. Only RASCUNHO can be edited.`,
      );
    }

    const updateData: any = {};
    if (data.dataEntregaPrevista !== undefined) {
      updateData.dataEntregaPrevista = data.dataEntregaPrevista
        ? new Date(data.dataEntregaPrevista)
        : null;
    }
    if (data.condicaoPagamento !== undefined) updateData.condicaoPagamento = data.condicaoPagamento;
    if (data.frete !== undefined) updateData.frete = data.frete;
    if (data.desconto !== undefined) updateData.desconto = data.desconto;
    if (data.observations !== undefined) updateData.observations = data.observations;

    return this.prisma.purchaseOrder.update({
      where: { id },
      data: updateData,
      include: {
        supplier: {
          select: { id: true, razaoSocial: true, nomeFantasia: true },
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

  async send(id: string) {
    const order = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!order) {
      throw new NotFoundException(`Purchase order ${id} not found`);
    }

    if (order.status !== 'RASCUNHO') {
      throw new BadRequestException(
        `Cannot send purchase order with status ${order.status}. Expected RASCUNHO.`,
      );
    }

    if (order.items.length === 0) {
      throw new BadRequestException('Cannot send purchase order with no items.');
    }

    return this.prisma.purchaseOrder.update({
      where: { id },
      data: { status: 'ENVIADA' as any },
      include: {
        supplier: { select: { id: true, razaoSocial: true, nomeFantasia: true } },
      },
    });
  }

  async confirm(id: string) {
    const order = await this.prisma.purchaseOrder.findUnique({
      where: { id },
    });

    if (!order) {
      throw new NotFoundException(`Purchase order ${id} not found`);
    }

    if (order.status !== 'ENVIADA') {
      throw new BadRequestException(
        `Cannot confirm purchase order with status ${order.status}. Expected ENVIADA.`,
      );
    }

    return this.prisma.purchaseOrder.update({
      where: { id },
      data: { status: 'CONFIRMADA' as any },
      include: {
        supplier: { select: { id: true, razaoSocial: true, nomeFantasia: true } },
      },
    });
  }

  async receive(id: string, userId: string, data: ReceiveItemsDto) {
    const order = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!order) {
      throw new NotFoundException(`Purchase order ${id} not found`);
    }

    if (order.status !== 'CONFIRMADA' && order.status !== 'PARCIAL_RECEBIDA') {
      throw new BadRequestException(
        `Cannot receive items for purchase order with status ${order.status}. Expected CONFIRMADA or PARCIAL_RECEBIDA.`,
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      let allFullyReceived = true;

      for (const receiveItem of data.items) {
        const existingItem = order.items.find((i) => i.id === receiveItem.id);

        if (!existingItem) {
          throw new BadRequestException(
            `Purchase order item ${receiveItem.id} not found in this order.`,
          );
        }

        const newReceived =
          Number(existingItem.quantityReceived) + receiveItem.quantityReceived;

        if (newReceived > Number(existingItem.quantity)) {
          throw new BadRequestException(
            `Total received quantity (${newReceived}) cannot exceed ordered quantity (${existingItem.quantity}) for item ${receiveItem.id}.`,
          );
        }

        await tx.purchaseOrderItem.update({
          where: { id: receiveItem.id },
          data: { quantityReceived: newReceived },
        });

        // Create stock movement for the received quantity
        if (receiveItem.quantityReceived > 0) {
          // Find the first stock location (ALMOXARIFADO) for this company
          const defaultLocation = await tx.stockLocation.findFirst({
            where: { companyId: order.companyId, type: 'ALMOXARIFADO' },
          });

          if (defaultLocation) {
            await tx.stockMovement.create({
              data: {
                companyId: order.companyId,
                productId: existingItem.productId,
                locationId: defaultLocation.id,
                type: 'ENTRADA' as any,
                source: 'COMPRA' as any,
                quantity: receiveItem.quantityReceived,
                unitCost: existingItem.unitPrice,
                totalCost: receiveItem.quantityReceived * Number(existingItem.unitPrice),
                documentNumber: order.numero,
                purchaseOrderId: order.id,
                userId,
              },
            });

            // Update stock balance
            await tx.stockBalance.upsert({
              where: {
                productId_locationId: {
                  productId: existingItem.productId,
                  locationId: defaultLocation.id,
                },
              },
              create: {
                companyId: order.companyId,
                productId: existingItem.productId,
                locationId: defaultLocation.id,
                quantity: receiveItem.quantityReceived,
                availableQuantity: receiveItem.quantityReceived,
                averageCost: existingItem.unitPrice,
                totalCost: receiveItem.quantityReceived * Number(existingItem.unitPrice),
                lastMovementAt: new Date(),
              },
              update: {
                quantity: { increment: receiveItem.quantityReceived },
                availableQuantity: { increment: receiveItem.quantityReceived },
                lastMovementAt: new Date(),
              },
            });
          }
        }

        if (newReceived < Number(existingItem.quantity)) {
          allFullyReceived = false;
        }
      }

      // Check items not in the receive list
      for (const item of order.items) {
        if (!data.items.find((ri) => ri.id === item.id)) {
          if (Number(item.quantityReceived) < Number(item.quantity)) {
            allFullyReceived = false;
          }
        }
      }

      const newStatus = allFullyReceived ? 'RECEBIDA' : 'PARCIAL_RECEBIDA';

      return tx.purchaseOrder.update({
        where: { id },
        data: {
          status: newStatus as any,
          ...(allFullyReceived ? { dataEntregaReal: new Date() } : {}),
        },
        include: {
          supplier: { select: { id: true, razaoSocial: true, nomeFantasia: true } },
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

    // Fire integration (non-blocking)
    this.integration.onPurchaseOrderReceived(id, order.companyId, userId).catch(err => console.error('Integration error:', err));

    return result;
  }

  async cancel(id: string) {
    const order = await this.prisma.purchaseOrder.findUnique({
      where: { id },
    });

    if (!order) {
      throw new NotFoundException(`Purchase order ${id} not found`);
    }

    if (order.status === 'RECEBIDA' || order.status === 'CANCELADA') {
      throw new BadRequestException(
        `Cannot cancel purchase order with status ${order.status}.`,
      );
    }

    return this.prisma.purchaseOrder.update({
      where: { id },
      data: { status: 'CANCELADA' as any },
      include: {
        supplier: { select: { id: true, razaoSocial: true, nomeFantasia: true } },
      },
    });
  }

  async getStats(companyId: string) {
    const [byStatus, totals] = await Promise.all([
      this.prisma.purchaseOrder.groupBy({
        by: ['status'],
        where: { companyId },
        _count: { id: true },
        _sum: { totalValue: true },
      }),
      this.prisma.purchaseOrder.aggregate({
        where: { companyId },
        _count: { id: true },
        _sum: { totalValue: true },
      }),
    ]);

    return {
      byStatus: byStatus.map((s) => ({
        status: s.status,
        count: s._count.id,
        totalValue: s._sum.totalValue,
      })),
      totals: {
        count: totals._count.id,
        totalValue: totals._sum.totalValue,
      },
    };
  }

  private async generateNumero(companyId: string): Promise<string> {
    const today = new Date();
    const dateStr =
      today.getFullYear().toString() +
      (today.getMonth() + 1).toString().padStart(2, '0') +
      today.getDate().toString().padStart(2, '0');

    const prefix = `PC-${dateStr}-`;

    const last = await this.prisma.purchaseOrder.findFirst({
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
