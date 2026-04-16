import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';
import { FiscalBrainService } from '@/modules/corporate/fiscal/fiscal-brain/fiscal-brain.service';
import { ContextoOperacao } from '@/modules/corporate/fiscal/fiscal-brain/classificador.service';

function mapTaxRegime(regime: string | null | undefined): 'SN' | 'LP' | 'LR' {
  if (regime === 'SIMPLES_NACIONAL') return 'SN';
  if (regime === 'LUCRO_PRESUMIDO')  return 'LP';
  return 'LR';
}

function mapNatureza(operation: string | null | undefined): string {
  const ops: Record<string, string> = {
    VENDA:            'Venda de mercadoria',
    VENDA_SERVICO:    'Venda de serviço',
    REMESSA:          'Remessa de mercadoria',
    TRANSFERENCIA:    'Transferência entre estabelecimentos',
    DEVOLUCAO:        'Devolução de compra',
    COMPLEMENTAR:     'NF-e complementar',
    AJUSTE:           'NF-e de ajuste',
    CONSUMO:          'Saída para uso e consumo',
    ATIVO:            'Saída de ativo imobilizado',
    INDUSTRIALIZACAO: 'Remessa para industrialização',
    RETORNO:          'Retorno de mercadoria',
  };
  return ops[operation ?? ''] || (operation ?? 'Venda de mercadoria');
}

export interface PipelineSaidaItemResult {
  itemId:          string;
  ncm:             string;
  descricao:       string;
  cfopAtual:       string;
  cfopSugerido:    string | null;
  cstIcms:         string | null;
  cstPis:          string | null;
  cstCofins:       string | null;
  aliquotaIcms:    number | null;
  aliquotaPis:     number | null;
  aliquotaCofins:  number | null;
  bcIcmsPct:       number | null;
  temSt:           boolean;
  temIpi:          boolean;
  aliquotaIpi:     number | null;
  beneficioFiscal: string | null;
  fundamentoLegal: string[];
  alertas:         string[];
  raciocinio:      string | null;
  confianca:       number | null;
  autoAplicado:    boolean;
  excecaoId:       string | null;
  decisionId:      string | null;
  erro?:           string;
}

export interface PipelineSaidaResult {
  nfeId:            string;
  numero:           string | null;
  totalItems:       number;
  autoClassificados: number;
  excecoes:         number;
  erros:            number;
  prontoParaEmitir: boolean;
  items:            PipelineSaidaItemResult[];
}

@Injectable()
export class NfeIaPipelineSaidaService {
  private readonly logger = new Logger(NfeIaPipelineSaidaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly brain: FiscalBrainService,
  ) {}

