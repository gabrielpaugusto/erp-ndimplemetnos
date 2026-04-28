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
      tipoPagador?: string;
      equipamentoId?: string;
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
        { defeitoRelatado: { contains: query.search, mode: 'insensitive' } },
        { person: { razaoSocial: { contains: query.search, mode: 'insensitive' } } },
        { equipamento: { placa: { contains: query.search, mode: 'insensitive' } } },
        { equipamento: { chassi: { contains: query.search, mode: 'insensitive' } } },
        { equipamento: { serialNumber: { contains: query.search, mode: 'insensitive' } } },
      ];
    }

    if (query.status) where.status = query.status;
    if (query.type) where.type = query.type;
    if (query.priority) where.priority = query.priority;
    if (query.tipoPagador) where.tipoPagador = query.tipoPagador;
    if (query.equipamentoId) where.equipamentoId = query.equipamentoId;

    if (query.startDate || query.endDate) {
      where.dataEntrada = {};
      if (query.startDate) where.dataEntrada.gte = new Date(query.startDate);
      if (query.endDate) where.dataEntrada.lte = new Date(query.endDate);
    }

    const [data, total] = await Promise.all([
      this.prisma.serviceOrder.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ createdAt: 'desc' }],
        include: {
          person: { select: { id: true, razaoSocial: true, cpfCnpj: true } },
          equipamento: {
            select: {
              id: true, tipo: true, placa: true, chassi: true, serialNumber: true,
              marca: true, modelo: true,
              tipoCarroceria: { select: { nome: true } },
            },
          },
          responsavel: { select: { id: true, name: true } },
        },
      }),
      this.prisma.serviceOrder.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const order = await this.prisma.serviceOrder.findUnique({
      where: { id },
      include: {
        person: { select: { id: true, razaoSocial: true, cpfCnpj: true, nomeFantasia: true } },
        equipamento: {
          include: {
            tipoCarroceria: { select: { id: true, nome: true, codigoLegal: true } },
            modeloCarroceria: { select: { id: true, nome: true, fabricante: true } },
            proprietario: { select: { id: true, razaoSocial: true } },
          },
        },
        responsavel: { select: { id: true, name: true } },
        items: {
          include: { product: { select: { id: true, description: true, code: true, unit: true } } },
        },
        osTarefas: {
          orderBy: { ordem: 'asc' },
          include: {
            subtarefas: {
              orderBy: { ordem: 'asc' },
            },
          },
        },
        requisitions: { select: { id: true, numero: true, status: true, type: true, createdAt: true } },
        calderariaOrders: { select: { id: true, numero: true, status: true, serviceType: true, createdAt: true } },
      },
    });

    if (!order) throw new NotFoundException(`OS ${id} não encontrada`);
    return order;
  }

  async create(companyId: string, data: CreateServiceOrderDto) {
    const numero = await this.generateNumero(companyId);

    return this.prisma.$transaction(async (tx) => {
      const items = data.items || [];

      const valorPecas = items.filter((i) => i.tipo === 'PECA').reduce((s, i) => s + i.quantity * i.unitPrice, 0);
      const valorMaoDeObra = items.filter((i) => i.tipo === 'SERVICO').reduce((s, i) => s + i.quantity * i.unitPrice, 0);
      const valorTerceiros = items.filter((i) => i.tipo === 'TERCEIRO').reduce((s, i) => s + i.quantity * i.unitPrice, 0);
      const valorTotal = valorPecas + valorMaoDeObra + valorTerceiros;

      const order = await tx.serviceOrder.create({
        data: {
          companyId,
          numero,
          personId: data.personId,
          type: data.type as any,
          status: 'ORCAMENTO',
          priority: (data.priority || 'NORMAL') as any,
          tipoPagador: (data.tipoPagador || 'CLIENTE') as any,
          equipamentoId: data.equipamentoId || null,
          kmEntrada: data.kmEntrada,
          carroceriaId: data.carroceriaId || null,
          defeitoRelatado: data.defeitoRelatado,
          dataEntrada: new Date(data.dataEntrada),
          dataPrevisao: data.dataPrevisao ? new Date(data.dataPrevisao) : null,
          observations: data.observations,
          valorPecas,
          valorMaoDeObra,
          valorTerceiros,
          valorTotal,
          // Garantia
          garantiaFabricante: data.garantiaFabricante,
          garantiaReembolsaPecas: data.garantiaReembolsaPecas ?? false,
          garantiaReembolsaMO: data.garantiaReembolsaMO ?? false,
          items: items.length > 0
            ? {
                create: items.map((item) => ({
                  productId: item.productId || null,
                  description: item.description,
                  quantity: item.quantity,
                  unitPrice: item.unitPrice,
                  totalPrice: item.quantity * item.unitPrice,
                  tipo: (item.tipo || 'PECA') as any,
                  agregaCustoCarroceria: item.agregaCustoCarroceria ?? (data.type === 'INSTALACAO'),
                  faturavel: item.faturavel ?? true,
                  incluidoNoProduto: item.incluidoNoProduto ?? false,
                })),
              }
            : undefined,
        },
        include: {
          person: { select: { id: true, razaoSocial: true, cpfCnpj: true } },
          equipamento: { select: { id: true, tipo: true, placa: true, chassi: true, serialNumber: true } },
          items: true,
        },
      });

      // Se OS de instalação, atualiza status da carroceria
      if (data.type === 'INSTALACAO' && data.carroceriaId) {
        await tx.equipamento.update({
          where: { id: data.carroceriaId },
          data: { carroceriaStatus: 'AGUARD_INSTALACAO' },
        });
      }

      return order;
    });
  }

  async update(id: string, data: UpdateServiceOrderDto) {
    const existing = await this.prisma.serviceOrder.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`OS ${id} não encontrada`);

    const updateData: any = { ...data };
    delete updateData.items;

    if (data.dataEntrada) updateData.dataEntrada = new Date(data.dataEntrada);
    if (data.dataPrevisao) updateData.dataPrevisao = new Date(data.dataPrevisao);
    if (data.dataConclusao) updateData.dataConclusao = new Date(data.dataConclusao);
    if (data.dataEntrega) updateData.dataEntrega = new Date(data.dataEntrega);

    return this.prisma.serviceOrder.update({
      where: { id },
      data: updateData,
      include: {
        person: { select: { id: true, razaoSocial: true, cpfCnpj: true } },
        equipamento: { select: { id: true, tipo: true, placa: true } },
        items: true,
      },
    });
  }

  // ── Fluxo de Status ───────────────────────────────────────────────────────

  async aprovar(id: string) {
    const order = await this.getOrFail(id);
    if (!['ORCAMENTO', 'AGUARD_APROVACAO'].includes(order.status as string)) {
      throw new BadRequestException(`Status atual "${order.status}" não permite aprovação`);
    }
    return this.updateStatus(id, 'APROVADA');
  }

  async enviarParaAprovacao(id: string) {
    const order = await this.getOrFail(id);
    if (order.status !== 'ORCAMENTO') {
      throw new BadRequestException(`Apenas orçamentos podem ser enviados para aprovação`);
    }
    return this.updateStatus(id, 'AGUARD_APROVACAO');
  }

  async iniciar(id: string) {
    const order = await this.getOrFail(id);
    if (order.status !== 'APROVADA') {
      throw new BadRequestException(`OS precisa estar APROVADA para iniciar execução`);
    }
    return this.updateStatus(id, 'EM_EXECUCAO');
  }

  async aguardarPecas(id: string) {
    const order = await this.getOrFail(id);
    if (order.status !== 'EM_EXECUCAO') {
      throw new BadRequestException(`OS precisa estar EM_EXECUCAO para aguardar peças`);
    }
    return this.updateStatus(id, 'AGUARD_PECAS');
  }

  async retornarExecucao(id: string) {
    const order = await this.getOrFail(id);
    if (order.status !== 'AGUARD_PECAS') {
      throw new BadRequestException(`OS precisa estar AGUARD_PECAS para retornar à execução`);
    }
    return this.updateStatus(id, 'EM_EXECUCAO');
  }

  async concluir(id: string) {
    const order = await this.getOrFail(id);
    if (!['EM_EXECUCAO', 'AGUARD_PECAS'].includes(order.status as string)) {
      throw new BadRequestException(`OS precisa estar em execução para ser concluída`);
    }

    return this.prisma.serviceOrder.update({
      where: { id },
      data: { status: 'CONCLUIDA', dataConclusao: new Date() },
      include: { person: { select: { id: true, razaoSocial: true } } },
    });
  }

  async faturar(id: string) {
    const order = await this.getOrFail(id);
    if (order.status !== 'CONCLUIDA') {
      throw new BadRequestException(`OS precisa estar CONCLUIDA para faturamento`);
    }

    const result = await this.prisma.serviceOrder.update({
      where: { id },
      data: { status: 'FATURADA', dataEntrega: new Date() },
      include: { person: { select: { id: true, razaoSocial: true } } },
    });

    // Se OS de instalação, registra custo na carroceria
    if (order.type === 'INSTALACAO' && (order as any).carroceriaId) {
      await this.agregarCustoInstalacao(id, (order as any).carroceriaId);
    }

    this.integration.onServiceOrderDelivered(id, order.companyId, 'system').catch(() => {});
    return result;
  }

  async vendaPerdida(id: string, motivo: string) {
    const order = await this.getOrFail(id);
    if (!['ORCAMENTO', 'AGUARD_APROVACAO'].includes(order.status as string)) {
      throw new BadRequestException(`Venda perdida só pode ser registrada em orçamentos`);
    }
    return this.prisma.serviceOrder.update({
      where: { id },
      data: { status: 'VENDA_PERDIDA', motivoVendaPerdida: motivo },
      include: { person: { select: { id: true, razaoSocial: true } } },
    });
  }

  async cancelar(id: string) {
    const order = await this.getOrFail(id);
    if (['FATURADA', 'CANCELADA'].includes(order.status as string)) {
      throw new BadRequestException(`OS ${order.status} não pode ser cancelada`);
    }
    return this.updateStatus(id, 'CANCELADA');
  }

  // ── Custo de instalação → carroceria ──────────────────────────────────────

  private async agregarCustoInstalacao(serviceOrderId: string, carroceriaId: string) {
    const itens = await this.prisma.serviceOrderItem.findMany({
      where: { serviceOrderId, agregaCustoCarroceria: true },
    });

    const custoItens = itens.reduce((s, i) => s + Number(i.totalPrice), 0);

    // MO de apontamentos
    const apts = await this.prisma.apontamento.findMany({
      where: { serviceOrderId, fim: { not: null } },
      select: { totalHoras: true },
    });
    const horasMO = apts.reduce((s, a) => s + Number(a.totalHoras ?? 0), 0);

    // Valor hora padrão — usa 0 por ora (integrar com RH futuramente)
    const custoMO = horasMO * 0; // TODO: buscar valor_hora do Employee

    const custoInstalacao = custoItens + custoMO;

    const carroceria = await this.prisma.equipamento.findUnique({
      where: { id: carroceriaId },
      select: { custoProducao: true },
    });

    const custoProducao = Number(carroceria?.custoProducao ?? 0);

    await this.prisma.equipamento.update({
      where: { id: carroceriaId },
      data: {
        custoInstalacao,
        custoTotal: custoProducao + custoInstalacao,
        carroceriaStatus: 'INSTALADA',
      },
    });
  }

  // ── Stats ─────────────────────────────────────────────────────────────────

  async getStats(companyId: string) {
    const [byStatus, byType, byPagador] = await Promise.all([
      this.prisma.serviceOrder.groupBy({ by: ['status'], where: { companyId }, _count: { id: true } }),
      this.prisma.serviceOrder.groupBy({ by: ['type'], where: { companyId }, _count: { id: true } }),
      this.prisma.serviceOrder.groupBy({ by: ['tipoPagador'], where: { companyId }, _count: { id: true } }),
    ]);

    return {
      byStatus: byStatus.map((s) => ({ status: s.status, count: s._count.id })),
      byType: byType.map((t) => ({ type: t.type, count: t._count.id })),
      byPagador: byPagador.map((p) => ({ tipoPagador: p.tipoPagador, count: p._count.id })),
    };
  }

  // ── Timeline ──────────────────────────────────────────────────────────────

  async getTimeline(id: string, companyId: string) {
    return this.documentEvents.getTimeline('ServiceOrder', id, companyId);
  }

  async getReservas(id: string, companyId: string) {
    return this.stockReservations.listBySource(companyId, 'SERVICE_ORDER', id);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private async getOrFail(id: string) {
    const order = await this.prisma.serviceOrder.findUnique({ where: { id } });
    if (!order) throw new NotFoundException(`OS ${id} não encontrada`);
    return order;
  }

  private async updateStatus(id: string, status: string) {
    return this.prisma.serviceOrder.update({
      where: { id },
      data: { status: status as any },
      include: { person: { select: { id: true, razaoSocial: true } } },
    });
  }

  private async generateNumero(companyId: string): Promise<string> {
    const today = new Date();
    const dateStr = `${today.getFullYear()}${(today.getMonth() + 1).toString().padStart(2, '0')}${today.getDate().toString().padStart(2, '0')}`;
    const prefix = `OS-${dateStr}-`;

    const lastOrder = await this.prisma.serviceOrder.findFirst({
      where: { companyId, numero: { startsWith: prefix } },
      orderBy: { numero: 'desc' },
    });

    let sequence = 1;
    if (lastOrder?.numero) {
      const last = parseInt(lastOrder.numero.replace(prefix, ''), 10);
      if (!isNaN(last)) sequence = last + 1;
    }

    return `${prefix}${sequence.toString().padStart(3, '0')}`;
  }
}
