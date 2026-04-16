import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';
import { FiscalBrainService } from '@/modules/corporate/fiscal/fiscal-brain/fiscal-brain.service';
import { ContextoOperacao } from '@/modules/corporate/fiscal/fiscal-brain/classificador.service';

// Código cUF (IBGE) → sigla UF
const CUF_TO_UF: Record<string, string> = {
  '12': 'AC', '27': 'AL', '13': 'AM', '16': 'AP', '29': 'BA',
  '23': 'CE', '53': 'DF', '32': 'ES', '52': 'GO', '21': 'MA',
  '51': 'MT', '50': 'MS', '31': 'MG', '15': 'PA', '25': 'PB',
  '41': 'PR', '26': 'PE', '22': 'PI', '33': 'RJ', '24': 'RN',
  '43': 'RS', '11': 'RO', '14': 'RR', '42': 'SC', '35': 'SP',
  '28': 'SE', '17': 'TO',
};

function mapTaxRegime(regime: string): 'SN' | 'LP' | 'LR' {
  if (regime === 'SIMPLES_NACIONAL') return 'SN';
  if (regime === 'LUCRO_PRESUMIDO')  return 'LP';
  return 'LR';
}

export interface PipelineItemResult {
  itemId: string;
  ncm: string;
  descricao: string;
  cfopNfe: string;
  cfopSugerido: string | null;
  cstIcms: string | null;
  cstPis: string | null;
  cstCofins: string | null;
  aliquotaIcms: any;
  confianca: number | null;
  autoAplicado: boolean;
  excecaoId: string | null;
  decisionId: string | null;
  erro?: string;
}

export interface PipelineResult {
  inboxId: string;
  numero: string;
  totalItems: number;
  autoClassificados: number;
  excecoes: number;
  erros: number;
  prontoParaLancar: boolean;
  items: PipelineItemResult[];
}

@Injectable()
export class NfeIaPipelineService {
  private readonly logger = new Logger(NfeIaPipelineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly brain: FiscalBrainService,
  ) {}

  /**
   * Classifica fiscalmente todos os itens de uma NF-e com a IA.
   * Deve ser disparado após manifestação CONFIRMACAO_OPERACAO (fire-and-forget).
   * Cada item gera um FiscalBrainDecision com documentType='NFeInboxItem'.
   */
  async processarNfe(inboxId: string, companyId: string): Promise<PipelineResult | null> {
    const inbox = await this.prisma.nFeInbox.findFirst({
      where: { id: inboxId, companyId },
      include: {
        items: true,
        emitentePessoa: { select: { id: true } },
        company: {
          select: {
            uf: true,
            taxRegime: true,
            cnaePrincipal: true,
          },
        },
      },
    });

    if (!inbox) {
      this.logger.warn(`[Pipeline IA] NFeInbox ${inboxId} não encontrada`);
      return null;
    }

    if (inbox.items.length === 0) {
      this.logger.warn(`[Pipeline IA] NF-e ${inbox.numero} não possui itens para classificar`);
      return {
        inboxId, numero: inbox.numero,
        totalItems: 0, autoClassificados: 0,
        excecoes: 0, erros: 0, prontoParaLancar: true, items: [],
      };
    }

    // UF do emitente: parse dos 2 primeiros dígitos da chave de acesso (cUF)
    const ufEmitente =
      CUF_TO_UF[inbox.chaveAcesso.substring(0, 2)] ||
      inbox.company.uf ||
      'SP';

    const ufDestinatario  = inbox.company.uf || 'SP';
    const regimeTributario = mapTaxRegime(inbox.company.taxRegime as string);
    const cnaeDestinatario = inbox.company.cnaePrincipal || '4669999';
    // CNAE do emitente — sem informação direta no inbox; usa genérico
    const cnaeEmitente = '4669999';

    const results: PipelineItemResult[] = [];

    for (const item of inbox.items) {
      try {
        const contexto: ContextoOperacao = {
          tipoOperacao:   'ENTRADA',
          naturezaOperacao: `Compra de ${item.descricaoProduto}`,
          cnaeEmitente,
          regimeTributario,
          ufEmitente,
          ufDestinatario,
          isIndustrial:      false,
          isContribuinte:    true,
          isConsumidorFinal: false,
          cnaeDestinatario,
          produtos: [{
            ncm:        item.ncm,
            descricao:  item.descricaoProduto,
            valor:      Number(item.valorTotal),
            quantidade: Number(item.quantidade),
            unit:       item.unidade,
          }],
        };

        const resultado = await this.brain.classificarDocumento({
          companyId,
          documentType: 'NFeInboxItem',
          documentId:   item.id,
          contexto,
        });

        results.push({
          itemId:       item.id,
          ncm:          item.ncm,
          descricao:    item.descricaoProduto,
          cfopNfe:      item.cfop,
          cfopSugerido: resultado.classificacao.cfop,
          cstIcms:      resultado.classificacao.cstIcms,
          cstPis:       resultado.classificacao.cstPis,
          cstCofins:    resultado.classificacao.cstCofins,
          aliquotaIcms: resultado.classificacao.aliquotaIcms,
          confianca:    resultado.classificacao.confianca,
          autoAplicado: resultado.autoAplicado,
          excecaoId:    resultado.excecaoId,
          decisionId:   resultado.decisionId,
        });

        this.logger.log(
          `[Pipeline IA] Item "${item.descricaoProduto}" NCM ${item.ncm} | ` +
          `CFOP NF-e: ${item.cfop} → IA: ${resultado.classificacao.cfop} | ` +
          `conf.${resultado.classificacao.confianca}% | ` +
          (resultado.autoAplicado ? '✓ auto' : `⚠ exceção ${resultado.excecaoId}`),
        );
      } catch (err: any) {
        this.logger.error(
          `[Pipeline IA] Erro ao classificar item ${item.id} (${item.descricaoProduto}): ${err.message}`,
        );
        results.push({
          itemId:       item.id,
          ncm:          item.ncm,
          descricao:    item.descricaoProduto,
          cfopNfe:      item.cfop,
          cfopSugerido: null,
          cstIcms:      null,
          cstPis:       null,
          cstCofins:    null,
          aliquotaIcms: null,
          confianca:    null,
          autoAplicado: false,
          excecaoId:    null,
          decisionId:   null,
          erro:         err.message,
        });
      }
    }

    const totalItems      = inbox.items.length;
    const autoClassificados = results.filter(r => r.autoAplicado).length;
    const excecoes        = results.filter(r => !r.autoAplicado && !r.erro).length;
    const erros           = results.filter(r => !!r.erro).length;
    const prontoParaLancar = results.every(r => r.autoAplicado);

    this.logger.log(
      `[Pipeline IA] NF-e ${inbox.numero} concluída: ` +
      `${autoClassificados}/${totalItems} auto | ${excecoes} exceções | ${erros} erros`,
    );

    return { inboxId, numero: inbox.numero, totalItems, autoClassificados, excecoes, erros, prontoParaLancar, items: results };
  }

