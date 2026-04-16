import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';

@Injectable()
export class AiToolsService {
  constructor(private readonly prisma: PrismaService) {}

  async executeFinancialAnalysis(companyId: string) {
    const startTime = Date.now();
    try {
      const [totalReceitas, totalDespesas, vencidos, recentMovements] =
        await Promise.all([
          this.prisma.financialMovement.aggregate({
            where: { companyId, type: 'RECEITA' },
            _sum: { valor: true },
            _count: { id: true },
          }),
          this.prisma.financialMovement.aggregate({
            where: { companyId, type: 'DESPESA' },
            _sum: { valor: true },
            _count: { id: true },
          }),
          this.prisma.financialMovement.count({
            where: {
              companyId,
              status: 'VENCIDO',
            },
          }),
          this.prisma.financialMovement.findMany({
            where: { companyId },
            orderBy: { dataVencimento: 'desc' },
            take: 10,
            select: {
              id: true,
              description: true,
              type: true,
              valor: true,
              status: true,
              dataVencimento: true,
            },
          }),
        ]);

      const result = {
        totalAReceber: totalReceitas._sum.valor || 0,
        countReceitas: totalReceitas._count.id,
        totalAPagar: totalDespesas._sum.valor || 0,
        countDespesas: totalDespesas._count.id,
        vencidos,
        recentMovements,
      };

      await this.saveExecution(companyId, 'ANALYZE_FINANCIAL', {}, result, startTime);
      return result;
    } catch (error) {
      await this.saveExecution(
        companyId,
        'ANALYZE_FINANCIAL',
        {},
        null,
        startTime,
        error.message,
      );
      throw error;
    }
  }

  async executeStockAnalysis(companyId: string) {
    const startTime = Date.now();
    try {
      const [totalItems, belowMinimum, recentMovements, topByValue] =
        await Promise.all([
          this.prisma.stockBalance.count({ where: { companyId } }),
          this.prisma.stockBalance.count({
            where: {
              companyId,
              quantity: { lt: this.prisma.stockBalance.fields.minStock as any },
            },
          }).catch(() =>
            // Fallback: raw count where quantity < minStock
            this.prisma.$queryRawUnsafe<[{ count: bigint }]>(
              `SELECT COUNT(*)::int as count FROM stock_balances WHERE "companyId" = $1 AND quantity < "minStock" AND "minStock" > 0`,
              companyId,
            ).then((r) => Number(r[0]?.count || 0)),
          ),
          this.prisma.stockMovement.findMany({
            where: { companyId },
            orderBy: { date: 'desc' },
            take: 10,
            include: {
              product: { select: { id: true, description: true, code: true } },
            },
          }),
          this.prisma.stockBalance.findMany({
            where: { companyId },
            orderBy: { totalCost: 'desc' },
            take: 10,
            include: {
              product: { select: { id: true, description: true, code: true } },
              location: { select: { id: true, name: true } },
            },
          }),
        ]);

      const result = {
        totalItems,
        belowMinimum,
        recentMovements,
        topProductsByValue: topByValue,
      };

      await this.saveExecution(companyId, 'ANALYZE_STOCK', {}, result, startTime);
      return result;
    } catch (error) {
      await this.saveExecution(
        companyId,
        'ANALYZE_STOCK',
        {},
        null,
        startTime,
        error.message,
      );
      throw error;
    }
  }

