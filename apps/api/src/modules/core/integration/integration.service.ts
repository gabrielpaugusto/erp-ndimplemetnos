import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';
import { IntegrationConfigService } from './integration-config.service';

@Injectable()
export class IntegrationService {
  private readonly logger = new Logger(IntegrationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: IntegrationConfigService,
  ) {}

  // ---------------------------------------------------------------------------
  // HELPERS
  // ---------------------------------------------------------------------------

  private async generateJournalNumero(companyId: string): Promise<string> {
    const today = new Date();
    const dateStr =
      today.getFullYear().toString() +
      (today.getMonth() + 1).toString().padStart(2, '0') +
      today.getDate().toString().padStart(2, '0');
    const prefix = `LC-${dateStr}`;

    const last = await this.prisma.journalEntry.findFirst({
      where: { companyId, numero: { startsWith: prefix } },
      orderBy: { numero: 'desc' },
    });

    let seq = 1;
    if (last) {
      const parts = last.numero.split('-');
      seq = parseInt(parts[parts.length - 1], 10) + 1;
    }

    return `${prefix}-${seq.toString().padStart(3, '0')}`;
  }

  private async generateMovNumero(
    companyId: string,
    type: 'RECEITA' | 'DESPESA',
  ): Promise<string> {
    const today = new Date();
    const dateStr =
      today.getFullYear().toString() +
      (today.getMonth() + 1).toString().padStart(2, '0') +
      today.getDate().toString().padStart(2, '0');
    const prefix = type === 'RECEITA' ? `CR-${dateStr}` : `CP-${dateStr}`;

    const last = await this.prisma.financialMovement.findFirst({
      where: { companyId, numero: { startsWith: prefix } },
      orderBy: { numero: 'desc' },
    });

    let seq = 1;
    if (last) {
      const parts = last.numero.split('-');
      seq = parseInt(parts[parts.length - 1], 10) + 1;
    }

    return `${prefix}-${seq.toString().padStart(3, '0')}`;
  }

  /**
   * Upserts a StockBalance record for a given product+location.
   * Uses the same unique constraint (productId_locationId) as the stock-movements service.
   */
  private async upsertStockBalance(
    tx: any,
    companyId: string,
    productId: string,
    locationId: string,
    quantityDelta: number,
    unitCost?: number,
  ): Promise<void> {
    const existing = await tx.stockBalance.findUnique({
      where: { productId_locationId: { productId, locationId } },
    });

    if (existing) {
      const newQty = Number(existing.quantity) + quantityDelta;
      const safeQty = Math.max(0, newQty);

      // Recalculate average cost only on entry (positive delta)
      let newAvgCost = Number(existing.averageCost);
      if (quantityDelta > 0 && unitCost !== undefined && unitCost > 0) {
        const oldTotal = Number(existing.quantity) * newAvgCost;
        const newTotal = quantityDelta * unitCost;
        newAvgCost =
          Number(existing.quantity) + quantityDelta > 0
            ? (oldTotal + newTotal) /
              (Number(existing.quantity) + quantityDelta)
            : unitCost;
      }

      await tx.stockBalance.update({
        where: { productId_locationId: { productId, locationId } },
        data: {
          quantity: safeQty,
          availableQuantity: { increment: quantityDelta },
          averageCost: newAvgCost,
          totalCost: safeQty * newAvgCost,
          lastMovementAt: new Date(),
        },
      });
    } else {
      const safeQty = Math.max(0, quantityDelta);
      const avgCost = unitCost ?? 0;
      await tx.stockBalance.create({
        data: {
          companyId,
          productId,
          locationId,
          quantity: safeQty,
          availableQuantity: safeQty,
          averageCost: avgCost,
          totalCost: safeQty * avgCost,
          lastMovementAt: new Date(),
        },
      });
    }
  }

  /**
   * Creates a journal entry with the given debit/credit items.
   * Skips creation if any accountId is null.
   */
  private async createJournalEntry(
    companyId: string,
    userId: string,
    description: string,
    items: Array<{
      accountId: string | null;
      type: 'DEVEDORA' | 'CREDORA';
      value: number;
      description?: string;
    }>,
  ): Promise<void> {
    // Skip if any account is missing
    if (items.some((i) => !i.accountId)) {
      this.logger.warn(
        `Skipping journal entry "${description}" — one or more accounts not found in chart`,
      );
      return;
    }

    const totalValue = items
      .filter((i) => i.type === 'DEVEDORA')
      .reduce((s, i) => s + i.value, 0);

    if (totalValue <= 0) return;

    const numero = await this.generateJournalNumero(companyId);

    await this.prisma.$transaction(async (tx) => {
      await tx.journalEntry.create({
        data: {
          companyId,
          userId,
          numero,
          date: new Date(),
          description,
          status: 'LANCADO',
          totalValue,
          items: {
            create: items.map((i) => ({
              accountId: i.accountId as string,
              type: i.type,
              value: i.value,
              description: i.description,
            })),
          },
        },
      });
    });
  }

  // ---------------------------------------------------------------------------
  // METHOD 1: onPurchaseOrderReceived
  // ---------------------------------------------------------------------------

