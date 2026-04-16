import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';

/**
 * SaleIntegrationService
 *
 * Orchestrates all automatic side-effects triggered after a SaleOrder
 * is faturado (invoiced). Called by SaleOrdersService.faturar().
 *
 * Execution order inside a single Prisma transaction:
 *  1. Contas a Receber  (FinancialMovement RECEITA per instalment)
 *  2. Baixa de Estoque  (StockMovement SAIDA for stock items)
 *  3. Escrita Fiscal    (FiscalEntry type=DEBITO bookType=SAIDA)
 *  4. Lançamento Contábil (JournalEntry – clients/revenue, stock/CMV)
 *  5. DRE snapshot trigger (async, outside transaction)
 */
@Injectable()
export class SaleIntegrationService {
  private readonly logger = new Logger(SaleIntegrationService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onSaleOrderFaturado(
    saleOrderId: string,
    nfeId: string,
    userId: string,
  ): Promise<void> {
    const order = await this.prisma.saleOrder.findUnique({
      where: { id: saleOrderId },
      include: {
        items: { include: { product: { select: { id: true } } } },
        person: { select: { id: true } },
        company: { select: { id: true } },
        nfeDocuments: {
          where: { id: nfeId },
          select: { id: true, numero: true, serie: true, valorTotal: true },
          take: 1,
        },
      },
    });

    if (!order) throw new NotFoundException(`SaleOrder ${saleOrderId} not found`);

    const companyId = order.companyId;
    const today = new Date();
    const periodoReferencia = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const nfe = order.nfeDocuments[0] ?? null;
    const totalValue = Number(order.total);

    await this.prisma.$transaction(async (tx) => {
      // =====================================================================
      // 1. CONTAS A RECEBER — one FinancialMovement per instalment
      // =====================================================================
      const instalments = this.buildInstalments(order.condicaoPagamento, totalValue, today);

      for (const inst of instalments) {
        const numero = await this.genFinancialNumber(companyId, 'RECEITA', tx);
        await (tx as any).financialMovement.create({
          data: {
            companyId,
            type: 'RECEITA',
            status: 'PENDENTE',
            personId: order.personId,
            description: `Venda nº ${order.numero}${nfe ? ` – NF-e ${nfe.numero}` : ''}`,
            numero,
            parcela: inst.parcela,
            totalParcelas: instalments.length,
            valor: inst.valor,
            dataEmissao: today,
            dataVencimento: inst.vencimento,
            nfeDocumentId: nfeId || null,
            saleOrderId: order.id,
          },
        });
      }

      // =====================================================================
      // 2. BAIXA DE ESTOQUE — items that consume stock
      // =====================================================================
      const stockTypes = ['ESTOQUE_PROPRIO', 'VENDA_DIRETA', 'VENDA_PECA'];
      const stockItems = order.items.filter(
        (i) => stockTypes.includes(i.itemType as string) && i.productId,
      );

      const defaultLocation = await (tx as any).stockLocation.findFirst({
        where: { companyId, type: 'ALMOXARIFADO' },
        select: { id: true },
      });

      for (const item of stockItems) {
        if (!item.productId || !defaultLocation) continue;
        const qty = Number(item.quantidade);

        await (tx as any).stockMovement.create({
          data: {
            companyId,
            productId: item.productId,
            locationId: defaultLocation.id,
            type: 'SAIDA',
            source: 'VENDA',
            quantity: qty,
            unitCost: Number(item.precoUnitario),
            totalCost: Number(item.total),
            documentNumber: nfe ? nfe.numero : String(order.numero),
            saleOrderId: order.id,
            userId,
            observations: `Venda nº ${order.numero}${nfe ? ` – NF-e ${nfe.numero}` : ''}`,
          },
        });

        await (tx as any).stockBalance.updateMany({
          where: { companyId, productId: item.productId, locationId: defaultLocation.id },
          data: {
            quantity: { decrement: qty },
            availableQuantity: { decrement: qty },
            lastMovementAt: today,
          },
        });
      }

      // =====================================================================
      // 3. ESCRITA FISCAL — FiscalEntry type=DEBITO bookType=SAIDA
      // =====================================================================
      if (nfe) {
        const alreadyExists = await (tx as any).fiscalEntry.findFirst({
          where: { companyId, nfeId },
        });
        if (!alreadyExists) {
          await (tx as any).fiscalEntry.create({
            data: {
              companyId,
              type: 'DEBITO',
              bookType: 'SAIDA',
              nfeId,
              dataLancamento: today,
              periodoReferencia,
              cfopCode: '5102',
              naturezaOperacao: 'Venda de mercadoria',
              valorContabil: totalValue,
              baseCalculo: totalValue,
              aliquota: 0,
              valorImposto: 0,
              taxType: 'ICMS',
              observations: `Venda nº ${order.numero} – NF-e ${nfe.numero}`,
            },
          });
        }
      }

      // =====================================================================
      // 4. LANÇAMENTO CONTÁBIL
      //    D: Clientes (1.1.2.001)  C: Receita de Vendas (3.1.1.001)
      //    D: CMV (4.1.1.001)       C: Estoque (1.1.4.002)
      // =====================================================================
      const accounts = await this.resolveAccounts(companyId, tx);
      const lcNumero = await this.genJournalNumber(companyId, tx);

      const journalItems: any[] = [];

      if (accounts.clientes && accounts.receita) {
        journalItems.push(
          { accountId: accounts.clientes, type: 'DEVEDORA', value: totalValue, description: 'Clientes s/ venda' },
          { accountId: accounts.receita,  type: 'CREDORA',  value: totalValue, description: 'Receita de Vendas' },
        );
      }

      const stockValue = stockItems.reduce((s, i) => s + Number(i.total), 0);
      if (stockValue > 0 && accounts.cmv && accounts.estoque) {
        journalItems.push(
          { accountId: accounts.cmv,     type: 'DEVEDORA', value: stockValue, description: 'CMV – Custo das mercadorias vendidas' },
          { accountId: accounts.estoque, type: 'CREDORA',  value: stockValue, description: 'Baixa de estoque' },
        );
      }

      if (journalItems.length >= 2) {
        await (tx as any).journalEntry.create({
          data: {
            companyId,
            userId,
            numero: lcNumero,
            date: today,
            description: `Faturamento – Venda nº ${order.numero}${nfe ? ` / NF-e ${nfe.numero}` : ''}`,
            totalValue,
            status: 'LANCADO',
            items: { create: journalItems },
          },
        });
      }
    });

    this.logger.log(`Sale integration complete for order ${saleOrderId}, period ${periodoReferencia}`);
  }

  // --------------------------------------------------------------------------
  // Helpers
  // --------------------------------------------------------------------------

  private buildInstalments(
    condicao: string | null | undefined,
    total: number,
    baseDate: Date,
  ): { parcela: number; valor: number; vencimento: Date }[] {
    const match = condicao?.match(/^(\d+)[xX]/);
    const n = match ? parseInt(match[1], 10) : 1;
    const base = Math.floor((total / n) * 100) / 100;
    let remainder = total;
    const result: { parcela: number; valor: number; vencimento: Date }[] = [];

    for (let i = 1; i <= n; i++) {
      const valor = i === n ? Math.round(remainder * 100) / 100 : base;
      remainder -= valor;
      const vencimento = new Date(baseDate);
      vencimento.setDate(vencimento.getDate() + i * 30);
      result.push({ parcela: i, valor, vencimento });
    }
    return result;
  }

  private async genFinancialNumber(companyId: string, type: string, tx: any): Promise<string> {
    const d = new Date();
    const ds = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    const prefix = type === 'RECEITA' ? `CR-${ds}` : `CP-${ds}`;
    const last = await tx.financialMovement.findFirst({
      where: { companyId, numero: { startsWith: prefix } },
      orderBy: { numero: 'desc' },
    });
    const seq = last ? parseInt(last.numero.split('-').pop()!, 10) + 1 : 1;
    return `${prefix}-${String(seq).padStart(3, '0')}`;
  }

  private async genJournalNumber(companyId: string, tx: any): Promise<string> {
    const d = new Date();
    const ds = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    const prefix = `LC-${ds}`;
    const last = await tx.journalEntry.findFirst({
      where: { companyId, numero: { startsWith: prefix } },
      orderBy: { numero: 'desc' },
    });
    const seq = last ? parseInt(last.numero.split('-').pop()!, 10) + 1 : 1;
    return `${prefix}-${String(seq).padStart(3, '0')}`;
  }

  private async resolveAccounts(companyId: string, tx: any) {
    const rows = await tx.chartOfAccount.findMany({
      where: { companyId, code: { in: ['1.1.2.001', '3.1.1.001', '4.1.1.001', '1.1.4.002', '1.1.4.001'] } },
      select: { id: true, code: true },
    });
    const m: Record<string, string> = {};
    rows.forEach((r: any) => { m[r.code] = r.id; });
    return {
      clientes: m['1.1.2.001'],
      receita:  m['3.1.1.001'],
      cmv:      m['4.1.1.001'],
      estoque:  m['1.1.4.002'] ?? m['1.1.4.001'],
    };
  }
}