  async executeProductionAnalysis(companyId: string) {
    const startTime = Date.now();
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const [inProgress, completedToday, byStatus, pending] =
        await Promise.all([
          this.prisma.productionOrder.count({
            where: { companyId, status: 'EM_PRODUCAO' },
          }),
          this.prisma.productionOrder.count({
            where: {
              companyId,
              status: 'CONCLUIDA',
              updatedAt: { gte: today, lt: tomorrow },
            },
          }),
          this.prisma.productionOrder.groupBy({
            by: ['status'],
            where: { companyId },
            _count: { id: true },
          }),
          this.prisma.productionOrder.count({
            where: {
              companyId,
              status: { in: ['PLANEJADA', 'LIBERADA'] },
            },
          }),
        ]);

      const result = {
        inProgress,
        completedToday,
        pending,
        byStatus: byStatus.map((s) => ({
          status: s.status,
          count: s._count.id,
        })),
      };

      await this.saveExecution(companyId, 'ANALYZE_PRODUCTION', {}, result, startTime);
      return result;
    } catch (error) {
      await this.saveExecution(
        companyId,
        'ANALYZE_PRODUCTION',
        {},
        null,
        startTime,
        error.message,
      );
      throw error;
    }
  }

  async executeDataQuery(companyId: string, query: string) {
    const startTime = Date.now();
    try {
      // Simple keyword-based data query — returns relevant counts/data
      const result: any = {};

      if (query.match(/cliente|person|cadastro/i)) {
        result.persons = await this.prisma.person.count({ where: { companyId } });
      }
      if (query.match(/venda|pedido|order/i)) {
        result.saleOrders = await this.prisma.saleOrder.count({
          where: { companyId },
        });
      }
      if (query.match(/produto|product/i)) {
        result.products = await this.prisma.product.count({
          where: { companyId },
        });
      }
      if (query.match(/nota|nfe|fiscal/i)) {
        result.nfeDocuments = await this.prisma.nFeDocument.count({
          where: { companyId },
        });
      }

      // If no specific match, return general overview
      if (Object.keys(result).length === 0) {
        const [persons, products, saleOrders] = await Promise.all([
          this.prisma.person.count({ where: { companyId } }),
          this.prisma.product.count({ where: { companyId } }),
          this.prisma.saleOrder.count({ where: { companyId } }),
        ]);
        result.overview = { persons, products, saleOrders };
      }

      await this.saveExecution(
        companyId,
        'QUERY_DATA',
        { query },
        result,
        startTime,
      );
      return result;
    } catch (error) {
      await this.saveExecution(
        companyId,
        'QUERY_DATA',
        { query },
        null,
        startTime,
        error.message,
      );
      throw error;
    }
  }

  async generateReport(companyId: string, reportType: string) {
    const startTime = Date.now();
    try {
      let reportData: any = {};

      switch (reportType) {
        case 'financeiro':
          const [receitas, despesas] = await Promise.all([
            this.prisma.financialMovement.aggregate({
              where: { companyId, type: 'RECEITA' },
              _sum: { valor: true },
              _count: { id: true },
            }),
            this.prisma.financialMovement.aggregate({
              where: { companyId, type: 'DESPESA' },
              _sum: { valor: true },
              _count: { id: true },
            }),
          ]);
          reportData = {
            type: 'financeiro',
            receitas: {
              total: receitas._sum.valor || 0,
              count: receitas._count.id,
            },
            despesas: {
              total: despesas._sum.valor || 0,
              count: despesas._count.id,
            },
          };
          break;

        case 'estoque':
          const stockSummary = await this.prisma.stockBalance.aggregate({
            where: { companyId },
            _sum: { totalCost: true, quantity: true },
            _count: { id: true },
          });
          reportData = {
            type: 'estoque',
            totalItems: stockSummary._count.id,
            totalQuantity: stockSummary._sum.quantity || 0,
            totalValue: stockSummary._sum.totalCost || 0,
          };
          break;

        case 'vendas':
          const salesByStatus = await this.prisma.saleOrder.groupBy({
            by: ['status'],
            where: { companyId },
            _count: { id: true },
            _sum: { total: true },
          });
          reportData = {
            type: 'vendas',
            byStatus: salesByStatus.map((s) => ({
              status: s.status,
              count: s._count.id,
              total: s._sum.total || 0,
            })),
          };
          break;

        default:
          reportData = { type: reportType, message: 'Tipo de relatorio nao suportado' };
      }

      await this.saveExecution(
        companyId,
        'GENERATE_REPORT',
        { reportType },
        reportData,
        startTime,
      );
      return reportData;
    } catch (error) {
      await this.saveExecution(
        companyId,
        'GENERATE_REPORT',
        { reportType },
        null,
        startTime,
        error.message,
      );
      throw error;
    }
  }

  // ── Sprint 4.3 — Copiloto IA ────────────────────────────────────────────

  /**
   * "Por que essa OP está atrasada?" — diagnóstico de uma ordem de produção.
   */
  async copilotOpAtrasada(companyId: string, opId: string) {
    const op = await this.prisma.productionOrder.findFirst({
      where: { id: opId, companyId },
      include: {
        product: { select: { description: true } },
        items:   { select: { quantityRequired: true, quantityConsumed: true } },
      },
    });
    if (!op) return { erro: 'OP não encontrada' };

    const now     = new Date();
    const atraso  = op.dataFimPrevista < now && op.status !== 'CONCLUIDA';
    const diasAtr = atraso
      ? Math.ceil((now.getTime() - op.dataFimPrevista.getTime()) / 86400000)
      : 0;

    const totalReq  = op.items.reduce((s, i) => s + Number(i.quantityRequired),  0);
    const totalCons = op.items.reduce((s, i) => s + Number(i.quantityConsumed),  0);
    const progresso = totalReq > 0 ? Math.round((totalCons / totalReq) * 100) : 0;

    // Verificar se há insumos sem estoque
    const reservas = await this.prisma.stockReservation.findMany({
      where: { sourceId: opId, status: 'ATIVA' as any },
      include: {
        product:  { select: { description: true, code: true } },
        location: { select: { name: true } },
      },
    }).catch(() => [] as any[]);

    const saldos = reservas.length > 0
      ? await this.prisma.stockBalance.findMany({
          where: {
            companyId,
            productId: { in: reservas.map((r: any) => r.productId) },
          },
          select: { productId: true, availableQuantity: true },
        }).catch(() => [] as any[])
      : [];
    const saldoMap = new Map(saldos.map((s: any) => [s.productId, Number(s.availableQuantity)]));

    const insumosCriticos = reservas
      .filter((r: any) => (saldoMap.get(r.productId) ?? 0) < Number(r.quantidadeReservada ?? 0))
      .map((r: any) => ({ produto: r.product?.description, disponivel: saldoMap.get(r.productId) ?? 0 }));

    const motivos: string[] = [];
    if (atraso)                      motivos.push(`Atrasada ${diasAtr} dia(s) em relação ao prazo previsto`);
    if (progresso < 30 && diasAtr > 3) motivos.push(`Progresso baixo (${progresso}%) — possível gargalo de produção`);
    if (insumosCriticos.length > 0)  motivos.push(`${insumosCriticos.length} insumo(s) com estoque insuficiente`);
    if (op.status === 'PAUSADA')      motivos.push('OP pausada manualmente — verificar motivo da pausa');

    return {
      op: {
        id: op.id, numero: op.numero, produto: op.product.description,
        status: op.status, progresso, diasAtraso: diasAtr,
        dataFimPrevista: op.dataFimPrevista,
      },
      diagnostico: motivos.length > 0 ? motivos : ['Nenhuma causa imediata identificada'],
      insumosCriticos,
      recomendacao:
        insumosCriticos.length > 0
          ? 'Verificar disponibilidade de materiais e acionar compras'
          : op.status === 'PAUSADA'
          ? 'Investigar motivo da pausa e retomar produção'
          : 'Revisar capacidade dos centros de trabalho envolvidos',
    };
  }

  /**
   * "Qual o prazo realista para essa OP?" — baseado no progresso atual.
   */
  async copilotPrazoRealista(companyId: string, opId: string) {
    const op = await this.prisma.productionOrder.findFirst({
      where: { id: opId, companyId },
      include: { items: { select: { quantityRequired: true, quantityConsumed: true } } },
    });
    if (!op) return { erro: 'OP não encontrada' };

    const now       = new Date();
    const inicio    = op.dataInicioPrevista ?? op.createdAt;
    const diasDecor = Math.max(1, Math.ceil((now.getTime() - inicio.getTime()) / 86400000));

    const totalReq  = op.items.reduce((s, i) => s + Number(i.quantityRequired),  0);
    const totalCons = op.items.reduce((s, i) => s + Number(i.quantityConsumed),  0);
    const progresso = totalReq > 0 ? totalCons / totalReq : 0;

    const velocidade     = progresso > 0 ? progresso / diasDecor : 0;
    const diasRestantes  = velocidade > 0 ? Math.ceil((1 - progresso) / velocidade) : null;
    const prazoRealista  = diasRestantes != null
      ? new Date(now.getTime() + diasRestantes * 86400000)
      : null;

    const prazoOriginal  = op.dataFimPrevista;
    const atraso         = prazoRealista && prazoRealista > prazoOriginal
      ? Math.ceil((prazoRealista.getTime() - prazoOriginal.getTime()) / 86400000)
      : 0;

    return {
      op: { id: op.id, numero: op.numero, status: op.status },
      progressoPct:    Math.round(progresso * 100),
      diasDecorridos:  diasDecor,
      velocidadeDiaria: Math.round(velocidade * 100 * 100) / 100,
      prazoOriginal,
      prazoRealista,
      diasAtrasoEstimado: atraso,
      alerta: atraso > 0
        ? `⚠️ Prazo realista excede o original em ${atraso} dia(s)`
        : '✅ Em dia com o prazo previsto',
    };
  }

  /**
   * "Performance do fornecedor" — pontualidade e volume dos últimos 12 meses.
   */
  async copilotFornecedorPerformance(companyId: string, supplierId: string) {
    const meses12 = new Date();
    meses12.setMonth(meses12.getMonth() - 12);

    const [fornecedor, pedidos] = await Promise.all([
      this.prisma.person.findFirst({
        where: { id: supplierId, companyId },
        select: { razaoSocial: true },
      }),
      this.prisma.purchaseOrder.findMany({
        where: {
          companyId,
          supplierId,
          createdAt: { gte: meses12 },
        },
        select: {
          id: true, numero: true, status: true,
          createdAt: true, dataEntregaPrevista: true, dataEntregaReal: true,
          totalValue: true,
        },
      }),
    ]);

    if (!fornecedor) return { erro: 'Fornecedor não encontrado' };

    const concluidos    = pedidos.filter((p: any) => p.status === 'RECEBIDA' || p.status === 'PARCIAL_RECEBIDA');
    const pontuais      = concluidos.filter(
      (p: any) => p.dataEntregaReal && p.dataEntregaPrevista && p.dataEntregaReal <= p.dataEntregaPrevista,
    );
    const pontualidade  = concluidos.length > 0
      ? Math.round((pontuais.length / concluidos.length) * 100)
      : null;

    const valorTotal    = pedidos.reduce((s: number, p: any) => s + Number(p.totalValue ?? 0), 0);

    return {
      fornecedor:     { id: supplierId, nome: fornecedor.razaoSocial },
      periodo:        '12 meses',
      totalPedidos:   pedidos.length,
      pedidosConcluidos: concluidos.length,
      pontualidadePct: pontualidade,
      valorTotalCompras: Math.round(valorTotal * 100) / 100,
      avaliacao:
        pontualidade == null   ? 'Sem dados suficientes' :
        pontualidade >= 90     ? '⭐ Excelente'           :
        pontualidade >= 70     ? '👍 Bom'                 :
        pontualidade >= 50     ? '⚠️ Regular'              :
        '🚨 Crítico',
    };
  }

  /**
   * "Risco de inadimplência de cliente" — análise dos recebíveis.
   */
  async copilotRiscoInadimplencia(companyId: string, personId: string) {
    const hoje   = new Date();
    const [pessoa, movimentos] = await Promise.all([
      this.prisma.person.findFirst({
        where: { id: personId, companyId },
        select: { razaoSocial: true },
      }),
      this.prisma.financialMovement.findMany({
        where: { companyId, personId, type: 'RECEITA' as any },
        select: {
          valor: true, valorPago: true, dataVencimento: true,
          dataPagamento: true, status: true,
        },
      }),
    ]);

    if (!pessoa) return { erro: 'Pessoa não encontrada' };

    const total         = movimentos.length;
    const vencidos      = movimentos.filter((m: any) => m.status === 'VENCIDO' || (m.dataVencimento < hoje && m.status === 'PENDENTE'));
    const pagos         = movimentos.filter((m: any) => m.status === 'PAGO');
    const pagosAtrasados = pagos.filter((m: any) => m.dataPagamento && m.dataPagamento > m.dataVencimento);

    const valorVencido  = vencidos.reduce((s: number, m: any) => s + Number(m.valor), 0);
    const valorTotal    = movimentos.reduce((s: number, m: any) => s + Number(m.valor), 0);
    const taxaVencido   = valorTotal > 0 ? Math.round((valorVencido / valorTotal) * 100) : 0;
    const diasMedioAtraso = pagosAtrasados.length > 0
      ? Math.round(
          pagosAtrasados.reduce((s: number, m: any) =>
            s + (new Date(m.dataPagamento).getTime() - new Date(m.dataVencimento).getTime()) / 86400000, 0,
          ) / pagosAtrasados.length,
        )
      : 0;

    const risco =
      taxaVencido >= 50 || vencidos.length >= 3 ? 'ALTO' :
      taxaVencido >= 20 || diasMedioAtraso >= 15  ? 'MÉDIO' :
      'BAIXO';

    return {
      pessoa:          { id: personId, nome: pessoa.razaoSocial },
      totalTitulos:    total,
      titulosVencidos: vencidos.length,
      valorVencido:    Math.round(valorVencido * 100) / 100,
      taxaInadimplencia: taxaVencido,
      diasMedioAtraso,
      riscoAdimplencia: risco,
      recomendacao:
        risco === 'ALTO'   ? '🚨 Solicitar garantias ou limitar crédito' :
        risco === 'MÉDIO'  ? '⚠️ Monitorar de perto e cobrar ativamente' :
        '✅ Cliente com boa história de pagamento',
    };
  }

  /**
   * "Sugestão de compra narrativa" — texto descritivo para o usuário.
   */
  async copilotSugestaoCompra(companyId: string) {
    const now    = new Date();
    const dias30 = new Date(now.getTime() - 30 * 86400000);

    // Itens abaixo do ponto de resuprimento
    // StockBalance.reorderPoint é o ponto de pedido do saldo; Product.estoqueMinimo é o mínimo geral
    const saldosCriticos = await this.prisma.stockBalance.findMany({
      where: { companyId },
      include: {
        product: {
          select: {
            description: true, code: true, unit: true,
            estoqueMinimo: true, leadTimeDias: true,
          },
        },
      },
    });

    const criticos = saldosCriticos
      .filter((b: any) => {
        const ponto = Number(b.reorderPoint ?? b.product.estoqueMinimo ?? 0);
        return ponto > 0 && Number(b.availableQuantity) <= ponto;
      })
      .map((b: any) => ({
        codigo:      b.product.code,
        descricao:   b.product.description,
        disponivel:  Number(b.availableQuantity),
        ponto:       Number(b.reorderPoint ?? b.product.estoqueMinimo ?? 0),
        leadTime:    b.product.leadTimeDias ?? 30,
        urgencia:    Number(b.availableQuantity) <= 0 ? 'CRÍTICO' : 'ALTO',
      }))
      .sort((a: any, b: any) => a.disponivel - b.disponivel)
      .slice(0, 10);

    if (criticos.length === 0) {
      return {
        resumo:    'Estoque em nível adequado',
        narrativa: '✅ Todos os itens estão acima do ponto de resuprimento. Nenhuma compra urgente necessária.',
        itens:     [],
      };
    }

    const criticos0 = criticos.filter((c: any) => c.urgencia === 'CRÍTICO');
    const narrativa = [
      `⚠️ ${criticos.length} item(ns) abaixo do ponto de resuprimento.`,
      criticos0.length > 0
        ? `🚨 ${criticos0.length} com ESTOQUE ZERADO: ${criticos0.map((c: any) => c.codigo).join(', ')}.`
        : '',
      `Principais itens críticos: ${criticos.slice(0, 3).map((c: any) => `${c.codigo} (${c.disponivel} disponível)`).join('; ')}.`,
      `Recomendação: emitir requisição de compra imediata para os ${Math.min(criticos.length, 5)} primeiros itens da lista.`,
    ].filter(Boolean).join(' ');

    return { resumo: `${criticos.length} itens críticos`, narrativa, itens: criticos };
  }

  private async saveExecution(
    companyId: string,
    toolType: string,
    input: any,
    output: any,
    startTime: number,
    errorMessage?: string,
  ) {
    // AiToolExecution requires a messageId — we'll handle this in the assistant service
    // This is a standalone record for tracking purposes
    // Note: the schema requires messageId, so we skip saving here
    // and let the assistant service handle it with proper messageId
  }
}
