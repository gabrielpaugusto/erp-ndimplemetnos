import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';

/**
 * PurchaseIntegrationService
 *
 * Orchestrates automatic side-effects triggered after a NF-e entry is posted
 * in the purchasing flow. Called by NfeInboxService.postEntry().
 *
 * Creates:
 *  1. Contas a Pagar   (FinancialMovement DESPESA)
 *  2. Escrita Fiscal   (FiscalEntry type=CREDITO bookType=ENTRADA)
 *  3. Lançamento Contábil (D Estoque / C Fornecedores)
 */
@Injectable()
export class PurchaseIntegrationService {
  private readonly logger = new Logger(PurchaseIntegrationService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onReceiptPosted(
    companyId: string,
    inboxId: string,
    userId: string,
  ): Promise<void> {
    const inbox = await this.prisma.nFeInbox.findFirst({
      where: { id: inboxId, companyId },
      include: {
        emitentePessoa: { select: { id: true } },
      },
    });

    if (!inbox) throw new NotFoundException(`NFeInbox ${inboxId} not found`);

    const today = new Date();
    const periodoReferencia = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const totalValue = inbox.valorTotal.toNumber();

    await this.prisma.$transaction(async (tx) => {
      // =====================================================================
      // 1. CONTAS A PAGAR — single movement (default 30-day term)
      // =====================================================================
      if (inbox.emitentePessoaId) {
        const alreadyExists = await (tx as any).financialMovement.findFirst({
          where: { companyId, observations: { contains: inbox.chaveAcesso } },
        });

        if (!alreadyExists) {
          const numero = await this.genFinancialNumber(companyId, 'DESPESA', tx);
          const vencimento = new Date(today);
          vencimento.setDate(vencimento.getDate() + 30);

          await (tx as any).financialMovement.create({
            data: {
              companyId,
              type: 'DESPESA',
              status: 'PENDENTE',
              personId: inbox.emitentePessoaId,
              description: `Compra – NF-e ${inbox.numero} / ${inbox.emitenteNome}`,
              numero,
              parcela: 1,
              totalParcelas: 1,
              valor: totalValue,
              dataEmissao: today,
              dataVencimento: vencimento,
              observations: `Chave de acesso: ${inbox.chaveAcesso}`,
            },
          });
        }
      }

      // =====================================================================
      // 2. ESCRITA FISCAL ENTRADA — type=CREDITO bookType=ENTRADA
      // =====================================================================
      const existingFiscal = await (tx as any).fiscalEntry.findFirst({
        where: { companyId, observations: { contains: inbox.chaveAcesso } },
      });

      if (!existingFiscal) {
        await (tx as any).fiscalEntry.create({
          data: {
            companyId,
            type: 'CREDITO',
            bookType: 'ENTRADA',
            dataLancamento: today,
            periodoReferencia,
            cfopCode: '1102',
            naturezaOperacao: 'Compra para comercialização',
            valorContabil: totalValue,
            baseCalculo: totalValue,
            aliquota: 0,
            valorImposto: 0,
            taxType: 'ICMS',
            observations: `NF-e ${inbox.numero} – ${inbox.emitenteNome} – Chave: ${inbox.chaveAcesso}`,
          },
        });
      }

      // =====================================================================
      // 3. LANÇAMENTO CONTÁBIL: D Estoque (1.1.4.001) / C Fornecedores (2.1.1.001)
      // =====================================================================
      const accounts = await this.resolveAccounts(companyId, tx);

      if (accounts.estoque && accounts.fornecedores) {
        const lcNumero = await this.genJournalNumber(companyId, tx);
        await (tx as any).journalEntry.create({
          data: {
            companyId,
            userId,
            numero: lcNumero,
            date: today,
            description: `Recebimento – NF-e ${inbox.numero} / ${inbox.emitenteNome}`,
            totalValue,
            status: 'LANCADO',
            items: {
              create: [
                { accountId: accounts.estoque,     type: 'DEVEDORA', value: totalValue, description: 'Entrada em estoque' },
                { accountId: accounts.fornecedores, type: 'CREDORA',  value: totalValue, description: 'Fornecedores – NF-e entrada' },
              ],
            },
          },
        });
      }
    });

    this.logger.log(`Purchase integration complete for inbox ${inboxId}, period ${periodoReferencia}`);
  }

  // --------------------------------------------------------------------------
  // Helpers
  // --------------------------------------------------------------------------

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
      where: { companyId, code: { in: ['1.1.4.001', '2.1.1.001'] } },
      select: { id: true, code: true },
    });
    const m: Record<string, string> = {};
    rows.forEach((r: any) => { m[r.code] = r.id; });
    return {
      estoque:     m['1.1.4.001'],
      fornecedores: m['2.1.1.001'],
    };
  }
}
