import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';

// ─── Tipos públicos ───────────────────────────────────────────────────────────

export type FinalidadeEntrada = 'INDUSTRIALIZACAO' | 'REVENDA' | 'USO_CONSUMO' | 'ATIVO_IMOBILIZADO';

export interface EntradaCst60ItemResult {
  inboxItemId:          string;
  numeroItem:           number;
  descricao:            string;
  ncm:                  string;
  valorTotal:           number;
  cstIcms:              string;
  bcIcmsOp:             number;
  aliqIcmsOp:           number;
  valorIcmsOp:          number;
  /** Crédito gerado (Art. 272): igual ao valorIcmsOp quando finalidade = INDUSTRIALIZACAO */
  valorCreditoGerado:   number;
  /** ID do FiscalEntry criado */
  fiscalEntryId:        string | null;
  mensagem:             string;
}

export interface ProcessarEntradaCst60Result {
  inboxId:              string;
  emitenteNome:         string;
  dataEmissao:          Date;
  finalidade:           FinalidadeEntrada;
  periodoReferencia:    string;
  itensCst60:           number;
  itensComCredito:      number;
  totalCreditoGerado:   number;
  items:                EntradaCst60ItemResult[];
  alertas:              string[];
}

// ─── Service ──────────────────────────────────────────────────────────────────

/**
 * Etapa 5 — Escrituração Entrada CST 60 com Crédito Art. 272 RICMS-SP
 *
 * Quando a ND (substituta) RECEBE uma NF-e com CST 60 (ST já recolhida pelo
 * remetente), pode creditar o ICMS da operação própria do substituto se a
 * mercadoria for utilizada em processo de industrialização (Art. 272 RICMS-SP).
 *
 * Fluxo:
 *  1. Lê o NFeInbox e seus items onde cstIcms = "60"
 *  2. Verifica se a finalidade da entrada = INDUSTRIALIZACAO
 *  3. Para cada item elegível: cria FiscalEntry CREDITO com:
 *       - taxType    = "ICMS"
 *       - bookType   = "ENTRADA"
 *       - type       = "CREDITO"
 *       - valorImposto = item.valorIcmsOp (ICMS da op. própria do substituto)
 *       - codigoAjusteSped = "SP20020100"
 *       - fundamentoLegal  = "Art. 272 RICMS-SP (Decreto 45.490/2000)"
 *  4. Idempotente: verifica existência pelo nfeInboxId + codigoAjusteSped + item
 *
 * Referência SPED:
 *  - C197: ajuste por item (código SP20020100)
 *  - E111: ajuste de apuração do período (mesmo código)
 *  - E110: campo VL_AJ_CREDITOS acumula o total dos créditos Art. 272
 */
@Injectable()
export class StEntradaCst60Service {
  private readonly logger = new Logger(StEntradaCst60Service.name);

