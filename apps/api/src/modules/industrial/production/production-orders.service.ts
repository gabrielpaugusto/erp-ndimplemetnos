import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';
import { IntegrationService } from '@/modules/core/integration/integration.service';
import { DocumentEventService } from '@/modules/core/audit/document-event.service';
import { StockReservationService } from '@/modules/core/stock-reservation/stock-reservation.service';
import { BomOverrideService } from '@/modules/industrial/pcp/bom-override.service';
import { CreateProductionOrderDto } from './dto/create-production-order.dto';
import { UpdateProductionOrderDto } from './dto/update-production-order.dto';
import { ApontarConsumoDto } from './dto/apontar-consumo.dto';

@Injectable()
export class ProductionOrdersService {
  private readonly logger = new Logger(ProductionOrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly integration: IntegrationService,
    private readonly documentEvents: DocumentEventService,
    private readonly stockReservations: StockReservationService,
    private readonly bomOverride: BomOverrideService,
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
  async release(id: string, userId?: string) {
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

      const released = await tx.productionOrder.update({
        where: { id },
        data: {
          status: 'LIBERADA' as any,
          bomVersion: bom?.version ?? null,
          bomSnapshot: bom ? ({
            bomId: bom.id,
            version: bom.version,
            productId: bom.productId,
            capturedAt: new Date().toISOString(),
            items: bom.items.map(item => ({
              productId: item.productId,
              quantity: item.quantity,
              unit: item.unit,
              wastagePercent: item.wastagePercent,
            })),
          } as any) : null,
        },
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

      // Calcular necessidade líquida para cada item
      const necessidades = await Promise.all(
        (bom?.items || []).map(async (item) => {
          const necessidadeBruta = item.quantity * order.quantity * (1 + (item.wastagePercent || 0) / 100);

          const balances = await tx.stockBalance.findMany({
            where: { productId: item.productId, companyId: order.companyId },
          });
          const estoqueDisponivel = balances.reduce((sum, b) => sum + Number(b.availableQuantity), 0);

          const necessidadeLiquida = Math.max(0, necessidadeBruta - estoqueDisponivel);

          const produto = await tx.product.findUnique({
            where: { id: item.productId },
            select: { code: true, description: true, unit: true },
          });

          return {
            productId: item.productId,
            code: produto?.code,
            description: produto?.description,
            unit: item.unit,
            necessidadeBruta: Math.round(necessidadeBruta * 10000) / 10000,
            estoqueDisponivel: Math.round(estoqueDisponivel * 10000) / 10000,
            necessidadeLiquida: Math.round(necessidadeLiquida * 10000) / 10000,
            precisaComprar: necessidadeLiquida > 0,
          };
        })
      );

      // Reservas de estoque e timeline são criadas fora da transação
      // para não aumentar o lock time do banco
      setImmediate(() => {
        this._postRelease(
          order.companyId,
          id,
          bom?.items ?? [],
          order.quantity,
          userId,
        ).catch((e) => {
          this.logger.warn(`[OP ${id}] Erro no pós-release: ${(e as Error)?.message ?? e}`);
        });
      });

      return { ...released, necessidades };
    });
  }

  /**
   * Ação pós-release: cria reservas de estoque e registra na timeline.
   * Chamado após o commit da transação de release().
   * @internal
   */
  private async _postRelease(
    companyId: string,
    opId: string,
    bomItems: Array<{ productId: string; quantity: number; unit: string; wastagePercent?: number | null }>,
    opQuantity: number,
    userId?: string,
  ) {
    // Busca localização padrão (ALMOXARIFADO ou primeira disponível)
    const defaultLocation = await this.prisma.stockLocation.findFirst({
      where: { companyId, active: true },
      orderBy: { createdAt: 'asc' },
    });

    if (!defaultLocation) {
      this.logger.warn(`[OP ${opId}] Nenhuma localização de estoque encontrada — reservas não criadas`);
      return;
    }

    const items = bomItems.map((item) => ({
      productId:  item.productId,
      locationId: defaultLocation.id,
      quantity:   item.quantity * opQuantity * (1 + (item.wastagePercent ?? 0) / 100),
    }));

    const summary = await this.stockReservations.createReservations({
      companyId,
      sourceType: 'PRODUCTION_ORDER',
      sourceId:   opId,
      items,
      userId,
    });

    if (summary.insufficient.length > 0) {
      this.logger.warn(
        `[OP ${opId}] ${summary.insufficient.length} item(ns) com saldo insuficiente para reserva`,
      );
    }

    // Timeline: liberação da OP
    this.documentEvents.record({
      companyId,
      entityType: 'ProductionOrder',
      entityId:   opId,
      eventType:  'STATUS_MUDOU',
      oldValue:   'PLANEJADA',
      newValue:   'LIBERADA',
      description: `OP liberada — ${summary.reserved} reserva(s) de estoque criada(s)${summary.insufficient.length > 0 ? ` — ⚠️ ${summary.insufficient.length} item(ns) com estoque insuficiente` : ''}`,
      userId,
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

  async getNecessidades(id: string, companyId: string) {
    const order = await this.prisma.productionOrder.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: { select: { code: true, description: true, unit: true } },
          },
        },
      },
    });