  /**
   * Triggered after items are received from a supplier.
   * Creates stock movements, updates balances, a financial movement (AP), and a journal entry.
   */
  async onPurchaseOrderReceived(
    purchaseOrderId: string,
    companyId: string,
    userId: string,
  ): Promise<void> {
    try {
      const po = await this.prisma.purchaseOrder.findUnique({
        where: { id: purchaseOrderId },
        include: { items: { include: { product: true } } },
      });

      if (!po) {
        this.logger.warn(
          `onPurchaseOrderReceived: PurchaseOrder ${purchaseOrderId} not found`,
        );
        return;
      }

      // Find a default stock location for this company
      const defaultLocation = await this.prisma.stockLocation.findFirst({
        where: { companyId, active: true },
        orderBy: { createdAt: 'asc' },
      });

      // 1. Create StockMovements + update StockBalances for received items
      const receivedItems = po.items.filter(
        (i) => Number(i.quantityReceived) > 0,
      );

      for (const item of receivedItems) {
        try {
          if (!defaultLocation) {
            this.logger.warn(
              `onPurchaseOrderReceived: No stock location found for company ${companyId}, skipping stock movement for product ${item.productId}`,
            );
            continue;
          }

          const qty = Number(item.quantityReceived);
          const unitCost = Number(item.unitPrice);
          const totalCost = qty * unitCost;

          await this.prisma.$transaction(async (tx) => {
            await tx.stockMovement.create({
              data: {
                companyId,
                productId: item.productId,
                locationId: defaultLocation.id,
                type: 'ENTRADA',
                source: 'COMPRA',
                quantity: qty,
                unitCost,
                totalCost,
                documentNumber: po.numero,
                purchaseOrderId: po.id,
                userId,
              },
            });

            await this.upsertStockBalance(
              tx,
              companyId,
              item.productId,
              defaultLocation.id,
              qty,
              unitCost,
            );
          });
        } catch (err) {
          this.logger.error(
            `onPurchaseOrderReceived: Failed stock movement for item ${item.id}: ${err}`,
          );
        }
      }

      // 2. Financial movement (Accounts Payable)
      try {
        const totalValue = Number(po.totalValue);
        if (totalValue > 0) {
          const numero = await this.generateMovNumero(companyId, 'DESPESA');
          const dataVencimento = po.dataEntregaPrevista
            ? new Date(po.dataEntregaPrevista)
            : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

          await this.prisma.financialMovement.create({
            data: {
              companyId,
              type: 'DESPESA',
              personId: po.supplierId,
              description: `Compra PO ${po.numero}`,
              numero,
              valor: totalValue,
              dataEmissao: new Date(),
              dataVencimento,
            },
          });
        }
      } catch (err) {
        this.logger.error(
          `onPurchaseOrderReceived: Failed financial movement: ${err}`,
        );
      }

      // 3. Journal Entry: Dr Estoque / Cr Fornecedores
      try {
        const codes = this.config.getAccountCodes();
        const [estoqueId, fornecedoresId] = await Promise.all([
          this.config.findAccountId(this.prisma, companyId, codes.estoqueMerc),
          this.config.findAccountId(
            this.prisma,
            companyId,
            codes.fornecedores,
          ),
        ]);

        const totalValue = Number(po.totalValue);
        if (totalValue > 0) {
          await this.createJournalEntry(
            companyId,
            userId,
            `Compra PO ${po.numero} — recebimento`,
            [
              {
                accountId: estoqueId,
                type: 'DEVEDORA',
                value: totalValue,
                description: 'Entrada estoque',
              },
              {
                accountId: fornecedoresId,
                type: 'CREDORA',
                value: totalValue,
                description: 'Fornecedor a pagar',
              },
            ],
          );
        }
      } catch (err) {
        this.logger.error(
          `onPurchaseOrderReceived: Failed journal entry: ${err}`,
        );
      }
    } catch (err) {
      this.logger.error(
        `onPurchaseOrderReceived: Unexpected error for PO ${purchaseOrderId}: ${err}`,
      );
    }
  }

  // ---------------------------------------------------------------------------
  // METHOD 2: onNfeAuthorizedSaida
  // ---------------------------------------------------------------------------