  /** Código de ajuste SPED para crédito Art. 272 RICMS-SP */
  static readonly CODIGO_AJUSTE_ART272 = 'SP20020100';
  static readonly FUNDAMENTO_ART272    = 'Art. 272, RICMS-SP (Decreto 45.490/2000) — Crédito do ICMS relativo à operação própria do substituto, quando a mercadoria com CST 60 é destinada à industrialização';

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Processa uma NF-e de entrada (NFeInbox) verificando crédito Art. 272.
   *
   * @param inboxId     ID do NFeInbox
   * @param finalidade  Finalidade da entrada informada pelo usuário (ou herdada do PurchaseOrder)
   * @param companyId   ID da empresa destinatária
   */
  async processarEntradaCst60(
    inboxId: string,
    finalidade: FinalidadeEntrada,
    companyId: string,
  ): Promise<ProcessarEntradaCst60Result> {

    const inbox = await this.prisma.nFeInbox.findFirst({
      where: { id: inboxId, companyId },
      include: {
        items: {
          orderBy: { numeroItem: 'asc' },
        },
      },
    });

    if (!inbox) {
      throw new NotFoundException(`NFeInbox ${inboxId} não encontrada para a empresa ${companyId}`);
    }

    const periodoReferencia = this.toPeriodo(inbox.dataEmissao);
    const itemsResult: EntradaCst60ItemResult[] = [];
    const alertas: string[] = [];
    let totalCreditoGerado = 0;
    let itensComCredito = 0;

    // Filtra apenas items com CST 60
    const itensCst60 = inbox.items.filter(it => it.cstIcms === '60');

    if (itensCst60.length === 0) {
      alertas.push('Nenhum item com CST 60 encontrado nesta NF-e de entrada.');
    }

    // ── Avisos gerais ──────────────────────────────────────────────────────────
    if (finalidade !== 'INDUSTRIALIZACAO') {
      alertas.push(
        `Finalidade informada (${finalidade}) NÃO gera crédito Art. 272. ` +
        `O crédito do ICMS da operação própria do substituto é exclusivo para ` +
        `mercadorias destinadas à INDUSTRIALIZAÇÃO (Art. 272 RICMS-SP).`,
      );
    } else {
      alertas.push(
        'Art. 272 RICMS-SP: crédito permitido. ' +
        'Exige escrituração na SPED EFD como ajuste C197 (SP20020100) + E111. ' +
        'Confirmar que os campos bcIcmsOp e valorIcmsOp foram preenchidos na ' +
        'escrituração da NF-e de entrada (dados da op. própria do substituto).',
      );
    }

    for (const item of itensCst60) {
      const bcIcmsOp    = Number(item.bcIcmsOp    ?? 0);
      const aliqIcmsOp  = Number(item.aliqIcmsOp  ?? 0);
      const valorIcmsOp = Number(item.valorIcmsOp ?? 0);
      const valorTotal  = Number(item.valorTotal);

      // ── Validação dos dados da op. própria ──────────────────────────────────
      if (valorIcmsOp <= 0) {
        itemsResult.push({
          inboxItemId:        item.id,
          numeroItem:         item.numeroItem,
          descricao:          item.descricaoProduto,
          ncm:                item.ncm,
          valorTotal,
          cstIcms:            item.cstIcms ?? '60',
          bcIcmsOp,
          aliqIcmsOp,
          valorIcmsOp,
          valorCreditoGerado: 0,
          fiscalEntryId:      null,
          mensagem:           'Item sem valorIcmsOp preenchido — preencher o ICMS da operação própria do substituto para habilitar o crédito Art. 272.',
        });
        continue;
      }

      // ── Sem credito se finalidade não for industrialização ─────────────────
      if (finalidade !== 'INDUSTRIALIZACAO') {
        itemsResult.push({
          inboxItemId:        item.id,
          numeroItem:         item.numeroItem,
          descricao:          item.descricaoProduto,
          ncm:                item.ncm,
          valorTotal,
          cstIcms:            item.cstIcms ?? '60',
          bcIcmsOp,
          aliqIcmsOp,
          valorIcmsOp,
          valorCreditoGerado: 0,
          fiscalEntryId:      null,
          mensagem:           `Sem crédito: finalidade ${finalidade} (Art. 272 RICMS-SP só se aplica à industrialização).`,
        });
        continue;
      }

      // ── Idempotência: verifica se crédito já foi lançado ────────────────────
      const existente = await this.prisma.fiscalEntry.findFirst({
        where: {
          companyId,
          nfeInboxId:      inboxId,
          codigoAjusteSped: StEntradaCst60Service.CODIGO_AJUSTE_ART272,
          observations:    { contains: item.id },
        },
      });

      if (existente) {
        itemsResult.push({
          inboxItemId:        item.id,
          numeroItem:         item.numeroItem,
          descricao:          item.descricaoProduto,
          ncm:                item.ncm,
          valorTotal,
          cstIcms:            item.cstIcms ?? '60',
          bcIcmsOp,
          aliqIcmsOp,
          valorIcmsOp,
          valorCreditoGerado: Number(existente.valorImposto),
          fiscalEntryId:      existente.id,
          mensagem:           `[JÁ LANÇADO] FiscalEntry ${existente.id} criado em ${existente.createdAt.toLocaleDateString('pt-BR')}.`,
        });
        totalCreditoGerado += Number(existente.valorImposto);
        itensComCredito++;
        continue;
      }

      // ── Criar FiscalEntry CREDITO Art. 272 ─────────────────────────────────
      const entry = await this.prisma.fiscalEntry.create({
        data: {
          companyId,
          nfeInboxId:       inboxId,
          type:             'CREDITO',
          bookType:         'ENTRADA',
          dataLancamento:   inbox.dataEmissao,
          periodoReferencia,
          cfopCode:         item.cfop,
          naturezaOperacao: `Crédito Art. 272 RICMS-SP — CST 60 — ${item.descricaoProduto}`,
          valorContabil:    valorTotal,
          baseCalculo:      bcIcmsOp,
          aliquota:         aliqIcmsOp,
          valorImposto:     this.round(valorIcmsOp),
          taxType:          'ICMS',
          codigoAjusteSped: StEntradaCst60Service.CODIGO_AJUSTE_ART272,
          fundamentoLegal:  StEntradaCst60Service.FUNDAMENTO_ART272,
          observations:
            `Art. 272 RICMS-SP | NFeInbox: ${inboxId} | Item: ${item.id} | ` +
            `NCM: ${item.ncm} | CST: 60 | BC-op: R$${bcIcmsOp.toFixed(2)} | ` +
            `Alíq: ${aliqIcmsOp}% | Emitente: ${inbox.emitenteNome} (${inbox.emitenteCnpj})`,
        },
      });

      this.logger.log(
        `[StEntradaCst60] Crédito Art. 272 criado | NFeInbox ${inboxId} | ` +
        `Item ${item.numeroItem} "${item.descricaoProduto}" NCM ${item.ncm} | ` +
        `R$ ${valorIcmsOp.toFixed(2)} | FiscalEntry ${entry.id}`,
      );

      itemsResult.push({
        inboxItemId:        item.id,
        numeroItem:         item.numeroItem,
        descricao:          item.descricaoProduto,
        ncm:                item.ncm,
        valorTotal,
        cstIcms:            item.cstIcms ?? '60',
        bcIcmsOp,
        aliqIcmsOp,
        valorIcmsOp,
        valorCreditoGerado: this.round(valorIcmsOp),
        fiscalEntryId:      entry.id,
        mensagem:           `Crédito Art. 272 lançado com sucesso (FiscalEntry ${entry.id}).`,
      });

      totalCreditoGerado += this.round(valorIcmsOp);
      itensComCredito++;
    }

    return {
      inboxId,
      emitenteNome:       inbox.emitenteNome,
      dataEmissao:        inbox.dataEmissao,
      finalidade,
      periodoReferencia,
      itensCst60:         itensCst60.length,
      itensComCredito,
      totalCreditoGerado: this.round(totalCreditoGerado),
      items:              itemsResult,
      alertas,
    };
  }