  /**
   * Retorna o status da classificação IA para todos os itens de uma NF-e.
   * Inclui CFOP/CST sugeridos, confiança e alertas por item.
   */
  async statusPipeline(inboxId: string, companyId: string) {
    const inbox = await this.prisma.nFeInbox.findFirst({
      where: { id: inboxId, companyId },
      select: {
        id: true,
        numero: true,
        status: true,
        items: {
          select: {
            id: true,
            descricaoProduto: true,
            ncm: true,
            cfop: true,
            unidade: true,
            quantidade: true,
            valorTotal: true,
            mapeado: true,
          },
        },
      },
    });

    if (!inbox) return null;

    const itemIds = inbox.items.map(i => i.id);

    const decisions = await this.prisma.fiscalBrainDecision.findMany({
      where: { companyId, documentType: 'NFeInboxItem', documentId: { in: itemIds } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        documentId: true,
        cfop: true,
        cstIcms: true,
        cstPis: true,
        cstCofins: true,
        aliquotaIcms: true,
        aliquotaPis: true,
        aliquotaCofins: true,
        confianca: true,
        autoAplicado: true,
        raciocinio: true,
        fundamentoLegal: true,
        alertas: true,
        createdAt: true,
      },
    });

    // Mantém apenas a decisão mais recente por item
    const latestByItem = new Map<string, typeof decisions[0]>();
    for (const d of decisions) {
      if (!latestByItem.has(d.documentId)) latestByItem.set(d.documentId, d);
    }

    const items = inbox.items.map(item => {
      const d = latestByItem.get(item.id);
      return {
        itemId:          item.id,
        descricao:       item.descricaoProduto,
        ncm:             item.ncm,
        cfopNfe:         item.cfop,
        mapeado:         item.mapeado,
        classificado:    !!d,
        autoAplicado:    d?.autoAplicado ?? false,
        confianca:       d?.confianca ?? null,
        cfopSugerido:    d?.cfop ?? null,
        cstIcms:         d?.cstIcms ?? null,
        cstPis:          d?.cstPis ?? null,
        cstCofins:       d?.cstCofins ?? null,
        aliquotaIcms:    d?.aliquotaIcms ?? null,
        aliquotaPis:     d?.aliquotaPis ?? null,
        aliquotaCofins:  d?.aliquotaCofins ?? null,
        fundamentoLegal: d?.fundamentoLegal ?? [],
        alertas:         d?.alertas ?? [],
        raciocinio:      d?.raciocinio ?? null,
        decisionId:      d?.id ?? null,
        decisionEm:      d?.createdAt ?? null,
      };
    });

    return {
      inboxId,
      numero:            inbox.numero,
      statusNfe:         inbox.status,
      totalItems:        inbox.items.length,
      classificados:     items.filter(i => i.classificado).length,
      autoAplicados:     items.filter(i => i.autoAplicado).length,
      pendentesExcecao:  items.filter(i => i.classificado && !i.autoAplicado).length,
      naoClassificados:  items.filter(i => !i.classificado).length,
      prontoParaLancar:  items.every(i => i.autoAplicado),
      items,
    };
  }

  /**
   * Retorna a decisão IA mais recente para um item específico.
   * Usado internamente por postEntry() para obter CFOP/CST classificados.
   */
  async getDecisaoItem(itemId: string, companyId: string) {
    return this.prisma.fiscalBrainDecision.findFirst({
      where: { companyId, documentType: 'NFeInboxItem', documentId: itemId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        cfop: true,
        cstIcms: true,
        cstPis: true,
        cstCofins: true,
        aliquotaIcms: true,
        aliquotaPis: true,
        aliquotaCofins: true,
        aliquotaIpi: true,
        beneficioFiscal: true,
        fundamentoLegal: true,
        confianca: true,
        autoAplicado: true,
      },
    });
  }
}