    if (!order) throw new NotFoundException('Ordem não encontrada');

    const necessidades = await Promise.all(
      order.items.map(async (item) => {
        const balances = await this.prisma.stockBalance.findMany({
          where: { productId: item.productId, companyId },
        });
        const estoqueDisponivel = balances.reduce((sum, b) => sum + Number(b.availableQuantity), 0);
        const necessidadeLiquida = Math.max(0, Number(item.quantityRequired) - estoqueDisponivel);

        return {
          productId: item.productId,
          code: item.product.code,
          description: item.product.description,
          unit: item.unit,
          quantityRequired: Number(item.quantityRequired),
          quantityConsumed: Number(item.quantityConsumed),
          estoqueDisponivel,
          necessidadeLiquida,
          precisaComprar: necessidadeLiquida > 0,
        };
      })
    );

    return {
      orderId: id,
      numero: order.numero,
      necessidades,
      totalItensNecessitamCompra: necessidades.filter(n => n.precisaComprar).length,
    };
  }

  /**
   * A9 — Apontamento de consumo real por OP (Bloco K)
   * Registra quanto de cada insumo foi consumido e, opcionalmente,
   * quanto do produto acabado foi produzido neste apontamento parcial.
   */
  async apontarConsumoReal(
    id: string,
    companyId: string,
    userId: string,
    dto: ApontarConsumoDto,
  ) {
    const order = await this.prisma.productionOrder.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: {
              select: { id: true, code: true, description: true, unit: true, controlaEstoque: true },
            },
          },
        },
      },
    });

    if (!order) throw new NotFoundException('Ordem de produção não encontrada');
    if (order.companyId !== companyId) throw new NotFoundException('Ordem de produção não encontrada');

    if (order.status !== 'EM_PRODUCAO' && order.status !== 'LIBERADA') {
      throw new BadRequestException(
        `Não é possível apontar consumo em OP com status ${order.status}. Esperado: EM_PRODUCAO ou LIBERADA.`,
      );
    }

    // Find default stock location (PRODUCAO type first, then ALMOXARIFADO)
    const stockLocation = await this.prisma.stockLocation.findFirst({
      where: { companyId, type: { in: ['PRODUCAO', 'ALMOXARIFADO'] as any } },
      orderBy: { type: 'asc' }, // ALMOXARIFADO < PRODUCAO alphabetically — PRODUCAO preferred
    }) ?? await this.prisma.stockLocation.findFirst({
      where: { companyId, type: 'ALMOXARIFADO' as any },
    });

    const result = await this.prisma.$transaction(async (tx) => {
      const apontamentos: any[] = [];

      for (const consumoItem of dto.items) {
        // Find matching OP item
        const opItem = order.items.find((i) => i.productId === consumoItem.productId);

        if (!opItem) {
          throw new BadRequestException(
            `Produto ${consumoItem.productId} não faz parte desta OP.`,
          );
        }

        // Accumulate quantityConsumed on the OP item
        const novoConsumo = Number(opItem.quantityConsumed) + consumoItem.quantityConsumed;

        await tx.productionOrderItem.update({
          where: { id: opItem.id },
          data: { quantityConsumed: novoConsumo },
        });

        apontamentos.push({
          productId: consumoItem.productId,
          code: opItem.product.code,
          description: opItem.product.description,
          quantityConsumedThisEntry: consumoItem.quantityConsumed,
          quantityConsumedTotal: novoConsumo,
          quantityRequired: Number(opItem.quantityRequired),
        });

        // Create stock exit (SAIDA, PRODUCAO) if product controls stock
        if (opItem.product.controlaEstoque && stockLocation) {
          await tx.stockMovement.create({
            data: {
              companyId,
              productId: consumoItem.productId,
              locationId: stockLocation.id,
              type: 'SAIDA' as any,
              source: 'PRODUCAO' as any,
              quantity: consumoItem.quantityConsumed,
              documentNumber: order.numero,
              productionOrderId: order.id,
              userId,
            },
          });

          // Update stock balance
          await tx.stockBalance.upsert({
            where: {
              productId_locationId: {
                productId: consumoItem.productId,
                locationId: stockLocation.id,
              },
            },
            create: {
              companyId,
              productId: consumoItem.productId,
              locationId: stockLocation.id,
              quantity: 0,
              availableQuantity: 0,
              averageCost: 0,
              totalCost: 0,
              lastMovementAt: new Date(),
            },
            update: {
              quantity: { decrement: consumoItem.quantityConsumed },
              availableQuantity: { decrement: consumoItem.quantityConsumed },
              lastMovementAt: new Date(),
            },
          });
        }
      }

      // Optionally increment quantityProduced on the OP
      let updatedOrder = order as any;
      if (dto.quantityProduced && dto.quantityProduced > 0) {
        updatedOrder = await tx.productionOrder.update({
          where: { id },
          data: {
            quantityProduced: { increment: dto.quantityProduced } as any,
          },
        });
      }

      return {
        orderId: id,
        numero: order.numero,
        quantityOrdered: Number(order.quantity),
        quantityProducedAccumulated: Number((updatedOrder as any).quantityProduced ?? 0) + (dto.quantityProduced ?? 0),
        apontamentos,
        message: `Consumo apontado: ${dto.items.length} insumo(s)${dto.quantityProduced ? `, ${dto.quantityProduced} unidades produzidas` : ''}.`,
      };
    });

    return result;
  }

  /**
   * A9 — Leitura do consumo acumulado da OP (Bloco K)
   */
  async getConsumo(id: string, companyId: string) {
    const order = await this.prisma.productionOrder.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: {
              select: { id: true, code: true, description: true, unit: true },
            },
          },
        },
      },
    });

    if (!order) throw new NotFoundException('Ordem de produção não encontrada');
    if (order.companyId !== companyId) throw new NotFoundException('Ordem de produção não encontrada');

    const consumo = order.items.map((item) => {
      const qtdRequerida = Number(item.quantityRequired);
      const qtdConsumida = Number(item.quantityConsumed);
      const percentual = qtdRequerida > 0 ? (qtdConsumida / qtdRequerida) * 100 : 0;

      return {
        productId: item.productId,
        code: item.product.code,
        description: item.product.description,
        unit: item.unit,
        quantityRequired: qtdRequerida,
        quantityConsumed: qtdConsumida,
        percentualConsumido: Math.round(percentual * 100) / 100,
        saldo: qtdRequerida - qtdConsumida,
      };
    });

    return {
      orderId: id,
      numero: order.numero,
      status: order.status,
      quantityOrdered: Number(order.quantity),
      quantityProduced: Number((order as any).quantityProduced ?? 0),
      consumo,
    };
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

  // ── Sprint 2.3 — Timeline ───────────────────────────────────────────────

  async getTimeline(id: string, companyId: string) {
    return this.documentEvents.getTimeline('ProductionOrder', id, companyId);
  }

  // ── Sprint 2.4 — Reservas de Estoque ───────────────────────────────────

  async getReservas(id: string, companyId: string) {
    return this.stockReservations.listBySource(companyId, 'PRODUCTION_ORDER', id);
  }

  // ── Sprint 3.1 — BOM Customizada ────────────────────────────────────────

  async getBomEfetiva(id: string, companyId: string) {
    return this.bomOverride.resolveEffectiveBom(id, companyId);
  }

  async getBomDiff(id: string, companyId: string) {
    return this.bomOverride.getDiff(id, companyId);
  }

  async upsertBomOverride(id: string, companyId: string, userId: string, dto: any) {
    return this.bomOverride.upsertForProductionOrder(id, companyId, userId, dto);
  }
}