  /**
   * Triggered after a sales NF-e (SAIDA) is authorized by SEFAZ.
   * Creates stock exits, a financial revenue, fiscal entries, and journal entries.
   */
  async onNfeAuthorizedSaida(
    nfeDocumentId: string,
    companyId: string,
    userId: string,
  ): Promise<void> {
    try {
      const nfe = await this.prisma.nFeDocument.findUnique({
        where: { id: nfeDocumentId },
        include: { items: true },
      });

      if (!nfe) {
        this.logger.warn(
          `onNfeAuthorizedSaida: NFeDocument ${nfeDocumentId} not found`,
        );
        return;
      }

      const defaultLocation = await this.prisma.stockLocation.findFirst({
        where: { companyId, active: true },
        orderBy: { createdAt: 'asc' },
      });

      // 1. Stock exits for each item with a productId
      for (const item of nfe.items.filter((i) => i.productId)) {
        try {
          if (!defaultLocation) {
            this.logger.warn(
              `onNfeAuthorizedSaida: No stock location for company ${companyId}, skipping stock exit`,
            );
            continue;
          }

          const qty = Number(item.quantity);

          await this.prisma.$transaction(async (tx) => {
            await tx.stockMovement.create({
              data: {
                companyId,
                productId: item.productId as string,
                locationId: defaultLocation.id,
                type: 'SAIDA',
                source: 'VENDA',
                quantity: qty,
                unitCost: Number(item.unitPrice),
                totalCost: Number(item.totalPrice),
                documentNumber: nfe.numero?.toString(),
                userId,
              },
            });

            await this.upsertStockBalance(
              tx,
              companyId,
              item.productId as string,
              defaultLocation.id,
              -qty,
            );
          });
        } catch (err) {
          this.logger.error(
            `onNfeAuthorizedSaida: Failed stock movement for NFeItem ${item.id}: ${err}`,
          );
        }
      }

      // 2. Financial movement (Accounts Receivable)
      try {
        const totalValue = Number(nfe.valorTotal);
        if (totalValue > 0 && nfe.personId) {
          const numero = await this.generateMovNumero(companyId, 'RECEITA');
          const dataVencimento = new Date(
            Date.now() + 30 * 24 * 60 * 60 * 1000,
          );

          await this.prisma.financialMovement.create({
            data: {
              companyId,
              type: 'RECEITA',
              personId: nfe.personId,
              description: `NF-e ${nfe.numero ?? nfeDocumentId}`,
              numero,
              valor: totalValue,
              dataEmissao: nfe.dataEmissao ?? new Date(),
              dataVencimento,
              nfeDocumentId: nfe.id,
            },
          });
        }
      } catch (err) {
        this.logger.error(
          `onNfeAuthorizedSaida: Failed financial movement: ${err}`,
        );
      }

      // 3. Fiscal entries (ICMS debit, IPI debit, PIS debit, COFINS debit)
      try {
        const periodo = this.getPeriodoReferencia();
        const cfopCode = nfe.items[0]?.cfopCode ?? '5101';
        const fiscalEntries: Array<{
          taxType: string;
          valorImposto: number;
          baseCalculo: number;
          aliquota: number;
        }> = [];

        if (nfe.valorIcms > 0) {
          fiscalEntries.push({
            taxType: 'ICMS',
            valorImposto: nfe.valorIcms,
            baseCalculo: nfe.valorProdutos,
            aliquota: 0,
          });
        }
        if (nfe.valorIpi > 0) {
          fiscalEntries.push({
            taxType: 'IPI',
            valorImposto: nfe.valorIpi,
            baseCalculo: nfe.valorProdutos,
            aliquota: 0,
          });
        }
        if (nfe.valorPis > 0) {
          fiscalEntries.push({
            taxType: 'PIS',
            valorImposto: nfe.valorPis,
            baseCalculo: nfe.valorProdutos,
            aliquota: 0,
          });
        }
        if (nfe.valorCofins > 0) {
          fiscalEntries.push({
            taxType: 'COFINS',
            valorImposto: nfe.valorCofins,
            baseCalculo: nfe.valorProdutos,
            aliquota: 0,
          });
        }

        // Reforma Tributária (IBS/CBS/IS) — LC 214/2025
        if (nfe.valorIbs > 0) {
          fiscalEntries.push({
            taxType: 'IBS',
            valorImposto: nfe.valorIbs,
            baseCalculo: nfe.valorProdutos,
            aliquota: 0,
          });
        }
        if (nfe.valorCbs > 0) {
          fiscalEntries.push({
            taxType: 'CBS',
            valorImposto: nfe.valorCbs,
            baseCalculo: nfe.valorProdutos,
            aliquota: 0,
          });
        }
        if (nfe.valorIs > 0) {
          fiscalEntries.push({
            taxType: 'IS',
            valorImposto: nfe.valorIs,
            baseCalculo: nfe.valorProdutos,
            aliquota: 0,
          });
        }

        for (const entry of fiscalEntries) {
          await this.prisma.fiscalEntry.create({
            data: {
              companyId,
              nfeId: nfe.id,
              type: 'DEBITO',
              bookType: 'SAIDA',
              dataLancamento: new Date(),
              periodoReferencia: periodo,
              cfopCode,
              naturezaOperacao: nfe.naturezaOperacao,
              valorContabil: Number(nfe.valorTotal),
              baseCalculo: entry.baseCalculo,
              aliquota: entry.aliquota,
              valorImposto: entry.valorImposto,
              taxType: entry.taxType,
            },
          });
        }
      } catch (err) {
        this.logger.error(
          `onNfeAuthorizedSaida: Failed fiscal entries: ${err}`,
        );
      }

      // 4. Journal entries: Dr Clientes / Cr Receita de Vendas; Dr CMV / Cr Estoque
      try {
        const codes = this.config.getAccountCodes();
        const [clientesId, receitaVendasId, cmvId, estoqueId] =
          await Promise.all([
            this.config.findAccountId(this.prisma, companyId, codes.clientes),
            this.config.findAccountId(
              this.prisma,
              companyId,
              codes.receitaVendas,
            ),
            this.config.findAccountId(this.prisma, companyId, codes.cmv),
            this.config.findAccountId(
              this.prisma,
              companyId,
              codes.estoqueMerc,
            ),
          ]);

        const totalValue = Number(nfe.valorTotal);
        if (totalValue > 0) {
          await this.createJournalEntry(
            companyId,
            userId,
            `NF-e ${nfe.numero ?? nfeDocumentId} — receita de venda`,
            [
              {
                accountId: clientesId,
                type: 'DEVEDORA',
                value: totalValue,
                description: 'Clientes a receber',
              },
              {
                accountId: receitaVendasId,
                type: 'CREDORA',
                value: totalValue,
                description: 'Receita de vendas',
              },
            ],
          );
        }

        // CMV / Estoque — only if both accounts exist and there are product items with cost
        const totalCost = nfe.items.reduce(
          (s, i) => s + Number(i.totalPrice),
          0,
        );
        if (totalCost > 0) {
          await this.createJournalEntry(
            companyId,
            userId,
            `NF-e ${nfe.numero ?? nfeDocumentId} — CMV`,
            [
              {
                accountId: cmvId,
                type: 'DEVEDORA',
                value: totalCost,
                description: 'Custo das mercadorias vendidas',
              },
              {
                accountId: estoqueId,
                type: 'CREDORA',
                value: totalCost,
                description: 'Baixa de estoque',
              },
            ],
          );
        }
      } catch (err) {
        this.logger.error(
          `onNfeAuthorizedSaida: Failed journal entries: ${err}`,
        );
      }
    } catch (err) {
      this.logger.error(
        `onNfeAuthorizedSaida: Unexpected error for NFe ${nfeDocumentId}: ${err}`,
      );
    }
  }

