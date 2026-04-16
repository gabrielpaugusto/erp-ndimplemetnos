import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';

/**
 * Sprint 4.1 — Dashboards Operacionais
 *
 * Cada método retorna dados prontos para renderização nos 4 painéis:
 *   a) Chão de Fábrica   b) Comercial
 *   c) Financeiro Exec.  d) Compras/Estoque
 */
@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  // ── 4.1a — Dashboard Chão de Fábrica ──────────────────────────────────

  async getChaoFabrica(companyId: string) {
    const now = new Date();

    const [ops, centros] = await Promise.all([
      this.prisma.productionOrder.findMany({
        where: {
          companyId,
          status: { in: ['PLANEJADA', 'LIBERADA', 'EM_PRODUCAO', 'PAUSADA'] as any[] },
        },
        include: {
          product: { select: { id: true, code: true, description: true } },
          items:   { select: { quantityRequired: true, quantityConsumed: true } },
        },
        orderBy: { dataFimPrevista: 'asc' },
      }),
      this.prisma.workCenter.findMany({
        where: { companyId, active: true },
        select: { id: true, name: true, code: true, capacidadeHora: true },
      }),
    ]);

    // % conclusão = soma(quantityConsumed) / soma(quantityRequired)
    const opsComProgresso = ops.map((op) => {
      const totalReq  = op.items.reduce((s, i) => s + Number(i.quantityRequired),  0);
      const totalCons = op.items.reduce((s, i) => s + Number(i.quantityConsumed), 0);
      const pct = totalReq > 0 ? Math.round((totalCons / totalReq) * 100) : 0;
      const atrasada = op.dataFimPrevista < now && op.status !== 'CONCLUIDA';
      return {
        id:          op.id,
        numero:      op.numero,
        produto:     op.product.description,
        status:      op.status,
        quantidade:  Number(op.quantity),
        dataInicio:  op.dataInicioPrevista,
        dataFim:     op.dataFimPrevista,
        progressoPct: pct,
        atrasada,
        diasAtraso: atrasada
          ? Math.ceil((now.getTime() - op.dataFimPrevista.getTime()) / 86400000)
          : 0,
      };
    });

    return {
      resumo: {
        total:       opsComProgresso.length,
        emProducao:  opsComProgresso.filter((o) => o.status === 'EM_PRODUCAO').length,
        atrasadas:   opsComProgresso.filter((o) => o.atrasada).length,
        planejadas:  opsComProgresso.filter((o) => o.status === 'PLANEJADA').length,
        liberadas:   opsComProgresso.filter((o) => o.status === 'LIBERADA').length,
      },
      ops:     opsComProgresso,
      centros: centros.map((c) => ({
        ...c,
        opsAtivas: opsComProgresso.length,
      })),
    };
  }

  // ── 4.1b — Dashboard Comercial ────────────────────────────────────────

  async getComercial(companyId: string) {
    const now     = new Date();
    const mes     = new Date(now.getFullYear(), now.getMonth(), 1);
    const em3dias = new Date(now.getTime() + 3 * 86400000);

    const [orcamentos, pedidos, expirandoEm3Dias] = await Promise.all([
      this.prisma.quotation.findMany({
        where: {
          companyId,
          status: { notIn: ['RECUSADO', 'EXPIRADO'] as any[] },
        },
        select: {
          id: true, numero: true, status: true,
          total: true, validadeOrcamento: true, createdAt: true,
          person: { select: { razaoSocial: true } },
          vendedor: { select: { name: true } },
        },
      }),
      this.prisma.saleOrder.findMany({
        where: {
          companyId,
          status: { notIn: ['CANCELADO'] as any[] },
        },
        select: {
          id: true, numero: true, status: true, total: true,
          createdAt: true, dataFaturamento: true,
          person: { select: { razaoSocial: true } },
        },
      }),
      this.prisma.quotation.findMany({
        where: {
          companyId,
          status: { in: ['RASCUNHO', 'ENVIADO'] as any[] },
          validadeOrcamento: { gte: now, lte: em3dias },
        },
        select: {
          id: true, numero: true, total: true, validadeOrcamento: true,
          person: { select: { razaoSocial: true } },
        },
      }),
    ]);

    // Funil
    const funil = {
      orcamentosAbertos:   orcamentos.filter((o) => ['RASCUNHO', 'ENVIADO'].includes(o.status as string)).length,
      orcamentosAceitos:   orcamentos.filter((o) => (o.status as string) === 'ACEITO').length,
      pedidosAbertos:      pedidos.filter((p) => !['FATURADO', 'ENTREGUE', 'CANCELADO'].includes(p.status as string)).length,
      pedidosFaturados:    pedidos.filter((p) => ['FATURADO', 'ENTREGUE'].includes(p.status as string)).length,
    };

    // Ticket médio (pedidos do mês)
    const pedidosMes = pedidos.filter((p) => p.createdAt >= mes);
    const ticketMedio = pedidosMes.length > 0
      ? pedidosMes.reduce((s, p) => s + Number(p.total), 0) / pedidosMes.length
      : 0;

    // Top 10 clientes por faturamento
    const clienteFaturamento = new Map<string, { nome: string; total: number; pedidos: number }>();
    for (const p of pedidos.filter((p) => ['FATURADO', 'ENTREGUE'].includes(p.status as string))) {
      const nome  = p.person.razaoSocial;
      const entry = clienteFaturamento.get(nome) ?? { nome, total: 0, pedidos: 0 };
      entry.total   += Number(p.total);
      entry.pedidos += 1;
      clienteFaturamento.set(nome, entry);
    }
    const top10Clientes = [...clienteFaturamento.values()]
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    // Taxa de conversão orçamento → pedido (mês atual)
    const orcamentosMes  = orcamentos.filter((o) => o.createdAt >= mes).length;
    const convertidosMes = orcamentos.filter((o) => o.createdAt >= mes && (o.status as string) === 'ACEITO').length;
    const taxaConversao  = orcamentosMes > 0 ? Math.round((convertidosMes / orcamentosMes) * 100) : 0;

    return {
      funil,
      ticketMedio:     Math.round(ticketMedio * 100) / 100,
      taxaConversao,
      top10Clientes,
      expirandoEm3Dias,
      totalFaturadoMes: pedidosMes
        .filter((p) => ['FATURADO', 'ENTREGUE'].includes(p.status as string))
        .reduce((s, p) => s + Number(p.total), 0),
    };
  }

  // ── 4.1c — Dashboard Financeiro Executivo ─────────────────────────────

  async getFinanceiro(companyId: string) {
    const now    = new Date();
    const hoje   = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const em7    = new Date(hoje.getTime() + 7  * 86400000);
    const em30   = new Date(hoje.getTime() + 30 * 86400000);
    const em60   = new Date(hoje.getTime() + 60 * 86400000);
    const em90   = new Date(hoje.getTime() + 90 * 86400000);
    const mesFim = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const mesIni = new Date(now.getFullYear(), now.getMonth(), 1);

    const movimentos = await this.prisma.financialMovement.findMany({
      where: {
        companyId,
        status: { notIn: ['CANCELADO', 'RENEGOCIADO'] as any[] },
      },
      select: {
        type: true,
        valor: true,
        valorPago: true,
        dataVencimento: true,
        dataPagamento: true,
        status: true,
      },
    });

    const pendentes = movimentos.filter((m) => m.status === 'PENDENTE' || m.status === 'VENCIDO');
    const receitas  = pendentes.filter((m) => m.type === 'RECEITA');
    const despesas  = pendentes.filter((m) => m.type === 'DESPESA');

    const vencidas = pendentes.filter((m) => m.dataVencimento < hoje);
    const inadimplenciaValor = vencidas
      .filter((m) => m.type === 'RECEITA')
      .reduce((s, m) => s + Number(m.valor), 0);
    const inadimplenciaQtd = vencidas.filter((m) => m.type === 'RECEITA').length;
    const totalCarteira    = receitas.reduce((s, m) => s + Number(m.valor), 0);
    const inadimplenciaPct = totalCarteira > 0
      ? Math.round((inadimplenciaValor / totalCarteira) * 100)
      : 0;

    // Fluxo de caixa previsto por janela
    const fluxo = (ate: Date) => ({
      entradas: receitas.filter((m) => m.dataVencimento <= ate).reduce((s, m) => s + Number(m.valor), 0),
      saidas:   despesas.filter((m) => m.dataVencimento <= ate).reduce((s, m) => s + Number(m.valor), 0),
    });

    // Contas a vencer em 7 dias
    const aVencer7dias = pendentes.filter(
      (m) => m.dataVencimento >= hoje && m.dataVencimento <= em7,
    );

    // DRE simplificado do mês corrente (realizados)
    const realizados = movimentos.filter(
      (m) => m.dataPagamento && m.dataPagamento >= mesIni && m.dataPagamento <= mesFim,
    );
    const receitasMes = realizados.filter((m) => m.type === 'RECEITA').reduce((s, m) => s + Number(m.valorPago ?? m.valor), 0);
    const despesasMes = realizados.filter((m) => m.type === 'DESPESA').reduce((s, m) => s + Number(m.valorPago ?? m.valor), 0);

    return {
      fluxoCaixa: {
        d30: fluxo(em30),
        d60: fluxo(em60),
        d90: fluxo(em90),
      },
      inadimplencia: {
        valor: Math.round(inadimplenciaValor * 100) / 100,
        qtd:   inadimplenciaQtd,
        pct:   inadimplenciaPct,
      },
      dreMes: {
        receitas:  Math.round(receitasMes  * 100) / 100,
        despesas:  Math.round(despesasMes  * 100) / 100,
        resultado: Math.round((receitasMes - despesasMes) * 100) / 100,
      },
      aVencer7dias: aVencer7dias.map((m) => ({
        tipo:       m.type,
        valor:      Number(m.valor),
        vencimento: m.dataVencimento,
        status:     m.status,
      })),
    };
  }

  // ── 4.1d — Dashboard Compras / Estoque ────────────────────────────────

  async getComprasEstoque(companyId: string) {
    const now    = new Date();
    const dias30 = new Date(now.getTime() - 30 * 86400000);

    const [balances, ordensAbertas, movimentos30dias] = await Promise.all([
      this.prisma.stockBalance.findMany({
        where: { companyId },
        include: {
          product: {
            select: {
              id: true, code: true, description: true, unit: true,
              estoqueMinimo: true,
              groupId: true, group: { select: { name: true } },
            },
          },
          location: { select: { id: true, name: true } },
        },
      }),
      this.prisma.purchaseOrder.findMany({
        where: {
          companyId,
          status: { in: ['ENVIADA', 'CONFIRMADA', 'PARCIAL_RECEBIDA'] as any[] },
        },
        include: {
          supplier: { select: { razaoSocial: true } },
          items:    { select: { quantity: true, quantityReceived: true } },
        },
      }),
      this.prisma.stockMovement.findMany({
        where: {
          companyId,
          createdAt: { gte: dias30 },
          type: { in: ['SAIDA', 'CONSUMO_INTERNO'] as any[] },
        },
        select: { productId: true, quantity: true },
      }),
    ]);

    // Itens abaixo do ponto de pedido (reorderPoint está em StockBalance)
    const criticos = balances
      .filter((b) => {
        const ponto = Number(b.reorderPoint ?? b.product.estoqueMinimo ?? 0);
        return Number(b.availableQuantity) <= ponto && ponto > 0;
      })
      .map((b) => ({
        productId:    b.productId,
        code:         b.product.code,
        descricao:    b.product.description,
        disponivel:   Number(b.availableQuantity),
        reservado:    Number(b.reservedQuantity),
        total:        Number(b.quantity),
        pontoRessupr: Number(b.reorderPoint ?? b.product.estoqueMinimo ?? 0),
        localidade:   b.location.name,
      }))
      .sort((a, b) => a.disponivel - b.disponivel)
      .slice(0, 20);

    // Giro de estoque por grupo (30 dias)
    const saidaPorProduto = new Map<string, number>();
    for (const m of movimentos30dias) {
      saidaPorProduto.set(m.productId, (saidaPorProduto.get(m.productId) ?? 0) + Number(m.quantity));
    }

    const giroGrupo = new Map<string, { grupo: string; saidas: number; saldo: number }>();
    for (const b of balances) {
      const grupo = b.product.group?.name ?? 'Sem grupo';
      const entry = giroGrupo.get(grupo) ?? { grupo, saidas: 0, saldo: 0 };
      entry.saidas += saidaPorProduto.get(b.productId) ?? 0;
      entry.saldo  += Number(b.quantity);
      giroGrupo.set(grupo, entry);
    }
    const girosOrdenados = [...giroGrupo.values()]
      .map((g) => ({ ...g, giro: g.saldo > 0 ? Math.round((g.saidas / g.saldo) * 100) / 100 : 0 }))
      .sort((a, b) => b.giro - a.giro);

    // OCs abertas por fornecedor
    const porFornecedor = ordensAbertas.reduce<Record<string, { nome: string; ocs: number; valorTotal: number; atrasadas: number }>>((acc, po) => {
      const nome  = po.supplier?.razaoSocial ?? 'Sem fornecedor';
      const entry = acc[nome] ?? { nome, ocs: 0, valorTotal: 0, atrasadas: 0 };
      entry.ocs++;
      entry.valorTotal += Number((po as any).totalValue ?? 0);
      acc[nome] = entry;
      return acc;
    }, {});

    return {
      resumo: {
        itensCriticos:        criticos.length,
        ordensAbertas:        ordensAbertas.length,
        totalProdutosEstoque: balances.length,
      },
      criticos,
      giroEstoque:  girosOrdenados,
      porFornecedor: Object.values(porFornecedor).sort((a, b) => b.ocs - a.ocs),
    };
  }
}