  /**
   * Classifica fiscalmente todos os itens de uma NF-e de SAÍDA com FiscalBrain.
   * Retorna sugestões de CFOP/CST/alíquotas por item com score de confiança.
   * Itens ≥ 92% → autoAplicado=true (campos preenchidos automaticamente).
   * Itens < 92% → excecaoId set (requer revisão manual antes da emissão).
   */
  async classificarNfe(nfeId: string, companyId: string): Promise<PipelineSaidaResult | null> {
    // Busca NF-e base
    const nfe = await this.prisma.nFeDocument.findFirst({
      where: { id: nfeId, companyId },
    });
    if (!nfe) {
      this.logger.warn(`[Pipeline Saída] NFeDocument ${nfeId} não encontrada`);
      return null;
    }

    // Busca itens, empresa e pessoa separadamente para evitar conflito de tipos Prisma
    const [items, company, person] = await Promise.all([
      this.prisma.nFeItem.findMany({
        where: { nfeId },
        orderBy: { itemNumber: 'asc' },
      }),
      this.prisma.company.findUnique({
        where: { id: companyId },
        select: { uf: true, taxRegime: true, cnaePrincipal: true },
      }),
      nfe.personId ? this.prisma.person.findUnique({
        where: { id: nfe.personId },
        select: { rgIe: true, type: true, optanteSimples: true },
      }) : Promise.resolve(null),
    ]);

    if (items.length === 0) {
      this.logger.warn(`[Pipeline Saída] NF-e ${nfeId} sem itens`);
      return {
        nfeId, numero: String(nfe.numero ?? ''),
        totalItems: 0, autoClassificados: 0,
        excecoes: 0, erros: 0, prontoParaEmitir: true, items: [],
      };
    }

    // Busca endereço do destinatário
    const destAddr = person ? await this.prisma.personAddress.findFirst({
      where: { personId: nfe.personId! },
      orderBy: { principal: 'desc' },
    }) : null;

    const regimeTributario = mapTaxRegime(company?.taxRegime as string);
    const ufEmitente       = company?.uf || 'SP';
    const cnaeEmitente     = company?.cnaePrincipal || '2830001';

    const ufDestinatario  = destAddr?.uf || ufEmitente;
    const ieDestinatario  = person?.rgIe || '';
    const isContribuinte  = !!(ieDestinatario && ieDestinatario.replace(/\D/g, '').length > 0 && ieDestinatario !== 'ISENTO');
    const isConsumidorFinal = !isContribuinte || person?.type === 'PF';
    const cnaeDestinatario  = isContribuinte ? '4669999' : '0000000';

    const natureza = mapNatureza(nfe.operation);
    const results: PipelineSaidaItemResult[] = [];

    for (const item of items) {
      try {
        const valorItem = Number(item.unitPrice) * Number(item.quantity);

        const contexto: ContextoOperacao = {
          tipoOperacao:      'SAIDA',
          naturezaOperacao:  natureza,
          cnaeEmitente,
          regimeTributario,
          ufEmitente,
          ufDestinatario,
          isIndustrial:      true,
          isContribuinte,
          isConsumidorFinal,
          cnaeDestinatario,
          produtos: [{
            ncm:        item.ncmCode   || '',
            descricao:  item.description,
            valor:      valorItem,
            quantidade: Number(item.quantity),
            unit:       item.unit || 'UN',
          }],
        };

        const resultado = await this.brain.classificarDocumento({
          companyId,
          documentType: 'NFeItem',
          documentId:   item.id,
          contexto,
        });

        const cls = resultado.classificacao;

        // Aplica automaticamente se autoAplicado
        if (resultado.autoAplicado) {
          const bcIcms = cls.baseCalculoIcmsPct < 100
            ? valorItem * cls.baseCalculoIcmsPct / 100
            : valorItem;

          await this.prisma.nFeItem.update({
            where: { id: item.id },
            data: {
              cfopCode:    cls.cfop || item.cfopCode,
              cstIcms:     cls.cstIcms,
              aliqIcms:    cls.aliquotaIcms,
              bcIcms,
              valorIcms:   bcIcms * cls.aliquotaIcms / 100,
              cstPis:      cls.cstPis,
              aliqPis:     cls.aliquotaPis,
              bcPis:       valorItem,
              valorPis:    valorItem * cls.aliquotaPis / 100,
              cstCofins:   cls.cstCofins,
              aliqCofins:  cls.aliquotaCofins,
              bcCofins:    valorItem,
              valorCofins: valorItem * cls.aliquotaCofins / 100,
              ...(cls.temIpi && {
                cstIpi:   '50',
                aliqIpi:  cls.aliquotaIpi,
                bcIpi:    valorItem,
                valorIpi: valorItem * cls.aliquotaIpi / 100,
              }),
            },
          });
        }

        results.push({
          itemId:          item.id,
          ncm:             item.ncmCode || '',
          descricao:       item.description,
          cfopAtual:       item.cfopCode || '',
          cfopSugerido:    cls.cfop,
          cstIcms:         cls.cstIcms,
          cstPis:          cls.cstPis,
          cstCofins:       cls.cstCofins,
          aliquotaIcms:    cls.aliquotaIcms,
          aliquotaPis:     cls.aliquotaPis,
          aliquotaCofins:  cls.aliquotaCofins,
          bcIcmsPct:       cls.baseCalculoIcmsPct,
          temSt:           cls.temIcmsSt,
          temIpi:          cls.temIpi,
          aliquotaIpi:     cls.aliquotaIpi,
          beneficioFiscal: cls.beneficioFiscal,
          fundamentoLegal: cls.fundamentoLegal,
          alertas:         cls.alertas,
          raciocinio:      cls.raciocinio,
          confianca:       cls.confianca,
          autoAplicado:    resultado.autoAplicado,
          excecaoId:       resultado.excecaoId,
          decisionId:      resultado.decisionId,
        });

        this.logger.log(
          `[Pipeline Saída] "${item.description}" NCM ${item.ncmCode} | ` +
          `CFOP: ${item.cfopCode}→${cls.cfop} | conf.${cls.confianca}% | ` +
          (resultado.autoAplicado ? '✓ auto' : `⚠ exceção ${resultado.excecaoId}`),
        );
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`[Pipeline Saída] Erro no item ${item.id} (${item.description}): ${msg}`);
        results.push({
          itemId: item.id, ncm: item.ncmCode || '', descricao: item.description,
          cfopAtual: item.cfopCode || '', cfopSugerido: null,
          cstIcms: null, cstPis: null, cstCofins: null,
          aliquotaIcms: null, aliquotaPis: null, aliquotaCofins: null,
          bcIcmsPct: null, temSt: false, temIpi: false, aliquotaIpi: null,
          beneficioFiscal: null, fundamentoLegal: [], alertas: [],
          raciocinio: null, confianca: null, autoAplicado: false,
          excecaoId: null, decisionId: null, erro: msg,
        });
      }
    }

