import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';
import { DocumentEventService } from '@/modules/core/audit/document-event.service';
import { CreateQuotationDto } from './dto/create-quotation.dto';
import { UpdateQuotationDto } from './dto/update-quotation.dto';
import { CreateQuotationItemDto } from './dto/create-quotation-item.dto';

@Injectable()
export class QuotationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly documentEvents: DocumentEventService,
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
        // Filter out undefined numero conditions
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
      this.prisma.quotation.findMany({
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
      this.prisma.quotation.count({ where }),
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
    const quotation = await this.prisma.quotation.findUnique({
      where: { id },
      include: {
        person: true,
        vendedor: {
          select: { id: true, name: true, email: true },
        },
        lead: {
          select: { id: true, title: true, status: true },
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
          },
        },
      },
    });

    if (!quotation) {
      throw new NotFoundException(`Quotation ${id} not found`);
    }

    return quotation;
  }

  async create(companyId: string, data: CreateQuotationDto) {
    // Auto-generate numero
    const maxNumero = await this.prisma.quotation.aggregate({
      where: { companyId },
      _max: { numero: true },
    });
    const nextNumero = (maxNumero._max.numero || 0) + 1;

    // Calculate item totals
    const items = (data.items || []).map((item) => {
      const desconto = item.desconto || 0;
      const subtotal =
        Number(item.quantidade) * Number(item.precoUnitario) - desconto;
      return { ...item, total: subtotal };
    });

    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    const descontoTotal = items.reduce(
      (sum, item) => sum + (item.desconto || 0),
      0,
    );

    return this.prisma.quotation.create({
      data: {
        companyId,
        numero: nextNumero,
        personId: data.personId,
        leadId: data.leadId,
        saleType: (data.saleType as any) || 'ESTOQUE_PROPRIO',
        condicaoPagamento: data.condicaoPagamento,
        validadeOrcamento: data.validadeOrcamento
          ? new Date(data.validadeOrcamento)
          : undefined,
        prazoEntrega: data.prazoEntrega,
        observacoes: data.observacoes,
        vendedorId: data.vendedorId,
        comissaoPercent: data.comissaoPercent,
        subtotal,
        desconto: descontoTotal,
        total: subtotal,
        items: items.length > 0
          ? {
              create: items.map((item) => ({
                productId: item.productId,
                quantidade: item.quantidade,
                precoUnitario: item.precoUnitario,
                desconto: item.desconto || 0,
                total: item.total,
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

  async update(id: string, data: UpdateQuotationDto) {
    const existing = await this.prisma.quotation.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Quotation ${id} not found`);
    }

    const { items, ...updateData } = data;

    const prismaData: any = { ...updateData };

    if (data.validadeOrcamento) {
      prismaData.validadeOrcamento = new Date(data.validadeOrcamento);
    }

    return this.prisma.quotation.update({
      where: { id },
      data: prismaData,
      include: {
        person: true,
        items: { include: { product: true } },
      },
    });
  }

  async addItem(quotationId: string, data: CreateQuotationItemDto) {
    const quotation = await this.prisma.quotation.findUnique({
      where: { id: quotationId },
    });
    if (!quotation) {
      throw new NotFoundException(`Quotation ${quotationId} not found`);
    }

    const desconto = data.desconto || 0;
    const total =
      Number(data.quantidade) * Number(data.precoUnitario) - desconto;

    const item = await this.prisma.quotationItem.create({
      data: {
        quotationId,
        productId: data.productId,
        quantidade: data.quantidade,
        precoUnitario: data.precoUnitario,
        desconto,
        total,
        observacoes: data.observacoes,
      },
      include: { product: true },
    });

    await this.recalculate(quotationId);

    return item;
  }

  async removeItem(itemId: string) {
    const item = await this.prisma.quotationItem.findUnique({
      where: { id: itemId },
    });
    if (!item) {
      throw new NotFoundException(`Quotation item ${itemId} not found`);
    }

    await this.prisma.quotationItem.delete({ where: { id: itemId } });
    await this.recalculate(item.quotationId);

    return { deleted: true };
  }

  async recalculate(quotationId: string) {
    const items = await this.prisma.quotationItem.findMany({
      where: { quotationId },
    });

    const subtotal = items.reduce(
      (sum, item) => sum + Number(item.total),
      0,
    );
    const descontoTotal = items.reduce(
      (sum, item) => sum + Number(item.desconto),
      0,
    );

    return this.prisma.quotation.update({
      where: { id: quotationId },
      data: {
        subtotal,
        desconto: descontoTotal,
        total: subtotal,
      },
    });
  }

  async convertToSaleOrder(quotationId: string) {
    return this.convertToDocuments(quotationId);
  }

  /**
   * Converts an accepted quotation into all necessary documents based on item types:
   *  - Any item        → SaleOrderItem (always creates one SaleOrder)
   *  - PRODUCAO_PROPRIA → also creates a ProductionOrder linked to the SaleOrder
   *  - SERVICO_OFICINA  → also creates a ServiceOrder linked to the client
   *
   * Returns: { id, saleOrder, productionOrders, serviceOrders, summary }
   * `.id` is the SaleOrder id for backward-compatible redirects.
   */
  async convertToDocuments(quotationId: string) {
    const quotation = await this.prisma.quotation.findUnique({
      where: { id: quotationId },
      include: { items: { include: { product: true } } },
    });

    if (!quotation) {
      throw new NotFoundException(`Quotation ${quotationId} not found`);
    }

    if (quotation.status === 'ACEITO') {
      throw new BadRequestException('Quotation already converted');
    }

    const companyId = quotation.companyId;
    const today = new Date();

    // Get next sale order number
    const maxNumero = await this.prisma.saleOrder.aggregate({
      where: { companyId },
      _max: { numero: true },
    });
    const nextNumero = (maxNumero._max.numero || 0) + 1;

    const productionItems = quotation.items.filter(i => i.itemType === 'PRODUCAO_PROPRIA');
    const serviceItems    = quotation.items.filter(i => i.itemType === 'SERVICO_OFICINA');

    // ---- Counters for OP and OS numbering ----
    const maxOpRaw = await this.prisma.productionOrder.findFirst({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      select: { numero: true },
    });
    let opSeq = maxOpRaw
      ? (parseInt(maxOpRaw.numero.replace(/\D/g, ''), 10) || 0) + 1
      : 1;

    const maxOsRaw = await this.prisma.serviceOrder.findFirst({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      select: { numero: true },
    });
    let osSeq = maxOsRaw
      ? (parseInt(maxOsRaw.numero.replace(/\D/g, ''), 10) || 0) + 1
      : 1;

    // Create all documents in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // ---- 1. SaleOrder (always) ----
      const order = await (tx as any).saleOrder.create({
        data: {
          companyId,
          numero: nextNumero,
          personId: quotation.personId,
          quotationId: quotation.id,
          saleType: quotation.saleType,
          vendedorId: quotation.vendedorId,
          comissaoPercent: quotation.comissaoPercent,
          condicaoPagamento: quotation.condicaoPagamento,
          prazoEntrega: quotation.prazoEntrega,
          subtotal: quotation.subtotal,
          desconto: quotation.desconto,
          total: quotation.total,
          observacoes: quotation.observacoes,
          items: {
            create: quotation.items.map((item, index) => ({
              productId: item.productId,
              itemType: item.itemType,
              quantidade: item.quantidade,
              precoUnitario: item.precoUnitario,
              desconto: item.desconto,
              total: item.total,
              sequencia: index + 1,
              descricaoLivre: item.descricaoLivre,
              observacoes: item.observacoes,
            })),
          },
        },
        include: {
          person: true,
          items: { include: { product: true } },
        },
      });

      // ---- 2. ProductionOrders for PRODUCAO_PROPRIA items ----
      const productionOrders: any[] = [];
      for (const item of productionItems) {
        if (!item.productId) continue; // skip if no product linked
        const dataFim = new Date(today);
        dataFim.setDate(dataFim.getDate() + 30);

        const op = await (tx as any).productionOrder.create({
          data: {
            companyId,
            numero: `OP-${String(opSeq++).padStart(5, '0')}`,
            productId: item.productId,
            saleOrderId: order.id,
            strategy: 'MTO',
            status: 'PLANEJADA',
            quantity: Number(item.quantidade),
            dataInicioPrevista: today,
            dataFimPrevista: dataFim,
            observations: `Gerado automaticamente a partir do Orçamento ORC-${String(quotation.numero).padStart(4, '0')}. ${item.observacoes || ''}`.trim(),
          },
          select: { id: true, numero: true, status: true },
        });
        productionOrders.push(op);
      }

      // ---- 3. ServiceOrders for SERVICO_OFICINA items ----
      const serviceOrders: any[] = [];
      for (const item of serviceItems) {
        const dataPrevisao = new Date(today);
        dataPrevisao.setDate(dataPrevisao.getDate() + 7);

        const os = await (tx as any).serviceOrder.create({
          data: {
            companyId,
            numero: `OS-${String(osSeq++).padStart(5, '0')}`,
            personId: quotation.personId,
            type: 'MANUTENCAO',
            status: 'ABERTA',
            priority: 'NORMAL',
            veiculoDescricao: item.descricaoLivre || item.product?.description || 'A preencher',
            defeitoRelatado: item.observacoes || item.descricaoLivre || 'Serviço solicitado via orçamento',
            dataEntrada: today,
            dataPrevisao,
            valorMaoDeObra: Number(item.total),
            valorTotal: Number(item.total),
            observations: `Gerado automaticamente a partir do Orçamento ORC-${String(quotation.numero).padStart(4, '0')}.`,
          },
          select: { id: true, numero: true, status: true },
        });
        serviceOrders.push(os);
      }

      // ---- 4. Mark quotation as ACEITO ----
      await (tx as any).quotation.update({
        where: { id: quotationId },
        data: { status: 'ACEITO' },
      });

      return { order, productionOrders, serviceOrders };
    });

    const { order, productionOrders, serviceOrders } = result;

    return {
      // backward-compat: .id redirects to sale order
      id: order.id,
      saleOrder: order,
      productionOrders,
      serviceOrders,
      summary: {
        pedidoVenda: order.numero,
        ordensProducao: productionOrders.map((op: any) => op.numero),
        ordensServico: serviceOrders.map((os: any) => os.numero),
        totalDocumentos: 1 + productionOrders.length + serviceOrders.length,
      },
    };
  }

  /** @deprecated use convertToDocuments */
  async _convertToSaleOrderLegacy(quotationId: string) {
    const quotation = await this.prisma.quotation.findUnique({
      where: { id: quotationId },
      include: { items: true },
    });

    if (!quotation) {
      throw new NotFoundException(`Quotation ${quotationId} not found`);
    }

    if (quotation.status === 'ACEITO') {
      throw new BadRequestException('Quotation already converted');
    }

    // Get next sale order number
    const maxNumero = await this.prisma.saleOrder.aggregate({
      where: { companyId: quotation.companyId },
      _max: { numero: true },
    });
    const nextNumero = (maxNumero._max.numero || 0) + 1;

    // Create sale order in a transaction
    const saleOrder = await this.prisma.$transaction(async (tx) => {
      const order = await tx.saleOrder.create({
        data: {
          companyId: quotation.companyId,
          numero: nextNumero,
          personId: quotation.personId,
          quotationId: quotation.id,
          saleType: quotation.saleType,
          vendedorId: quotation.vendedorId,
          comissaoPercent: quotation.comissaoPercent,
          condicaoPagamento: quotation.condicaoPagamento,
          prazoEntrega: quotation.prazoEntrega,
          subtotal: quotation.subtotal,
          desconto: quotation.desconto,
          total: quotation.total,
          observacoes: quotation.observacoes,
          items: {
            create: quotation.items.map((item, index) => ({
              productId: item.productId,
              quantidade: item.quantidade,
              precoUnitario: item.precoUnitario,
              desconto: item.desconto,
              total: item.total,
              sequencia: index + 1,
              observacoes: item.observacoes,
            })),
          },
        },
        include: {
          person: true,
          items: { include: { product: true } },
        },
      });

      // Update quotation status
      await tx.quotation.update({
        where: { id: quotationId },
        data: { status: 'ACEITO' },
      });

      return order;
    });

    return saleOrder;
  }

  // ── Sprint 2.3 — Timeline ──────────────────────────────────────────────

  async getTimeline(id: string, companyId: string) {
    return this.documentEvents.getTimeline('Quotation', id, companyId);
  }

  // ── Sprint 3.3 — Versões de Orçamento ─────────────────────────────────

  /**
   * Cria uma nova versão do orçamento copiando todos os itens.
   * A versão anterior tem status mantido; a nova começa como RASCUNHO.
   */
  async novaVersao(id: string, companyId: string, userId: string) {
    const original = await this.prisma.quotation.findFirst({
      where: { id, companyId },
      include: { items: true },
    });
    if (!original) throw new NotFoundException(`Orçamento ${id} não encontrado`);

    if (['CANCELADA', 'CONVERTIDA_PEDIDO'].includes(original.status as string)) {
      throw new BadRequestException(
        `Não é possível criar nova versão de orçamento com status "${original.status}"`,
      );
    }

    const novaVersao = (original.versao ?? 1) + 1;

    const lastQuotation = await this.prisma.quotation.findFirst({
      where: { companyId },
      orderBy: { numero: 'desc' },
      select: { numero: true },
    });
    const novoNumero = (lastQuotation?.numero ?? 0) + 1;

    const novoOrcamento = await this.prisma.quotation.create({
      data: {
        companyId,
        numero:            novoNumero,
        versao:            novaVersao,
        versaoAnteriorId:  original.id,
        personId:          original.personId,
        leadId:            original.leadId,
        status:            'RASCUNHO' as any,
        saleType:          original.saleType,
        subtotal:          original.subtotal,
        desconto:          original.desconto,
        totalFrete:        original.totalFrete,
        total:             original.total,
        condicaoPagamento: original.condicaoPagamento,
        validadeOrcamento: original.validadeOrcamento,
        prazoEntrega:      original.prazoEntrega,
        observacoes:       original.observacoes,
        vendedorId:        original.vendedorId,
        comissaoPercent:   original.comissaoPercent,
        items: {
          create: original.items.map((item, idx) => ({
            productId:      item.productId,
            sequencia:      item.sequencia ?? idx + 1,
            itemType:       item.itemType,
            quantidade:     item.quantidade,
            precoUnitario:  item.precoUnitario,
            desconto:       item.desconto,
            total:          item.total,
            ncmCode:        item.ncmCode,
            descricaoLivre: item.descricaoLivre,
            observacoes:    item.observacoes,
          })),
        },
      },
      include: {
        person:         { select: { id: true, razaoSocial: true } },
        vendedor:       { select: { id: true, name: true } },
        versaoAnterior: { select: { id: true, numero: true, versao: true } },
        items: { include: { product: { select: { id: true, code: true, description: true } } } },
      },
    });

    // Registra na timeline do orçamento original
    this.documentEvents.record({
      companyId,
      entityType: 'Quotation',
      entityId:   id,
      eventType:  'DOCUMENTO_VINCULADO',
      description: `Nova versão v${novaVersao} criada (Orçamento #${novoNumero})`,
      userId,
    });

    return novoOrcamento;
  }

  /**
   * Compara dois orçamentos e retorna o diff de itens e valores.
   */
  async getDiff(idA: string, idB: string, companyId: string) {
    const [a, b] = await Promise.all([
      this.prisma.quotation.findFirst({
        where: { id: idA, companyId },
        include: { items: { include: { product: { select: { code: true, description: true } } } } },
      }),
      this.prisma.quotation.findFirst({
        where: { id: idB, companyId },
        include: { items: { include: { product: { select: { code: true, description: true } } } } },
      }),
    ]);

    if (!a || !b) throw new NotFoundException('Um ou mais orçamentos não encontrados');

    const valorDiff = {
      subtotal:   { de: Number(a.subtotal),   para: Number(b.subtotal),   delta: Number(b.subtotal)   - Number(a.subtotal) },
      desconto:   { de: Number(a.desconto),   para: Number(b.desconto),   delta: Number(b.desconto)   - Number(a.desconto) },
      totalFrete: { de: Number(a.totalFrete), para: Number(b.totalFrete), delta: Number(b.totalFrete) - Number(a.totalFrete) },
      total:      { de: Number(a.total),      para: Number(b.total),      delta: Number(b.total)      - Number(a.total) },
    };

    const aMap = new Map(a.items.map((i) => [i.productId ?? i.descricaoLivre ?? i.id, i]));
    const bMap = new Map(b.items.map((i) => [i.productId ?? i.descricaoLivre ?? i.id, i]));

    const adicionados = b.items.filter((i) => !aMap.has(i.productId ?? i.descricaoLivre ?? i.id));
    const removidos   = a.items.filter((i) => !bMap.has(i.productId ?? i.descricaoLivre ?? i.id));
    const modificados = b.items
      .filter((i) => aMap.has(i.productId ?? i.descricaoLivre ?? i.id))
      .map((bi) => {
        const ai = aMap.get(bi.productId ?? bi.descricaoLivre ?? bi.id)!;
        const changes: Record<string, { de: unknown; para: unknown }> = {};
        if (Number(ai.quantidade)    !== Number(bi.quantidade))    changes.quantidade    = { de: Number(ai.quantidade),    para: Number(bi.quantidade) };
        if (Number(ai.precoUnitario) !== Number(bi.precoUnitario)) changes.precoUnitario = { de: Number(ai.precoUnitario), para: Number(bi.precoUnitario) };
        if (Number(ai.desconto)      !== Number(bi.desconto))      changes.desconto      = { de: Number(ai.desconto),      para: Number(bi.desconto) };
        return Object.keys(changes).length > 0 ? { item: bi, changes } : null;
      })
      .filter(Boolean);

    return {
      versaoA:   { id: a.id, numero: a.numero, versao: a.versao },
      versaoB:   { id: b.id, numero: b.numero, versao: b.versao },
      valorDiff,
      itens:     { adicionados, removidos, modificados },
    };
  }
}