  // ---------------------------------------------------------------------------
  // METHOD 3: onNfeAuthorizedEntrada
  // ---------------------------------------------------------------------------

  /**
   * Triggered after a purchase NF-e (ENTRADA) is authorized.
   * Creates stock entries, a financial payable, fiscal credit entries, and a journal entry.
   */
  async onNfeAuthorizedEntrada(
    nfeDocumentId: string,
    companyId: string,
    userId: string,
  ): Promise<void> {
    try {
      const nfe = await this.prisma.nFeDocument.findUnique({
        where: { id: nfeDocumentId },
        include: { items: true },
      });

      if (!nfe) {
        this.logger.warn(
          `onNfeAuthorizedEntrada: NFeDocument ${nfeDocumentId} not found`,
        );
        return;
      }

      const defaultLocation = await this.prisma.stockLocation.findFirst({
        where: { companyId, active: true },
        orderBy: { createdAt: 'asc' },
      });

      // 1. Stock entries for each item with a productId
      for (const item of nfe.items.filter((i) => i.productId)) {
        try {
          if (!defaultLocation) {
            this.logger.warn(
              `onNfeAuthorizedEntrada: No stock location for company ${companyId}, skipping`,
            );
            continue;
          }

          const qty = Number(item.quantity);
          const unitCost = Number(item.unitPrice);

          await this.prisma.$transaction(async (tx) => {
            await tx.stockMovement.create({
              data: {
                companyId,
                productId: item.productId as string,
                locationId: defaultLocation.id,
                type: 'ENTRADA',
                source: 'COMPRA',
                quantity: qty,
                unitCost,
                totalCost: qty * unitCost,
                documentNumber: nfe.numero?.toString(),
                userId,
              },
            });

            await this.upsertStockBalance(
              tx,
              companyId,
              item.productId as string,
              defaultLocation.id,
              qty,
              unitCost,
            );
          });
        } catch (err) {
          this.logger.error(
            `onNfeAuthorizedEntrada: Failed stock movement for NFeItem ${item.id}: ${err}`,
          );
        }
      }

      // 2. Financial movement (Accounts Payable)
      try {
        const totalValue = Number(nfe.valorTotal);
        if (totalValue > 0 && nfe.personId) {
          const numero = await this.generateMovNumero(companyId, 'DESPESA');
          const dataVencimento = new Date(
            Date.now() + 30 * 24 * 60 * 60 * 1000,
          );

          await this.prisma.financialMovement.create({
            data: {
              companyId,
              type: 'DESPESA',
              personId: nfe.personId,
              description: `NF-e entrada ${nfe.numero ?? nfeDocumentId}`,
              numero,
              valor: totalValue,
              dataEmissao: nfe.dataEmissao ?? new Date(),
              dataVencimento,
              nfeDocumentId: nfe.id,
            },
          });
        }
      } catch (err) {
        this.logger.error(
          `onNfeAuthorizedEntrada: Failed financial movement: ${err}`,
        );
      }

      // 3. Fiscal credit entries (ICMS, PIS, COFINS)
      try {
        const periodo = this.getPeriodoReferencia();
        const cfopCode = nfe.items[0]?.cfopCode ?? '1101';
        const fiscalEntries: Array<{
          taxType: string;
          valorImposto: number;
          baseCalculo: number;
        }> = [];

        if (nfe.valorIcms > 0) {
          fiscalEntries.push({
            taxType: 'ICMS',
            valorImposto: nfe.valorIcms,
            baseCalculo: nfe.valorProdutos,
          });
        }
        if (nfe.valorPis > 0) {
          fiscalEntries.push({
            taxType: 'PIS',
            valorImposto: nfe.valorPis,
            baseCalculo: nfe.valorProdutos,
          });
        }
        if (nfe.valorCofins > 0) {
          fiscalEntries.push({
            taxType: 'COFINS',
            valorImposto: nfe.valorCofins,
            baseCalculo: nfe.valorProdutos,
          });
        }

        // Reforma Tributária (IBS/CBS) — crédito nas entradas (LC 214/2025)
        if (nfe.valorIbs > 0) {
          fiscalEntries.push({
            taxType: 'IBS',
            valorImposto: nfe.valorIbs,
            baseCalculo: nfe.valorProdutos,
          });
        }
        if (nfe.valorCbs > 0) {
          fiscalEntries.push({
            taxType: 'CBS',
            valorImposto: nfe.valorCbs,
            baseCalculo: nfe.valorProdutos,
          });
        }

        for (const entry of fiscalEntries) {
          await this.prisma.fiscalEntry.create({
            data: {
              companyId,
              nfeId: nfe.id,
              type: 'CREDITO',
              bookType: 'ENTRADA',
              dataLancamento: new Date(),
              periodoReferencia: periodo,
              cfopCode,
              naturezaOperacao: nfe.naturezaOperacao,
              valorContabil: Number(nfe.valorTotal),
              baseCalculo: entry.baseCalculo,
              aliquota: 0,
              valorImposto: entry.valorImposto,
              taxType: entry.taxType,
            },
          });
        }
      } catch (err) {
        this.logger.error(
          `onNfeAuthorizedEntrada: Failed fiscal entries: ${err}`,
        );
      }

      // 4. Journal Entry: Dr Estoque / Cr Fornecedores
      try {
        const codes = this.config.getAccountCodes();
        const [estoqueId, fornecedoresId] = await Promise.all([
          this.config.findAccountId(this.prisma, companyId, codes.estoqueMerc),
          this.config.findAccountId(
            this.prisma,
            companyId,
            codes.fornecedores,
          ),
        ]);

        const totalValue = Number(nfe.valorTotal);
        if (totalValue > 0) {
          await this.createJournalEntry(
            companyId,
            userId,
            `NF-e entrada ${nfe.numero ?? nfeDocumentId}`,
            [
              {
                accountId: estoqueId,
                type: 'DEVEDORA',
                value: totalValue,
                description: 'Entrada estoque por NF-e',
              },
              {
                accountId: fornecedoresId,
                type: 'CREDORA',
                value: totalValue,
                description: 'Fornecedor a pagar',
              },
            ],
          );
        }
      } catch (err) {
        this.logger.error(
          `onNfeAuthorizedEntrada: Failed journal entry: ${err}`,
        );
      }
    } catch (err) {
      this.logger.error(
        `onNfeAuthorizedEntrada: Unexpected error for NFe ${nfeDocumentId}: ${err}`,
      );
    }
  }