    const totalItems        = items.length;
    const autoClassificados = results.filter(r => r.autoAplicado).length;
    const excecoes          = results.filter(r => !r.autoAplicado && !r.erro).length;
    const erros             = results.filter(r => !!r.erro).length;
    const prontoParaEmitir  = results.every(r => r.autoAplicado);

    this.logger.log(
      `[Pipeline Saída] NF-e ${nfeId} — ${autoClassificados}/${totalItems} auto | ` +
      `${excecoes} exceções | ${erros} erros`,
    );

    return {
      nfeId, numero: String(nfe.numero ?? ''),
      totalItems, autoClassificados, excecoes, erros, prontoParaEmitir, items: results,
    };
  }

  /**
   * Retorna o status da classificação IA para todos os itens de uma NF-e de saída.
   */
  async statusClassificacao(nfeId: string, companyId: string) {
    const nfe = await this.prisma.nFeDocument.findFirst({
      where: { id: nfeId, companyId },
      select: { id: true, numero: true, status: true, operation: true },
    });
    if (!nfe) return null;

    const items = await this.prisma.nFeItem.findMany({
      where: { nfeId },
      orderBy: { itemNumber: 'asc' },
      select: {
        id: true, itemNumber: true, description: true,
        ncmCode: true, cfopCode: true, unit: true,
        quantity: true, unitPrice: true,
        cstIcms: true, aliqIcms: true, valorIcms: true,
        cstPis: true, aliqPis: true,
        cstCofins: true, aliqCofins: true,
      },
    });

    const itemIds = items.map(i => i.id);
    const decisions = await this.prisma.fiscalBrainDecision.findMany({
      where: { companyId, documentType: 'NFeItem', documentId: { in: itemIds } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, documentId: true,
        cfop: true, cstIcms: true, cstPis: true, cstCofins: true,
        aliquotaIcms: true, aliquotaPis: true, aliquotaCofins: true, aliquotaIpi: true,
        confianca: true, autoAplicado: true,
        raciocinio: true, fundamentoLegal: true, alertas: true,
        beneficioFiscal: true, createdAt: true,
      },
    });

    const latestByItem = new Map<string, typeof decisions[0]>();
    for (const d of decisions) {
      if (!latestByItem.has(d.documentId)) latestByItem.set(d.documentId, d);
    }

    const itemsResult = items.map(item => {
      const d = latestByItem.get(item.id);
      return {
        itemId:          item.id,
        itemNumber:      item.itemNumber,
        descricao:       item.description,
        ncm:             item.ncmCode,
        cfopAtual:       item.cfopCode,
        classificado:    !!d,
        autoAplicado:    d?.autoAplicado    ?? false,
        confianca:       d?.confianca       ?? null,
        cfopSugerido:    d?.cfop            ?? null,
        cstIcms:         d?.cstIcms         ?? item.cstIcms ?? null,
        cstPis:          d?.cstPis          ?? item.cstPis  ?? null,
        cstCofins:       d?.cstCofins       ?? item.cstCofins ?? null,
        aliquotaIcms:    d?.aliquotaIcms    ?? item.aliqIcms ?? null,
        aliquotaPis:     d?.aliquotaPis     ?? item.aliqPis  ?? null,
        aliquotaCofins:  d?.aliquotaCofins  ?? item.aliqCofins ?? null,
        beneficioFiscal: d?.beneficioFiscal ?? null,
        fundamentoLegal: (d?.fundamentoLegal as string[]) ?? [],
        alertas:         (d?.alertas        as string[])  ?? [],
        raciocinio:      d?.raciocinio      ?? null,
        decisionId:      d?.id              ?? null,
        decisionEm:      d?.createdAt       ?? null,
      };
    });

    return {
      nfeId,
      numero:           nfe.numero,
      statusNfe:        nfe.status,
      totalItems:       items.length,
      classificados:    itemsResult.filter(i => i.classificado).length,
      autoAplicados:    itemsResult.filter(i => i.autoAplicado).length,
      pendentesExcecao: itemsResult.filter(i => i.classificado && !i.autoAplicado).length,
      naoClassificados: itemsResult.filter(i => !i.classificado).length,
      prontoParaEmitir: itemsResult.length > 0 && itemsResult.every(i => i.autoAplicado),
      items: itemsResult,
    };
  }

  /**
   * Aplica manualmente uma decisão FiscalBrain a um item específico.
   * Usado quando o usuário confirma uma sugestão com confiança < 92%.
   */
  async aplicarDecisao(nfeId: string, itemId: string, decisionId: string, companyId: string) {
    const decision = await this.prisma.fiscalBrainDecision.findFirst({
      where: { id: decisionId, companyId, documentType: 'NFeItem', documentId: itemId },
    });
    if (!decision) throw new Error('Decisão não encontrada');

    const item = await this.prisma.nFeItem.findFirst({ where: { id: itemId } });
    if (!item) throw new Error('Item não encontrado');

    const valorBase = Number(item.unitPrice) * Number(item.quantity);

    await this.prisma.nFeItem.update({
      where: { id: itemId },
      data: {
        cfopCode:    decision.cfop     || item.cfopCode,
        cstIcms:     decision.cstIcms,
        aliqIcms:    decision.aliquotaIcms    as any,
        bcIcms:      valorBase,
        valorIcms:   valorBase * (Number(decision.aliquotaIcms)    / 100),
        cstPis:      decision.cstPis,
        aliqPis:     decision.aliquotaPis     as any,
        bcPis:       valorBase,
        valorPis:    valorBase * (Number(decision.aliquotaPis)     / 100),
        cstCofins:   decision.cstCofins,
        aliqCofins:  decision.aliquotaCofins  as any,
        bcCofins:    valorBase,
        valorCofins: valorBase * (Number(decision.aliquotaCofins)  / 100),
      },
    });

    await this.prisma.fiscalBrainDecision.update({
      where: { id: decisionId },
      data: { autoAplicado: true },
    });

    return { aplicado: true, itemId, decisionId };
  }
}
