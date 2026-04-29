import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';
import { CreateCalderariaOrderDto } from './dto/create-calderaria-order.dto';
import { UpdateCalderariaOrderDto } from './dto/update-calderaria-order.dto';

const WITH_RELATIONS = {
  serviceOrder: {
    select: { id: true, numero: true, status: true, equipamento: { select: { placa: true, tipo: true } } },
  },
  productionOrder: {
    select: { id: true, numero: true, status: true },
  },
  responsavel: {
    select: { id: true, name: true },
  },
  requisitions: {
    select: { id: true, numero: true, status: true, type: true, createdAt: true },
  },
};

@Injectable()
export class CalderariaService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Listagem ──────────────────────────────────────────────────────────────

  async findAll(
    companyId: string,
    query: {
      search?: string;
      status?: string;
      serviceType?: string;
      modo?: string;
      page?: string;
      limit?: string;
    },
  ) {
    const page  = parseInt(query.page  || '1',  10);
    const limit = parseInt(query.limit || '20', 10);
    const skip  = (page - 1) * limit;

    const where: any = { companyId };

    if (query.search) {
      where.OR = [
        { numero:          { contains: query.search, mode: 'insensitive' } },
        { description:     { contains: query.search, mode: 'insensitive' } },
        { resultadoNome:   { contains: query.search, mode: 'insensitive' } },
        { materialDescription: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query.status)      where.status      = query.status;
    if (query.serviceType) where.serviceType = query.serviceType;
    if (query.modo)        where.modo        = query.modo;

    const [data, total] = await Promise.all([
      this.prisma.calderariaOrder.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ createdAt: 'desc' }],
        include: {
          serviceOrder:    { select: { id: true, numero: true, status: true } },
          productionOrder: { select: { id: true, numero: true, status: true } },
          responsavel:     { select: { id: true, name: true } },
        },
      }),
      this.prisma.calderariaOrder.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ── Detalhe ───────────────────────────────────────────────────────────────

  async findOne(id: string) {
    const order = await this.prisma.calderariaOrder.findUnique({
      where: { id },
      include: WITH_RELATIONS,
    });
    if (!order) throw new NotFoundException(`Ordem de Calderaria ${id} não encontrada`);
    return order;
  }

  // ── Criar ─────────────────────────────────────────────────────────────────

  async create(companyId: string, data: CreateCalderariaOrderDto) {
    const numero = await this.generateNumero(companyId);

    return this.prisma.calderariaOrder.create({
      data: {
        companyId,
        numero,
        serviceOrderId:      data.serviceOrderId      || null,
        productionOrderId:   data.productionOrderId   || null,
        serviceType:         data.serviceType          as any,
        modo:                (data.modo ?? 'SERVICO_INTERNO') as any,
        description:         data.description,
        materialDescription: data.materialDescription || null,
        tempoEstimado:       data.tempoEstimado       || null,
        especificacoesTecnicas: data.especificacoesTecnicas || null,
        observations:        data.observations        || null,
        // Fabricação Avulsa
        resultadoTipo:           data.resultadoTipo           ? data.resultadoTipo as any : null,
        resultadoNome:           data.resultadoNome           || null,
        resultadoNcm:            data.resultadoNcm            || null,
        resultadoCodigoServico:  data.resultadoCodigoServico  || null,
        resultadoUnidade:        data.resultadoUnidade        || null,
        resultadoQtd:            data.resultadoQtd            || null,
        valorVenda:              data.valorVenda              ? data.valorVenda    : null,
        margemPercentual:        data.margemPercentual        || null,
        status: 'ABERTA' as any,
      },
      include: {
        serviceOrder:    { select: { id: true, numero: true, status: true } },
        productionOrder: { select: { id: true, numero: true, status: true } },
      },
    });
  }

  // ── Atualizar ─────────────────────────────────────────────────────────────

  async update(id: string, data: UpdateCalderariaOrderDto) {
    await this.getOrFail(id);

    const updateData: any = { ...data };
    if (data.dataInicio) updateData.dataInicio = new Date(data.dataInicio);
    if (data.dataFim)    updateData.dataFim    = new Date(data.dataFim);

    // Converte decimais
    if (data.valorVenda      != null) updateData.valorVenda      = data.valorVenda;
    if (data.valorCustoReal  != null) updateData.valorCustoReal  = data.valorCustoReal;

    return this.prisma.calderariaOrder.update({
      where: { id },
      data: updateData,
      include: WITH_RELATIONS,
    });
  }

  // ── Salvar Desenho Excalidraw ──────────────────────────────────────────────

  async saveDesenho(id: string, desenhoData: any, desenhoPng: string | null) {
    await this.getOrFail(id);
    return this.prisma.calderariaOrder.update({
      where: { id },
      data: { desenhoData, desenhoPng: desenhoPng || null },
      select: { id: true, desenhoData: true, desenhoPng: true, updatedAt: true },
    });
  }

  // ── Iniciar: ABERTA → EM_EXECUCAO ─────────────────────────────────────────

  async start(id: string) {
    const order = await this.getOrFail(id);
    if (order.status !== 'ABERTA') {
      throw new BadRequestException(`Não é possível iniciar uma ordem com status ${order.status}. Esperado: ABERTA.`);
    }
    return this.prisma.calderariaOrder.update({
      where: { id },
      data: { status: 'EM_EXECUCAO' as any, dataInicio: new Date() },
      include: WITH_RELATIONS,
    });
  }

  // ── Concluir: EM_EXECUCAO → CONCLUIDA ────────────────────────────────────

  async complete(id: string) {
    const order = await this.getOrFail(id);
    if (order.status !== 'EM_EXECUCAO') {
      throw new BadRequestException(`Não é possível concluir uma ordem com status ${order.status}. Esperado: EM_EXECUCAO.`);
    }

    // Calcula custo real (soma requisições entregues + apontamentos finalizados)
    const valorCustoReal = await this.calcularCustoReal(id);

    // Atualiza a ordem
    const updated = await this.prisma.calderariaOrder.update({
      where: { id },
      data: {
        status:        'CONCLUIDA' as any,
        dataFim:       new Date(),
        valorCustoReal: valorCustoReal > 0 ? valorCustoReal : undefined,
      },
      include: WITH_RELATIONS,
    });

    // Se for FABRICACAO_AVULSA e tem OS vinculada → gera item automaticamente
    if ((order as any).modo === 'FABRICACAO_AVULSA' && order.serviceOrderId && !(order as any).osItemGeradoId) {
      await this.gerarOsItem(order as any, valorCustoReal);
    }

    return updated;
  }

  // ── Cancelar ─────────────────────────────────────────────────────────────

  async cancel(id: string) {
    const order = await this.getOrFail(id);
    if (order.status === 'CONCLUIDA' || order.status === 'CANCELADA') {
      throw new BadRequestException(`Não é possível cancelar uma ordem com status ${order.status}.`);
    }
    return this.prisma.calderariaOrder.update({
      where: { id },
      data: { status: 'CANCELADA' as any },
      include: WITH_RELATIONS,
    });
  }

  // ── Stats ─────────────────────────────────────────────────────────────────

  async getStats(companyId: string) {
    const [byStatus, byServiceType, byModo] = await Promise.all([
      this.prisma.calderariaOrder.groupBy({
        by: ['status'],
        where: { companyId },
        _count: { id: true },
      }),
      this.prisma.calderariaOrder.groupBy({
        by: ['serviceType'],
        where: { companyId },
        _count: { id: true },
      }),
      this.prisma.calderariaOrder.groupBy({
        by: ['modo'],
        where: { companyId },
        _count: { id: true },
      }),
    ]);

    return {
      byStatus:      byStatus.map(s => ({ status: s.status, count: s._count.id })),
      byServiceType: byServiceType.map(t => ({ serviceType: t.serviceType, count: t._count.id })),
      byModo:        byModo.map(m => ({ modo: (m as any).modo, count: m._count.id })),
    };
  }

  // ── Helpers privados ──────────────────────────────────────────────────────

  private async getOrFail(id: string) {
    const order = await this.prisma.calderariaOrder.findUnique({ where: { id } });
    if (!order) throw new NotFoundException(`Ordem de Calderaria ${id} não encontrada`);
    return order;
  }

  /**
   * Calcula custo real da ordem: soma itens de requisições + apontamentos finalizados.
   */
  private async calcularCustoReal(calderariaOrderId: string): Promise<number> {
    // Soma apontamentos finalizados: horas × valor_hora do funcionário
    const apontamentos = await this.prisma.apontamento.findMany({
      where: { calderariaOrderId, fim: { not: null } },
      select: {
        totalHoras: true,
        employee: { select: { valorHora: true } },
      },
    });

    const custoMO = apontamentos.reduce((s, a) => {
      const horas     = Number(a.totalHoras ?? 0);
      const valorHora = Number((a.employee as any)?.valorHora ?? 0);
      return s + horas * valorHora;
    }, 0);

    // TODO: somar também materiais das requisições entregues
    return custoMO;
  }

  /**
   * Gera automaticamente um ServiceOrderItem na OS vinculada ao concluir FABRICACAO_AVULSA.
   */
  private async gerarOsItem(order: any, valorCustoReal: number) {
    if (!order.serviceOrderId) return;

    // Calcula preço de venda
    let preco = Number(order.valorVenda ?? 0);
    if (preco === 0 && valorCustoReal > 0 && order.margemPercentual) {
      preco = valorCustoReal * (1 + order.margemPercentual / 100);
    }
    if (preco === 0) return; // Sem preço definido — não cria item

    const qty = order.resultadoQtd ?? 1;
    const tipo = order.resultadoTipo === 'SERVICO' ? 'SERVICO' : 'MATERIAL_CALDERARIA';

    const item = await this.prisma.serviceOrderItem.create({
      data: {
        serviceOrderId: order.serviceOrderId,
        description:    `${order.resultadoNome || order.description} (Calderaria ${order.numero})`,
        quantity:       qty,
        unitPrice:      preco / qty,
        totalPrice:     preco,
        tipo:           tipo as any,
        faturavel:      true,
        agregaCustoCarroceria: false,
      },
    });

    // Registra referência do item gerado na ordem de calderaria
    await this.prisma.calderariaOrder.update({
      where: { id: order.id },
      data: { osItemGeradoId: item.id },
    });
  }

  private async generateNumero(companyId: string): Promise<string> {
    const today   = new Date();
    const dateStr = today.getFullYear().toString()
      + (today.getMonth() + 1).toString().padStart(2, '0')
      + today.getDate().toString().padStart(2, '0');

    const prefix = `CLD-${dateStr}-`;

    const lastOrder = await this.prisma.calderariaOrder.findFirst({
      where: { companyId, numero: { startsWith: prefix } },
      orderBy: { numero: 'desc' },
    });

    let sequence = 1;
    if (lastOrder?.numero) {
      const lastSeq = parseInt(lastOrder.numero.replace(prefix, ''), 10);
      if (!isNaN(lastSeq)) sequence = lastSeq + 1;
    }

    return `${prefix}${sequence.toString().padStart(3, '0')}`;
  }
}