  // ---------------------------------------------------------------------------
  // METHOD 4: onFinancialMovementPaid
  // ---------------------------------------------------------------------------

  /**
   * Triggered after a financial movement is marked as paid.
   * Creates a bank transaction, updates the bank account balance, and posts a journal entry.
   */
  async onFinancialMovementPaid(
    movementId: string,
    companyId: string,
    userId: string,
  ): Promise<void> {
    try {
      const movement = await this.prisma.financialMovement.findUnique({
        where: { id: movementId },
      });

      if (!movement) {
        this.logger.warn(
          `onFinancialMovementPaid: FinancialMovement ${movementId} not found`,
        );
        return;
      }

      const bankAccountId = movement.bankAccountId;
      const valorPago = Number(movement.valorPago ?? movement.valor);

      // 1. Bank transaction + balance update
      if (bankAccountId) {
        try {
          const account = await this.prisma.bankAccount.findUnique({
            where: { id: bankAccountId },
          });

          if (account) {
            const transactionType =
              movement.type === 'RECEITA' ? 'CREDITO' : 'DEBITO';
            const newBalance =
              movement.type === 'RECEITA'
                ? Number(account.saldoAtual) + valorPago
                : Number(account.saldoAtual) - valorPago;

            await this.prisma.$transaction(async (tx) => {
              await tx.bankTransaction.create({
                data: {
                  companyId,
                  bankAccountId,
                  type: transactionType,
                  date: movement.dataPagamento ?? new Date(),
                  value: valorPago,
                  balance: newBalance,
                  description: `${movement.type === 'RECEITA' ? 'Recebimento' : 'Pagamento'}: ${movement.description}`,
                  financialMovementId: movementId,
                },
              });

              await tx.bankAccount.update({
                where: { id: bankAccountId },
                data: { saldoAtual: newBalance },
              });
            });
          }
        } catch (err) {
          this.logger.error(
            `onFinancialMovementPaid: Failed bank transaction: ${err}`,
          );
        }
      }

      // 2. Journal entry
      try {
        const codes = this.config.getAccountCodes();
        const [bancoId, fornecedoresId, clientesId] = await Promise.all([
          this.config.findAccountId(this.prisma, companyId, codes.banco),
          this.config.findAccountId(
            this.prisma,
            companyId,
            codes.fornecedores,
          ),
          this.config.findAccountId(this.prisma, companyId, codes.clientes),
        ]);

        if (movement.type === 'DESPESA') {
          // Dr Fornecedores / Cr Banco
          await this.createJournalEntry(
            companyId,
            userId,
            `Pagamento: ${movement.description}`,
            [
              {
                accountId: fornecedoresId,
                type: 'DEVEDORA',
                value: valorPago,
                description: 'Baixa fornecedor',
              },
              {
                accountId: bancoId,
                type: 'CREDORA',
                value: valorPago,
                description: 'Saída bancária',
              },
            ],
          );
        } else {
          // Dr Banco / Cr Clientes
          await this.createJournalEntry(
            companyId,
            userId,
            `Recebimento: ${movement.description}`,
            [
              {
                accountId: bancoId,
                type: 'DEVEDORA',
                value: valorPago,
                description: 'Entrada bancária',
              },
              {
                accountId: clientesId,
                type: 'CREDORA',
                value: valorPago,
                description: 'Baixa cliente',
              },
            ],
          );
        }
      } catch (err) {
        this.logger.error(
          `onFinancialMovementPaid: Failed journal entry: ${err}`,
        );
      }
    } catch (err) {
      this.logger.error(
        `onFinancialMovementPaid: Unexpected error for movement ${movementId}: ${err}`,
      );
    }
  }