  /**
   * Retorna todos os créditos Art. 272 de uma empresa em um período.
   * Usado para visualização no painel fiscal e no SPED E111.
   */
  async listarCreditosArt272(
    companyId: string,
    periodoReferencia: string,
  ): Promise<{
    periodoReferencia: string;
    totalCreditos:     number;
    quantidadeEntradas: number;
    entries: Array<{
      id:               string;
      dataLancamento:   Date;
      cfopCode:         string;
      naturezaOperacao: string | null;
      baseCalculo:      number;
      aliquota:         number;
      valorImposto:     number;
      observations:     string | null;
      nfeInboxId:       string | null;
    }>;
  }> {
    const entries = await this.prisma.fiscalEntry.findMany({
      where: {
        companyId,
        periodoReferencia,
        taxType:          'ICMS',
        type:             'CREDITO',
        codigoAjusteSped: StEntradaCst60Service.CODIGO_AJUSTE_ART272,
      },
      orderBy: { dataLancamento: 'asc' },
    });

    const totalCreditos = entries.reduce(
      (s, e) => s + Number(e.valorImposto),
      0,
    );

    return {
      periodoReferencia,
      totalCreditos:     this.round(totalCreditos),
      quantidadeEntradas: entries.length,
      entries: entries.map(e => ({
        id:               e.id,
        dataLancamento:   e.dataLancamento,
        cfopCode:         e.cfopCode,
        naturezaOperacao: e.naturezaOperacao,
        baseCalculo:      Number(e.baseCalculo),
        aliquota:         Number(e.aliquota),
        valorImposto:     Number(e.valorImposto),
        observations:     e.observations,
        nfeInboxId:       e.nfeInboxId,
      })),
    };
  }

  /**
   * Atualiza os campos de operação própria (cstIcms, bcIcmsOp, aliqIcmsOp, valorIcmsOp)
   * em um NFeInboxItem — necessário antes de processar o crédito Art. 272.
   * Normalmente populados durante o import do XML ou na tela de escrituração.
   */
  async atualizarDadosOpPropriaItem(
    itemId: string,
    companyId: string,
    dados: {
      cstIcms:    string;
      bcIcmsOp:   number;
      aliqIcmsOp: number;
      valorIcmsOp: number;
      cest?:       string;
    },
  ) {
    // Verifica que o item pertence à empresa
    const item = await this.prisma.nFeInboxItem.findFirst({
      where: { id: itemId, inbox: { companyId } },
    });
    if (!item) {
      throw new NotFoundException(`NFeInboxItem ${itemId} não encontrado`);
    }

    return this.prisma.nFeInboxItem.update({
      where: { id: itemId },
      data: {
        cstIcms:     dados.cstIcms,
        bcIcmsOp:    dados.bcIcmsOp,
        aliqIcmsOp:  dados.aliqIcmsOp,
        valorIcmsOp: dados.valorIcmsOp,
        cest:        dados.cest ?? undefined,
      },
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private toPeriodo(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
