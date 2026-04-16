import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';
import { SaleIntegrationService } from '@/modules/core/integration/sale-integration.service';
import { CreateSaleOrderDto } from './dto/create-sale-order.dto';
import { UpdateSaleOrderDto } from './dto/update-sale-order.dto';
import { CreateSaleOrderItemDto } from './dto/create-sale-order-item.dto';

@Injectable()
export class SaleOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly saleIntegration: SaleIntegrationService,
  ) {}

  async findAll(
    companyId: string,
    query: {
      search?: string;
      status?: string;
      saleType?: string;
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
        { numero: !isNaN(Number(query.search)) ? Number(query.search) : undefined },
      ].filter((condition) => {
        if ('numero' in condition && condition.numero === undefined) return false;
        return true;
      });
      if (where.OR.length === 0) delete where.OR;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.saleType) {
      where.saleType = query.saleType;
    }

    const [data, total] = await Promise.all([
      this.prisma.saleOrder.findMany({
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
          _count: { select: { items: true } },
        },
      }),
      this.prisma.saleOrder.count({ where }),
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
    const order = await this.prisma.saleOrder.findUnique({
      where: { id },
      include: {
        person: true,
        vendedor: {
          select: { id: true, name: true, email: true },
        },
        fabricante: {
          select: { id: true, razaoSocial: true, nomeFantasia: true },
        },
        quotation: {
          select: { id: true, numero: true, status: true },
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                code: true,
                description: true,
                unit: true,
              },
            },
            cfop: {
              select: { id: true, code: true, description: true },
            },
          },
        },
        nfeDocuments: {
          select: { id: true, numero: true, serie: true, status: true, chaveAcesso: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Sale order ${id} not found`);
    }

    return order;
  }

  async create(companyId: string, data: CreateSaleOrderDto) {
    // Auto-generate numero
    const maxNumero = await this.prisma.saleOrder.aggregate({
      where: { companyId },
      _max: { numero: true },
    });
    const nextNumero = (maxNumero._max.numero || 0) + 1;

    // Calculate item totals
    const items = (data.items || []).map((item) => {
      const desconto = item.desconto || 0;
      const total =
        Number(item.quantidade) * Number(item.precoUnitario) - desconto;
      return { ...item, total };
    });

    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    const descontoTotal = items.reduce(
      (sum, item) => sum + (item.desconto || 0),
      0,
    );

    return this.prisma.saleOrder.create({
      data: {
        companyId,
        numero: nextNumero,
        personId: data.personId,
        saleType: (data.saleType as any) || 'ESTOQUE_PROPRIO',
        condicaoPagamento: data.condicaoPagamento,
        prazoEntrega: data.prazoEntrega,
        observacoes: data.observacoes,
        vendedorId: data.vendedorId,
        comissaoPercent: data.comissaoPercent,
        fabricanteId: data.fabricanteId,
        costCenterCode: data.costCenterCode as any,
        subtotal,
        desconto: descontoTotal,
        total: subtotal,
        items: items.length > 0
          ? {
              create: items.map((item, index) => ({
                productId: item.productId,
                quantidade: item.quantidade,
                precoUnitario: item.precoUnitario,
                desconto: item.desconto || 0,
                total: item.total,
                sequencia: index + 1,
                cfopId: item.cfopId,
                observacoes: item.observacoes,
              })),
            }
          : undefined,
      },
      include: {
        person: true,
        items: { include: { product: true } },
      },
    });
  }

  async update(id: string, data: UpdateSaleOrderDto) {
    const existing = await this.prisma.saleOrder.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Sale order ${id} not found`);
    }

    const { items, ...updateData } = data;

    return this.prisma.saleOrder.update({
      where: { id },
      data: updateData as any,
      include: {
        person: true,
        items: { include: { product: true } },
      },
    });
  }

  async approve(id: string, userId: string) {
    const order = await this.prisma.saleOrder.findUnique({ where: { id } });
    if (!order) {
      throw new NotFoundException(`Sale order ${id} not found`);
    }

    if (order.status !== 'RASCUNHO' && order.status !== 'PENDENTE_APROVACAO') {
      throw new BadRequestException(
        `Cannot approve order with status ${order.status}`,
      );
    }

    return this.prisma.saleOrder.update({
      where: { id },
      data: {
        status: 'APROVADO',
        dataAprovacao: new Date(),
      },
      include: {
        person: true,
        items: { include: { product: true } },
      },
    });
  }

  async cancel(id: string, userId: string) {
    const order = await this.prisma.saleOrder.findUnique({ where: { id } });
    if (!order) {
      throw new NotFoundException(`Sale order ${id} not found`);
    }

    if (order.status === 'CANCELADO') {
      throw new BadRequestException('Order is already cancelled');
    }

    if (order.status === 'FATURADO' || order.status === 'ENTREGUE') {
      throw new BadRequestException(
        `Cannot cancel order with status ${order.status}`,
      );
    }

    return this.prisma.saleOrder.update({
      where: { id },
      data: {
        status: 'CANCELADO',
        dataCancelamento: new Date(),
      },
      include: {
        person: true,
        items: { include: { product: true } },
      },
    });
  }

  async addItem(orderId: string, data: CreateSaleOrderItemDto) {
    const order = await this.prisma.saleOrder.findUnique({
      where: { id: orderId },
    });
    if (!order) {
      throw new NotFoundException(`Sale order ${orderId} not found`);
    }

    const desconto = data.desconto || 0;
    const total =
      Number(data.quantidade) * Number(data.precoUnitario) - desconto;

    // Get next sequencia
    const maxSeq = await this.prisma.saleOrderItem.aggregate({
      where: { saleOrderId: orderId },
      _max: { sequencia: true },
    });
    const nextSeq = (maxSeq._max.sequencia || 0) + 1;

    const item = await this.prisma.saleOrderItem.create({
      data: {
        saleOrderId: orderId,
        productId: data.productId,
        quantidade: data.quantidade,
        precoUnitario: data.precoUnitario,
        desconto,
        total,
        sequencia: nextSeq,
        cfopId: data.cfopId,
        observacoes: data.observacoes,
      },
      include: { product: true },
    });

    await this.recalculate(orderId);

    return item;
  }

  async removeItem(itemId: string) {
    const item = await this.prisma.saleOrderItem.findUnique({
      where: { id: itemId },
    });
    if (!item) {
      throw new NotFoundException(`Sale order item ${itemId} not found`);
    }

    await this.prisma.saleOrderItem.delete({ where: { id: itemId } });
    await this.recalculate(item.saleOrderId);

    return { deleted: true };
  }

  /**
   * Faturar — transitions SaleOrder to FATURADO and triggers all
   * automatic integrations (contas a receber, estoque, fiscal, contábil, DRE).
   */
  async faturar(companyId: string, orderId: string, nfeId: string, userId: string) {
    const order = await this.prisma.saleOrder.findFirst({
      where: { id: orderId, companyId },
    });
    if (!order) throw new NotFoundException(`SaleOrder ${orderId} not found`);
    if (order.status === 'FATURADO') throw new BadRequestException('Pedido já faturado');
    if (order.status === 'CANCELADO') throw new BadRequestException('Pedido cancelado não pode ser faturado');

    // Mark as faturado
    const updated = await this.prisma.saleOrder.update({
      where: { id: orderId },
      data: {
        status: 'FATURADO',
        dataFaturamento: new Date(),
      },
      include: {
        items: true,
        person: { select: { id: true, razaoSocial: true } },
      },
    });

    // Trigger integrations (non-blocking on error — order is already marked)
    this.saleIntegration.onSaleOrderFaturado(orderId, nfeId, userId).catch(() => {});

    return updated;
  }

  private async recalculate(orderId: string) {
    const items = await this.prisma.saleOrderItem.findMany({
      where: { saleOrderId: orderId },
    });

    const subtotal = items.reduce(
      (sum, item) => sum + Number(item.total),
      0,
    );
    const descontoTotal = items.reduce(
      (sum, item) => sum + Number(item.desconto),
      0,
    );

    return this.prisma.saleOrder.update({
      where: { id: orderId },
      data: {
        subtotal,
        desconto: descontoTotal,
        total: subtotal,
      },
    });
  }
}