  // ---------------------------------------------------------------------------
  // METHOD 5: onProductionOrderCompleted
  // ---------------------------------------------------------------------------

  /**
   * Triggered when a production order is completed.
   * Creates stock entries for the finished product, exits for consumed components,
   * and a journal entry for the inventory transfer.
   */
  async onProductionOrderCompleted(
    productionOrderId: string,
    companyId: string,
    userId: string,
  ): Promise<void> {
    try {
      const po = await this.prisma.productionOrder.findUnique({
        where: { id: productionOrderId },
        include: { items: true },
      });

      if (!po) {
        this.logger.warn(
          `onProductionOrderCompleted: ProductionOrder ${productionOrderId} not found`,
        );
        return;
      }

      const defaultLocation = await this.prisma.stockLocation.findFirst({
        where: { companyId, active: true },
        orderBy: { createdAt: 'asc' },
      });

      if (!defaultLocation) {
        this.logger.warn(
          `onProductionOrderCompleted: No stock location for company ${companyId}`,
        );
        return;
      }

      const qtyProduced = Number(po.quantityProduced);

      // 1. Stock entry for the finished product
      if (qtyProduced > 0) {
        try {
          await this.prisma.$transaction(async (tx) => {
            await tx.stockMovement.create({
              data: {
                companyId,
                productId: po.productId,
                locationId: defaultLocation.id,
                type: 'ENTRADA',
                source: 'PRODUCAO',
                quantity: qtyProduced,
                unitCost: 0,
                totalCost: 0,
                documentNumber: po.numero,
                productionOrderId: po.id,
                userId,
              },
            });

            await this.upsertStockBalance(
              tx,
              companyId,
              po.productId,
              defaultLocation.id,
              qtyProduced,
            );
          });
        } catch (err) {
          this.logger.error(
            `onProductionOrderCompleted: Failed finished product stock entry: ${err}`,
          );
        }
      }

      // 2. Stock exits for consumed components
      for (const item of po.items.filter(
        (i) => Number(i.quantityConsumed) > 0,
      )) {
        try {
          const qty = Number(item.quantityConsumed);

          await this.prisma.$transaction(async (tx) => {
            await tx.stockMovement.create({
              data: {
                companyId,
                productId: item.productId,
                locationId: defaultLocation.id,
                type: 'SAIDA',
                source: 'PRODUCAO',
                quantity: qty,
                unitCost: 0,
                totalCost: 0,
                documentNumber: po.numero,
                productionOrderId: po.id,
                userId,
              },
            });

            await this.upsertStockBalance(
              tx,
              companyId,
              item.productId,
              defaultLocation.id,
              -qty,
            );
          });
        } catch (err) {
          this.logger.error(
            `onProductionOrderCompleted: Failed component stock exit for item ${item.id}: ${err}`,
          );
        }
      }

      // 3. Journal Entry: Dr Estoque Produtos Acabados / Cr Estoque MP
      try {
        const codes = this.config.getAccountCodes();
        const [estoqueProdId, estoqueMPId] = await Promise.all([
          this.config.findAccountId(
            this.prisma,
            companyId,
            codes.estoqueProd,
          ),
          this.config.findAccountId(this.prisma, companyId, codes.estoqueMP),
        ]);

        // Use a nominal cost of 1.00 per unit if no costing info available
        const nominalValue = qtyProduced;
        if (nominalValue > 0) {
          await this.createJournalEntry(
            companyId,
            userId,
            `Produção OP ${po.numero} — transferência de estoque`,
            [
              {
                accountId: estoqueProdId,
                type: 'DEVEDORA',
                value: nominalValue,
                description: 'Entrada produtos acabados',
              },
              {
                accountId: estoqueMPId,
                type: 'CREDORA',
                value: nominalValue,
                description: 'Baixa matéria-prima',
              },
            ],
          );
        }
      } catch (err) {
        this.logger.error(
          `onProductionOrderCompleted: Failed journal entry: ${err}`,
        );
      }
    } catch (err) {
      this.logger.error(
        `onProductionOrderCompleted: Unexpected error for PO ${productionOrderId}: ${err}`,
      );
    }
  }

  // ---------------------------------------------------------------------------
  // METHOD 6: onServiceOrderDelivered
  // ---------------------------------------------------------------------------

