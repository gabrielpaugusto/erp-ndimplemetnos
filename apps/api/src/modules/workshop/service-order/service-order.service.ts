import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';
import { IntegrationService } from '@/modules/core/integration/integration.service';
import { DocumentEventService } from '@/modules/core/audit/document-event.service';
import { StockReservationService } from '@/modules/core/stock-reservation/stock-reservation.service';
import { CreateServiceOrderDto } from './dto/create-service-order.dto';
import { UpdateServiceOrderDto } from './dto/update-service-order.dto';

@Injectable()
export class ServiceOrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly integration: IntegrationService,
    private readonly documentEvents: DocumentEventService,
    private readonly stockReservations: StockReservationService,
  ) {}

  async findAll(
    companyId: string,
    query: {
      search?: string;
      status?: string;
      type?: string;
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
        { veiculoDescricao: { contains: query.search, mode: 'insensitive' } },
        { veiculoPlaca: { contains: query.search, mode: 'insensitive' } },
        { defeitoRelatado: { contains: query.search, mode: 'insensitive' } },
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

    if (query.type) {
      where.type = query.type;
    }

    if (query.priority) {
      where.priority = query.priority;
    }

    if (query.startDate || query.endDate) {
      where.dataEntrada = {};
      if (query.startDate) {
        where.dataEntrada.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        where.dataEntrada.lte = new Date(query.endDate);
      }
    }

    const [data, total] = await Promise.all([
      this.prisma.serviceOrder.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ createdAt: 'desc' }],
        include: {
          person: {
            select: { id: true, razaoSocial: true, cpfCnpj: true },
          },
        },
      }),
      this.prisma.serviceOrder.count({ where }),
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
    const order = await this.prisma.serviceOrder.findUnique({
      where: { id },
      include: {
        person: {
          select: { id: true, razaoSocial: true, cpfCnpj: true, nomeFantasia: true },
        },
        responsavel: {
          select: { id: true, name: true },
        },
        items: {
          include: {
            product: {
              select: { id: true, description: true, code: true, unit: true },
            },
          },
        },
        requisitions: {
          select: { id: true, numero: true, status: true, type: true, createdAt: true },
        },
        calderariaOrders: {
          select: { id: true, numero: true, status: true, serviceType: true, createdAt: true },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Service Order ${id} not found`);
    }

    return order;
  }

  async create(companyId: string, data: CreateServiceOrderDto) {
    const numero = await this.generateNumero(companyId);

    return this.prisma.$transaction(async (tx) => {
      const items = data.items || [];

      const valorPecas = items
        .filter((i) => i.type === 'PECA')
        .reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);

      const valorMaoDeObra = items
        .filter((i) => i.type === 'SERVICO')
        .reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);

      const valorTerceiros = items
        .filter((i) => i.type === 'TERCEIRO')
        .reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);

      const valorTotal = valorPecas + valorMaoDeObra + valorTerceiros;

      const order = await tx.serviceOrder.create({
        data: {
          companyId,
          numero,
          personId: data.personId,
          type: data.type as any,
          priority: (data.priority || 'NORMAL') as any,
          veiculoDescricao: data.veiculoDescricao,
          veiculoPlaca: data.veiculoPlaca,
          veiculoChassi: data.veiculoChassi,
          veiculoKm: data.veiculoKm,
          defeitoRelatado: data.defeitoRelatado,
          dataEntrada: new Date(data.dataEntrada),
          dataPrevisao: data.dataPrevisao ? new Date(data.dataPrevisao) : null,
          observations: data.observations,
          valorPecas,
          valorMaoDeObra,
          valorTotal,
          status: 'ABERTA' as any,
          items: items.length > 0
            ? {
                create: items.map((item) => ({
                  productId: item.productId || null,
                  description: item.description,
                  quantity: item.quantity,
                  unitPrice: item.unitPrice,
                  totalPrice: item.quantity * item.unitPrice,
                  type: item.type as any,
                })),
              }
            : undefined,
        },
        include: {
          person: {
            select: { id: true, razaoSocial: true, cpfCnpj: true },
          },
          items: true,
        },
      });

      return order;
    });
  }

  async update(id: string, data: UpdateServiceOrderDto) {
    const existing = await this.prisma.serviceOrder.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Service Order ${id} not found`);
    }

    const updateData: any = { ...data };
    delete updateData.items;

    if (data.dataEntrada) {
      updateData.dataEntrada = new Date(data.dataEntrada);
    }
    if (data.dataPrevisao) {
      updateData.dataPrevisao = new Date(data.dataPrevisao);
    }
    if (data.dataConclusao) {
      updateData.dataConclusao = new Date(data.dataConclusao);
    }
    if (data.dataEntrega) {
      updateData.dataEntrega = new Date(data.dataEntrega);
    }

    // Recalculate total if valor fields changed
    if (data.valorPecas !== undefined || data.valorMaoDeObra !== undefined) {
      const pecas = data.valorPecas ?? (existing as any).valorPecas ?? 0;
      const mao = data.valorMaoDeObra ?? (existing as any).valorMaoDeObra ?? 0;
      updateData.valorTotal = pecas + mao;
    }

    return this.prisma.serviceOrder.update({
      where: { id },
      data: updateData,
      include: {
        person: {
          select: { id: true, razaoSocial: true, cpfCnpj: true },
        },
        items: true,
      },
    });
  }

  /**
   * Start: ABERTA -> EM_EXECUCAO
   */
  async start(id: string) {
    const order = await this.prisma.serviceOrder.findUnique({ where: { id } });

    if (!order) {
      throw new NotFoundException(`Service Order ${id} not found`);
    }

    if (order.status !== 'ABERTA') {
      throw new BadRequestException(
        `Cannot start order with status ${order.status}. Expected ABERTA.`,
      );
    }

    return this.prisma.serviceOrder.update({
      where: { id },
      data: { status: 'EM_EXECUCAO' as any },
      include: {
        person: { select: { id: true, razaoSocial: true } },
      },
    });
  }

  /**
   * Wait parts: EM_EXECUCAO -> AGUARDANDO_PECAS
   */
  async waitParts(id: string) {
    const order = await this.prisma.serviceOrder.findUnique({ where: { id } });

    if (!order) {
      throw new NotFoundException(`Service Order ${id} not found`);
    }

    if (order.status !== 'EM_EXECUCAO') {
      throw new BadRequestException(
        `Cannot set wait-parts on order with status ${order.status}. Expected EM_EXECUCAO.`,
      );
    }

    return this.prisma.serviceOrder.update({
      where: { id },
      data: { status: 'AGUARDANDO_PECAS' as any },
      include: {
        person: { select: { id: true, razaoSocial: true } },
      },
    });
  }

  /**
   * Complete: EM_EXECUCAO | AGUARDANDO_PECAS -> CONCLUIDA
   */
  async complete(id: string) {
    const order = await this.prisma.serviceOrder.findUnique({ where: { id } });

    if (!order) {
      throw new NotFoundException(`Service Order ${id} not found`);
    }

    if (order.status !== 'EM_EXECUCAO' && order.status !== 'AGUARDANDO_PECAS') {
      throw new BadRequestException(
        `Cannot complete order with status ${order.status}. Expected EM_EXECUCAO or AGUARDANDO_PECAS.`,
      );
    }

    return this.prisma.serviceOrder.update({
      where: { id },
      data: {
        status: 'CONCLUIDA' as any,
        dataConclusao: new Date(),
      },
      include: {
        person: { select: { id: true, razaoSocial: true } },
      },
    });
  }

  /**
   * Deliver: CONCLUIDA -> ENTREGUE
   */
  async deliver(id: string) {
    const order = await this.prisma.serviceOrder.findUnique({ where: { id } });

    if (!order) {
      throw new NotFoundException(`Service Order ${id} not found`);
    }

    if (order.status !== 'CONCLUIDA') {
      throw new BadRequestException(
        `Cannot deliver order with status ${order.status}. Expected CONCLUIDA.`,
      );
    }

    const result = await this.prisma.serviceOrder.update({
      where: { id },
      data: {
        status: 'ENTREGUE' as any,
        dataEntrega: new Date(),
      },
      include: {
        person: { select: { id: true, razaoSocial: true } },
      },
    });

    // Fire integration (non-blocking)
    this.integration.onServiceOrderDelivered(id, order.companyId, 'system').catch(err => console.error('Integration error:', err));

    return result;
  }

  /**
   * Cancel: any active status -> CANCELADA
   */
  async cancel(id: string) {
    const order = await this.prisma.serviceOrder.findUnique({ where: { id } });

    if (!order) {
      throw new NotFoundException(`Service Order ${id} not found`);
    }

    if (order.status === 'ENTREGUE' || order.status === 'CANCELADA') {
      throw new BadRequestException(
        `Cannot cancel order with status ${order.status}.`,
      );
    }

    return this.prisma.serviceOrder.update({
      where: { id },
      data: { status: 'CANCELADA' as any },
      include: {
        person: { select: { id: true, razaoSocial: true } },
      },
    });
  }

  async getStats(companyId: string) {
    const [byStatus, byType, byPriority] = await Promise.all([
      this.prisma.serviceOrder.groupBy({
        by: ['status'],
        where: { companyId },
        _count: { id: true },
      }),
      this.prisma.serviceOrder.groupBy({
        by: ['type'],
        where: { companyId },
        _count: { id: true },
      }),
      this.prisma.serviceOrder.groupBy({
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
      byType: byType.map((t) => ({
        type: t.type,
        count: t._count.id,
      })),
      byPriority: byPriority.map((p) => ({
        priority: p.priority,
        count: p._count.id,
      })),
    };
  }

  private async generateNumero(companyId: string): Promise<string> {
    const today = new Date();
    const dateStr =
      today.getFullYear().toString() +
      (today.getMonth() + 1).toString().padStart(2, '0') +
      today.getDate().toString().padStart(2, '0');

    const prefix = `OS-${dateStr}-`;

    const lastOrder = await this.prisma.serviceOrder.findFirst({
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

  // ── Sprint 2.3 — Timeline ───────────────────────────────────────────────

  async getTimeline(id: string, companyId: string) {
    return this.documentEvents.getTimeline('ServiceOrder', id, companyId);
  }

  // ── Sprint 2.4 — Reservas de Estoque ───────────────────────────────────

  async getReservas(id: string, companyId: string) {
    return this.stockReservations.listBySource(companyId, 'SERVICE_ORDER', id);
  }
}