  /**
   * Triggered when a service order is delivered to the customer.
   * Creates a financial revenue movement and a journal entry.
   */
  async onServiceOrderDelivered(
    serviceOrderId: string,
    companyId: string,
    userId: string,
  ): Promise<void> {
    try {
      const so = await this.prisma.serviceOrder.findUnique({
        where: { id: serviceOrderId },
      });

      if (!so) {
        this.logger.warn(
          `onServiceOrderDelivered: ServiceOrder ${serviceOrderId} not found`,
        );
        return;
      }

      const valorTotal =
        Number(so.valorPecas) + Number(so.valorMaoDeObra);

      // 1. Financial movement (Accounts Receivable)
      try {
        if (valorTotal > 0) {
          const numero = await this.generateMovNumero(companyId, 'RECEITA');
          const dataVencimento = new Date(
            Date.now() + 5 * 24 * 60 * 60 * 1000,
          );

          await this.prisma.financialMovement.create({
            data: {
              companyId,
              type: 'RECEITA',
              personId: so.personId,
              description: `OS ${so.numero}`,
              numero,
              valor: valorTotal,
              dataEmissao: new Date(),
              dataVencimento,
            },
          });
        }
      } catch (err) {
        this.logger.error(
          `onServiceOrderDelivered: Failed financial movement: ${err}`,
        );
      }

      // 2. Journal Entry: Dr Clientes / Cr Receita Serviços
      try {
        const codes = this.config.getAccountCodes();
        const [clientesId, receitaServicosId] = await Promise.all([
          this.config.findAccountId(this.prisma, companyId, codes.clientes),
          this.config.findAccountId(
            this.prisma,
            companyId,
            codes.receitaServicos,
          ),
        ]);

        if (valorTotal > 0) {
          await this.createJournalEntry(
            companyId,
            userId,
            `Entrega OS ${so.numero} — receita de serviços`,
            [
              {
                accountId: clientesId,
                type: 'DEVEDORA',
                value: valorTotal,
                description: 'Cliente a receber — serviços',
              },
              {
                accountId: receitaServicosId,
                type: 'CREDORA',
                value: valorTotal,
                description: 'Receita de serviços',
              },
            ],
          );
        }
      } catch (err) {
        this.logger.error(
          `onServiceOrderDelivered: Failed journal entry: ${err}`,
        );
      }
    } catch (err) {
      this.logger.error(
        `onServiceOrderDelivered: Unexpected error for SO ${serviceOrderId}: ${err}`,
      );
    }
  }

  // ---------------------------------------------------------------------------
  // METHOD 7: onPayrollPaid
  // ---------------------------------------------------------------------------

  /**
   * Triggered when a payroll is marked as paid.
   * Creates financial movements for each employee's net pay, FGTS, and INSS,
   * and posts a summary journal entry.
   */
  async onPayrollPaid(
    payrollId: string,
    companyId: string,
    userId: string,
  ): Promise<void> {
    try {
      const payroll = await this.prisma.payroll.findUnique({
        where: { id: payrollId },
        include: {
          items: {
            include: {
              employee: { include: { person: true } },
            },
          },
        },
      });

      if (!payroll) {
        this.logger.warn(`onPayrollPaid: Payroll ${payrollId} not found`);
        return;
      }

      let totalFgts = 0;
      let totalInssPatronal = 0;

      // 1. Financial movement per employee (net pay)
      for (const item of payroll.items) {
        try {
          const valorLiquido = Number(item.totalLiquido);
          if (valorLiquido > 0 && item.employee.personId) {
            const numero = await this.generateMovNumero(companyId, 'DESPESA');
            await this.prisma.financialMovement.create({
              data: {
                companyId,
                type: 'DESPESA',
                personId: item.employee.personId,
                description: `Salário ${item.employee.matricula} — ${payroll.periodoReferencia}`,
                numero,
                valor: valorLiquido,
                dataEmissao: new Date(),
                dataVencimento: payroll.dataPagamento ?? new Date(),
              },
            });
          }

          totalFgts += Number(item.fgts);
          totalInssPatronal += Number(item.inssPatronal);
        } catch (err) {
          this.logger.error(
            `onPayrollPaid: Failed financial movement for employee ${item.employeeId}: ${err}`,
          );
        }
      }

      // 2. FGTS financial movement (aggregate)
      if (totalFgts > 0) {
        try {
          const numero = await this.generateMovNumero(companyId, 'DESPESA');
          await this.prisma.financialMovement.create({
            data: {
              companyId,
              type: 'DESPESA',
              // Use first employee's personId as placeholder; FGTS is a government obligation
              personId: payroll.items[0]?.employee.personId ?? '',
              description: `FGTS — ${payroll.periodoReferencia}`,
              numero,
              valor: totalFgts,
              dataEmissao: new Date(),
              dataVencimento: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
            },
          });
        } catch (err) {
          this.logger.error(`onPayrollPaid: Failed FGTS movement: ${err}`);
        }
      }

      // 3. INSS patronal financial movement (aggregate)
      if (totalInssPatronal > 0) {
        try {
          const numero = await this.generateMovNumero(companyId, 'DESPESA');
          await this.prisma.financialMovement.create({
            data: {
              companyId,
              type: 'DESPESA',
              personId: payroll.items[0]?.employee.personId ?? '',
              description: `INSS patronal — ${payroll.periodoReferencia}`,
              numero,
              valor: totalInssPatronal,
              dataEmissao: new Date(),
              dataVencimento: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
            },
          });
        } catch (err) {
          this.logger.error(
            `onPayrollPaid: Failed INSS patronal movement: ${err}`,
          );
        }
      }

      // 4. Journal Entry: Dr Despesa Salários / Cr Salários a Pagar
      try {
        const codes = this.config.getAccountCodes();
        const [despSalariosId, salariosAPagarId] = await Promise.all([
          this.config.findAccountId(
            this.prisma,
            companyId,
            codes.despSalarios,
          ),
          this.config.findAccountId(
            this.prisma,
            companyId,
            codes.salariosAPagar,
          ),
        ]);

        const totalBruto = Number(payroll.totalBruto);
        if (totalBruto > 0) {
          await this.createJournalEntry(
            companyId,
            userId,
            `Folha de pagamento ${payroll.periodoReferencia}`,
            [
              {
                accountId: despSalariosId,
                type: 'DEVEDORA',
                value: totalBruto,
                description: 'Despesa com salários',
              },
              {
                accountId: salariosAPagarId,
                type: 'CREDORA',
                value: totalBruto,
                description: 'Salários a pagar',
              },
            ],
          );
        }
      } catch (err) {
        this.logger.error(`onPayrollPaid: Failed journal entry: ${err}`);
      }
    } catch (err) {
      this.logger.error(
        `onPayrollPaid: Unexpected error for payroll ${payrollId}: ${err}`,
      );
    }
  }

  // ---------------------------------------------------------------------------
  // METHOD 8: onRequisitionDelivered
  // ---------------------------------------------------------------------------

  /**
   * Triggered when an internal requisition is delivered.
   * A8: derives StockMovement.source from Requisition.type and validates product flags.
   */
  async onRequisitionDelivered(
    requisitionId: string,
    companyId: string,
    userId: string,
  ): Promise<void> {
    // A8: mapeamento RequisitionType → StockMovementSource
    const TYPE_TO_SOURCE: Record<string, string> = {
      OP:           'PRODUCAO',
      RGGF:         'RGGF',
      RUC:          'RUC',
      INTERNA:      'OS',        // INTERNA com OS vinculada → source OS
      TRANSFERENCIA:'REQUISICAO', // transferência genérica
      COMPRA:       'REQUISICAO',
    };

    // A8: mapeamento source → flag obrigatória no produto
    const SOURCE_TO_FLAG: Record<string, string> = {
      PRODUCAO: 'usoProducaoOp',
      RGGF:     'usoGgf',
      OS:       'usoOficinaOs',
      VENDA:    'usoRevenda',
      RUC:      'usoConsumo',
    };

    const FLAG_LABELS: Record<string, string> = {
      usoProducaoOp: 'Ordem de Produção (OP)',
      usoGgf:        'Requisição GGF',
      usoOficinaOs:  'Ordem de Serviço (OS)',
      usoRevenda:    'Pedido de Venda',
      usoConsumo:    'Requisição de Uso e Consumo (RUC)',
    };

    try {
      const requisition = await this.prisma.requisition.findUnique({
        where: { id: requisitionId },
        include: {
          items: {
            include: {
              product: {
                select: {
                  id: true, controlaEstoque: true,
                  usoProducaoOp: true, usoGgf: true,
                  usoOficinaOs: true, usoRevenda: true, usoConsumo: true,
                },
              },
            },
          },
        },
      });

      if (!requisition) {
        this.logger.warn(
          `onRequisitionDelivered: Requisition ${requisitionId} not found`,
        );
        return;
      }

      // Determina source pelo tipo da requisição
      const reqType = (requisition as any).type as string;
      // INTERNA sem OS vinculada → consumo interno genérico
      const hasOS = !!(requisition as any).serviceOrderId || !!(requisition as any).calderariaOrderId;
      const source = reqType === 'INTERNA' && !hasOS
        ? 'REQUISICAO'
        : (TYPE_TO_SOURCE[reqType] ?? 'REQUISICAO');

      const flagField = SOURCE_TO_FLAG[source];

      const defaultLocation = await this.prisma.stockLocation.findFirst({
        where: { companyId, active: true, type: 'ALMOXARIFADO' },
        orderBy: { createdAt: 'asc' },
      });

      if (!defaultLocation) {
        this.logger.warn(
          `onRequisitionDelivered: No stock location for company ${companyId}`,
        );
        return;
      }

      const deliveredItems = requisition.items.filter(
        (i) => Number(i.quantityDelivered) > 0,
      );

      for (const item of deliveredItems) {
        try {
          const qty  = Number(item.quantityDelivered);
          const prod = (item as any).product;

          // A8: valida flag de finalidade no produto
          if (flagField && prod && !(prod as any)[flagField]) {
            this.logger.warn(
              `onRequisitionDelivered: Produto ${prod.id} não habilitado para ${FLAG_LABELS[flagField] ?? source} — item ${item.id} ignorado`,
            );
            continue;
          }

          // Se não controla estoque, cria o movimento mas não altera saldo
          const controlaEstoque = prod?.controlaEstoque ?? true;

          await this.prisma.$transaction(async (tx) => {
            await tx.stockMovement.create({
              data: {
                companyId,
                productId: item.productId,
                locationId: defaultLocation.id,
                type: 'SAIDA',
                source: source as any,
                quantity: qty,
                unitCost: 0,
                totalCost: 0,
                documentNumber: requisition.numero,
                requisitionId: requisition.id,
                userId,
              },
            });

            if (controlaEstoque) {
              await this.upsertStockBalance(
                tx,
                companyId,
                item.productId,
                defaultLocation.id,
                -qty,
              );
            }
          });
        } catch (err) {
          this.logger.error(
            `onRequisitionDelivered: Failed stock movement for item ${item.id}: ${err}`,
          );
        }
      }
    } catch (err) {
      this.logger.error(
        `onRequisitionDelivered: Unexpected error for requisition ${requisitionId}: ${err}`,
      );
    }
  }

  // ---------------------------------------------------------------------------
  // PRIVATE HELPERS
  // ---------------------------------------------------------------------------

  private getPeriodoReferencia(): string {
    const now = new Date();
    return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
  }
}
