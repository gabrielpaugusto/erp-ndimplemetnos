/**
 * FiscalEngineAutomationService
 *
 * Resolve CFOP, CST/CSOSN e alíquotas automaticamente com base em:
 *  - Tipo de operação (venda, compra, devolução, remessa, etc.)
 *  - UF da empresa x UF do destinatário (intraestadual / interestadual / exterior)
 *  - Regime tributário da empresa (Simples Nacional, Lucro Real, Lucro Presumido)
 *  - NCM do produto (campos de CST, alíquotas e flags)
 *  - Regras tributárias cadastradas (TaxRule — override de maior prioridade)
 *  - Matriz ICMS Interestadual (7 / 12 / 4 %)
 *
 * NÃO requer nenhuma decisão manual do operador.
 */
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';

// ─── Tipos de operação suportados ────────────────────────────────────────────
export type OperationType =
  | 'SAIDA_VENDA_PRODUCAO'        // 5101/6101 – venda de produção própria
  | 'SAIDA_VENDA_MERCADORIA'      // 5102/6102 – venda de mercadoria adquirida
  | 'SAIDA_VENDA_PECA'           // 5102/6102 – peça de reposição
  | 'SAIDA_SERVICO'              // 5933 – serviço prestado
  | 'SAIDA_DEVOLUCAO_COMPRA'     // 5201/6201 – devolução a fornecedor
  | 'SAIDA_REMESSA_INDUSTRIA'    // 5901/6901 – remessa para industrialização
  | 'SAIDA_REMESSA_CONSERTO'     // 5915/6915 – remessa para conserto
  | 'SAIDA_TRANSFERENCIA'        // 5151/6151 – transferência entre filiais
  | 'ENTRADA_COMPRA_INDUSTRIA'   // 1101/2101 – compra para industrialização
  | 'ENTRADA_COMPRA_COMERCIO'    // 1102/2102 – compra para comercialização
  | 'ENTRADA_DEVOLUCAO_VENDA'    // 1201/2201 – devolução de venda
  | 'ENTRADA_RETORNO_INDUSTRIA'  // 1901/2901 – retorno de industrialização
  | 'ENTRADA_RETORNO_CONSERTO'   // 1915/2915 – retorno de conserto
  | 'ENTRADA_TRANSFERENCIA';     // 1151/2151 – transferência recebida

// ─── Contexto da operação ─────────────────────────────────────────────────────
export interface FiscalContext {
  companyId: string;
  /** UF da empresa emitente */
  ufEmitente: string;
  /** UF do destinatário/remetente */
  ufDestinatario: string;
  /** true = destinatário é pessoa jurídica contribuinte do ICMS */
  destinatarioContribuinte?: boolean;
  /** true = operação com exterior (exportação/importação) */
  exterior?: boolean;
  /** Tipo de operação */
  operationType: OperationType;
  /** Data da operação (para calcular ano/regime de transição) */
  date?: Date;
}

// ─── Item a ser resolvido ─────────────────────────────────────────────────────
export interface FiscalItemInput {
  productId?: string;
  /** Código NCM do produto (8 dígitos) */
  ncmCode?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  /** Indicador de origem (0=nacional, 1-8=importado) */
  origem?: string;
  /** Tipo do produto (para saber se aplica IPI) */
  productType?: string;
}

// ─── Resultado resolvido ──────────────────────────────────────────────────────
export interface FiscalItemResolved {
  // Identificação
  ncmCode: string;
  cfopCode: string;
  naturezaOperacao: string;
  origem: string;

  // ICMS (regime normal)
  cstIcms?: string;   // null se Simples Nacional
  csosn?: string;     // null se não-SN
  aliqIcms: number;
  reducaoBcIcms: number;
  bcIcms: number;
  valorIcms: number;

  // ICMS-ST
  temSt: boolean;
  aliqIcmsSt: number;
  bcIcmsSt: number;
  valorIcmsSt: number;

  // IPI
  cstIpi: string;
  aliqIpi: number;
  bcIpi: number;
  valorIpi: number;

  // PIS
  cstPis: string;
  aliqPis: number;
  bcPis: number;
  valorPis: number;

  // COFINS
  cstCofins: string;
  aliqCofins: number;
  bcCofins: number;
  valorCofins: number;

  // Reforma Tributária (IBS/CBS/IS)
  aliqIbs: number;
  bcIbs: number;
  valorIbs: number;
  aliqCbs: number;
  bcCbs: number;
  valorCbs: number;
  temIs: boolean;
  aliqIs: number;
  valorIs: number;

  // Totais
  valorBruto: number;
  valorTotal: number;

  // Diagnóstico
  fonte: 'REGRA_TRIBUTARIA' | 'NCM_DEFAULTS' | 'ICMS_INTERESTADUAL' | 'SISTEMA_PADRAO';
  avisos: string[];
}

// ─── Mapa CFOP por operação e localização ─────────────────────────────────────
type CfopMap = Record<OperationType, { intra: string; inter: string; ext: string; natureza: string }>;

const CFOP_MAP: CfopMap = {
  SAIDA_VENDA_PRODUCAO:       { intra: '5101', inter: '6101', ext: '7101', natureza: 'Venda de produção do estabelecimento' },
  SAIDA_VENDA_MERCADORIA:     { intra: '5102', inter: '6102', ext: '7102', natureza: 'Venda de mercadoria adquirida ou recebida de terceiros' },
  SAIDA_VENDA_PECA:           { intra: '5102', inter: '6102', ext: '7102', natureza: 'Venda de peça de reposição' },
  SAIDA_SERVICO:              { intra: '5933', inter: '6933', ext: '7933', natureza: 'Prestação de serviço tributado pelo ISSQN' },
  SAIDA_DEVOLUCAO_COMPRA:     { intra: '5201', inter: '6201', ext: '7201', natureza: 'Devolução de compra para industrialização' },
  SAIDA_REMESSA_INDUSTRIA:    { intra: '5901', inter: '6901', ext: '7901', natureza: 'Remessa para industrialização por encomenda' },
  SAIDA_REMESSA_CONSERTO:     { intra: '5915', inter: '6915', ext: '7915', natureza: 'Remessa de mercadoria para conserto ou reparo' },
  SAIDA_TRANSFERENCIA:        { intra: '5151', inter: '6151', ext: '7151', natureza: 'Transferência de produção do estabelecimento' },
  ENTRADA_COMPRA_INDUSTRIA:   { intra: '1101', inter: '2101', ext: '3101', natureza: 'Compra para industrialização' },
  ENTRADA_COMPRA_COMERCIO:    { intra: '1102', inter: '2102', ext: '3102', natureza: 'Compra para comercialização' },
  ENTRADA_DEVOLUCAO_VENDA:    { intra: '1201', inter: '2201', ext: '3201', natureza: 'Devolução de venda de produção do estabelecimento' },
  ENTRADA_RETORNO_INDUSTRIA:  { intra: '1901', inter: '2901', ext: '3901', natureza: 'Retorno de industrialização por encomenda' },
  ENTRADA_RETORNO_CONSERTO:   { intra: '1915', inter: '2915', ext: '3915', natureza: 'Retorno de mercadoria enviada para conserto ou reparo' },
  ENTRADA_TRANSFERENCIA:      { intra: '1151', inter: '2151', ext: '3151', natureza: 'Transferência para industrialização' },
};

// ─── CST ICMS padrão por operação (regime normal) ─────────────────────────────
const CST_ICMS_SAIDA_PADRAO = '00'; // Tributada integralmente
const CST_ICMS_ENTRADA_PADRAO = '90'; // Outras

// ─── CSOSN padrão por operação (Simples Nacional) ────────────────────────────
const CSOSN_SAIDA_PADRAO = '102'; // Tributada pelo Simples Nacional sem permissão de crédito
const CSOSN_ENTRADA_PADRAO = '900'; // Outras

// ─── Alíquotas PIS/COFINS padrão ─────────────────────────────────────────────
const DEFAULT_ALIQ = {
  pisLR: 1.65,     // Lucro Real — não cumulativo
  cofinsLR: 7.6,
  pisLP: 0.65,     // Lucro Presumido — cumulativo
  cofinsLP: 3.0,
  ibs: 25.0,       // IBS referência (a ser calibrado por lei)
  cbs: 8.8,        // CBS referência
};

@Injectable()
export class FiscalEngineAutomationService {
  private readonly logger = new Logger(FiscalEngineAutomationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolve todos os campos fiscais de um item de forma automática.
   * Ponto de entrada principal — chamado na criação de NF-e, orçamentos e pedidos.
   */
  async resolveItem(
    context: FiscalContext,
    item: FiscalItemInput,
  ): Promise<FiscalItemResolved> {
    const avisos: string[] = [];
    const date = context.date ?? new Date();
    const totalPrice = this.round(item.quantity * item.unitPrice);

    // 1. Buscar empresa e regime
    const company = await this.prisma.company.findUnique({
      where: { id: context.companyId },
      select: { taxRegime: true, uf: true },
    });
    const regime = company?.taxRegime ?? 'LUCRO_REAL';
    const isSimplesNacional = regime === 'SIMPLES_NACIONAL';

    // 2. Determinar CFOP
    const cfopEntry = CFOP_MAP[context.operationType];
    if (!cfopEntry) {
      avisos.push(`Tipo de operação '${context.operationType}' não mapeado — usando CFOP padrão 5102`);
    }

    let cfopCode: string;
    if (context.exterior) {
      cfopCode = cfopEntry?.ext ?? '7102';
    } else if (context.ufEmitente === context.ufDestinatario) {
      cfopCode = cfopEntry?.intra ?? '5102';
    } else {
      cfopCode = cfopEntry?.inter ?? '6102';
    }
    const naturezaOperacao = cfopEntry?.natureza ?? 'Venda de mercadoria';

    // 3. Buscar NCM
    const ncm = item.ncmCode
      ? await this.prisma.ncm.findFirst({
          where: { code: { startsWith: item.ncmCode.replace(/\./g, '').substring(0, 8) } },
        })
      : null;

    if (item.ncmCode && !ncm) {
      avisos.push(`NCM ${item.ncmCode} não encontrado no cadastro — usando defaults do sistema`);
    }

    // 4. Buscar TaxRule com maior prioridade
    const taxRule = await this.findBestRule(
      context.companyId,
      item.ncmCode ?? '',
      cfopCode,
      context.operationType,
    );

    const fonte = taxRule
      ? 'REGRA_TRIBUTARIA'
      : ncm
        ? 'NCM_DEFAULTS'
        : 'SISTEMA_PADRAO';

    // 5. Resolver CST / CSOSN
    const isSaida = context.operationType.startsWith('SAIDA_');
    let cstIcms: string | undefined;
    let csosn: string | undefined;

    if (isSimplesNacional) {
      csosn = taxRule?.cstIcms // abusamos do campo como CSOSN override em regra
        ?? ncm?.csosn
        ?? (isSaida ? CSOSN_SAIDA_PADRAO : CSOSN_ENTRADA_PADRAO);
    } else {
      cstIcms = taxRule?.cstIcms
        ?? ncm?.cstIcms
        ?? (isSaida ? CST_ICMS_SAIDA_PADRAO : CST_ICMS_ENTRADA_PADRAO);
    }

    // 6. Alíquota ICMS: buscar interestadual se necessário
    let aliqIcms = 0;
    if (!isSimplesNacional) {
      aliqIcms = await this.resolveAliqIcms(
        context,
        ncm,
        taxRule,
        item.origem ?? '0',
      );
    }

    const reducaoBcIcms = Number(taxRule?.reducaoBcIcms ?? ncm?.reducaoBcIcms ?? 0);
    const bcIcms = this.round(totalPrice * (1 - reducaoBcIcms / 100));
    const valorIcms = isSimplesNacional ? 0 : this.round(bcIcms * aliqIcms / 100);

    // 7. ICMS-ST
    const temSt = ncm?.temSt ?? false;
    // ST simplificado (base: MVA padrão 30% — regras específicas por UF não implementadas aqui)
    const aliqIcmsSt = temSt && !isSimplesNacional ? aliqIcms : 0;
    const bcIcmsSt = temSt && !isSimplesNacional ? this.round(totalPrice * 1.3) : 0;
    const valorIcmsSt = temSt && !isSimplesNacional
      ? this.round(bcIcmsSt * aliqIcmsSt / 100 - valorIcms)
      : 0;

    if (temSt) {
      avisos.push('Produto sujeito à Substituição Tributária (ST). Verifique MVA vigente.');
    }

    // 8. IPI
    const cstIpi = taxRule?.cstIpi
      ?? (isSaida ? (ncm?.cstIpiSaida ?? '50') : (ncm?.cstIpiEntrada ?? '00'));
    const aliqIpi = Number(taxRule?.aliqIpi ?? ncm?.aliquotaIpi ?? 0);
    const bcIpi = totalPrice;
    const valorIpi = this.round(bcIpi * aliqIpi / 100);

    // 9. PIS / COFINS
    const cstPis = taxRule?.cstPis
      ?? (isSaida ? (ncm?.cstPisCofinsSaida ?? this.defaultCstPisCofins(regime, isSaida)) : (ncm?.cstPisCofinsEntrada ?? '98'));
    const cstCofins = taxRule?.cstCofins ?? cstPis;

    let aliqPis: number;
    let aliqCofins: number;

    if (isSimplesNacional) {
      // SN não destaca PIS/COFINS na NF-e
      aliqPis = 0;
      aliqCofins = 0;
    } else if (regime === 'LUCRO_REAL') {
      aliqPis = Number(taxRule?.aliqPis ?? ncm?.aliquotaPis ?? DEFAULT_ALIQ.pisLR);
      aliqCofins = Number(taxRule?.aliqCofins ?? ncm?.aliquotaCofins ?? DEFAULT_ALIQ.cofinsLR);
    } else {
      // Lucro Presumido — cumulativo
      aliqPis = Number(taxRule?.aliqPis ?? ncm?.aliquotaPis ?? DEFAULT_ALIQ.pisLP);
      aliqCofins = Number(taxRule?.aliqCofins ?? ncm?.aliquotaCofins ?? DEFAULT_ALIQ.cofinsLP);
    }

    const bcPis = totalPrice;
    const valorPis = this.round(bcPis * aliqPis / 100);
    const bcCofins = totalPrice;
    const valorCofins = this.round(bcCofins * aliqCofins / 100);

    // 10. Reforma Tributária (IBS / CBS / IS)
    const year = date.getFullYear();
    const transitionConfig = await this.getTransitionConfig(context.companyId, year);

    const aliqIbsBase = Number(taxRule?.aliqIbs ?? ncm?.aliquotaIbs ?? DEFAULT_ALIQ.ibs);
    const aliqCbsBase = Number(taxRule?.aliqCbs ?? ncm?.aliquotaCbs ?? DEFAULT_ALIQ.cbs);
    const aliqIsBase = Number(taxRule?.aliqIs ?? ncm?.aliquotaIs ?? 0);

    const ibsPct = transitionConfig.percentualIbs / 100;
    const cbsPct = transitionConfig.percentualCbs / 100;

    const aliqIbs = this.round(aliqIbsBase * ibsPct);
    const bcIbs = totalPrice;
    const valorIbs = transitionConfig.ibsAtiva ? this.round(bcIbs * aliqIbs / 100) : 0;

    const aliqCbs = this.round(aliqCbsBase * cbsPct);
    const bcCbs = totalPrice;
    const valorCbs = transitionConfig.cbsAtiva ? this.round(bcCbs * aliqCbs / 100) : 0;

    const temIs = ncm?.temIs ?? false;
    const aliqIs = temIs ? aliqIsBase : 0;
    const valorIs = temIs && transitionConfig.isAtivo ? this.round(totalPrice * aliqIs / 100) : 0;

    if (temIs) {
      avisos.push(`Produto sujeito ao Imposto Seletivo (IS) — categoria: ${ncm?.categoriaIs ?? 'verificar'}`);
    }

    // 11. Totais
    const valorBruto = totalPrice;
    const valorTotal = this.round(
      valorBruto + valorIpi + valorIbs + valorCbs + valorIs,
    );

    if (fonte === 'SISTEMA_PADRAO') {
      avisos.push('Regras fiscais aplicadas são padrões do sistema. Recomenda-se cadastrar NCM com alíquotas específicas.');
    }

    this.logger.log(
      `[FiscalEngine] NCM=${item.ncmCode} CFOP=${cfopCode} CST=${cstIcms ?? csosn} fonte=${fonte}`,
    );

    return {
      ncmCode: item.ncmCode ?? '',
      cfopCode,
      naturezaOperacao,
      origem: item.origem ?? '0',
      // ICMS
      cstIcms,
      csosn,
      aliqIcms,
      reducaoBcIcms,
      bcIcms,
      valorIcms,
      // ST
      temSt,
      aliqIcmsSt,
      bcIcmsSt,
      valorIcmsSt,
      // IPI
      cstIpi,
      aliqIpi,
      bcIpi,
      valorIpi,
      // PIS
      cstPis,
      aliqPis,
      bcPis,
      valorPis,
      // COFINS
      cstCofins,
      aliqCofins,
      bcCofins,
      valorCofins,
      // Reforma
      aliqIbs,
      bcIbs,
      valorIbs,
      aliqCbs,
      bcCbs,
      valorCbs,
      temIs,
      aliqIs,
      valorIs,
      // Totais
      valorBruto,
      valorTotal,
      // Diagnóstico
      fonte,
      avisos,
    };
  }

  /**
   * Resolve CFOP code (retorna string 4 dígitos) para usar em previews.
   */
  resolveCfop(context: Pick<FiscalContext, 'operationType' | 'ufEmitente' | 'ufDestinatario' | 'exterior'>): string {
    const cfopEntry = CFOP_MAP[context.operationType];
    if (!cfopEntry) return '5102';
    if (context.exterior) return cfopEntry.ext;
    if (context.ufEmitente === context.ufDestinatario) return cfopEntry.intra;
    return cfopEntry.inter;
  }

  /**
   * Resolve alíquota ICMS considerando matriz interestadual.
   */
  private async resolveAliqIcms(
    context: FiscalContext,
    ncm: any,
    taxRule: any,
    origem: string,
  ): Promise<number> {
    if (taxRule?.aliqIcms != null) {
      return Number(taxRule.aliqIcms);
    }

    const isInterestadual = context.ufEmitente !== context.ufDestinatario && !context.exterior;

    if (isInterestadual) {
      // Origem importado (código 1,2,3,4,5,6,7,8) → alíquota 4%
      const isImportado = origem !== '0';
      if (isImportado) return 4;

      // Buscar na matriz ICMS interestadual
      const matrix = await this.prisma.icmsInterestadual.findFirst({
        where: {
          ufOrigem: context.ufEmitente,
          ufDestino: context.ufDestinatario,
        },
      });

      if (matrix) {
        return Number(matrix.aliquota);
      }

      // Fallback: 12% (default interestadual mais comum)
      return 12;
    }

    // Intraestadual — 12% padrão (cada estado define alíquota interna; 12% é o mais comum)
    // O campo correto é aliquotaIcms no NCM, que não existe diretamente — vem de TaxRule
    return 12;
  }

  /**
   * Busca a TaxRule de maior prioridade para o item.
   */
  private async findBestRule(
    companyId: string,
    ncmCode: string,
    cfopCode: string,
    operation: string,
  ) {
    const rules = await this.prisma.taxRule.findMany({
      where: {
        companyId,
        active: true,
        OR: [
          { ncmCode, cfopCode, operation: operation as any },
          { ncmCode, cfopCode, operation: null },
          { ncmCode, cfopCode: null, operation: operation as any },
          { ncmCode: null, cfopCode, operation: operation as any },
          { ncmCode, cfopCode: null, operation: null },
          { ncmCode: null, cfopCode, operation: null },
          { ncmCode: null, cfopCode: null, operation: operation as any },
          { ncmCode: null, cfopCode: null, operation: null },
        ],
      },
      orderBy: { priority: 'desc' },
      take: 1,
    });

    // Partial NCM match (ex: '8704' matches '87041000')
    if (rules.length === 0 && ncmCode.length >= 4) {
      const partial = ncmCode.substring(0, 4);
      const partialRules = await this.prisma.taxRule.findMany({
        where: { companyId, active: true, ncmCode: partial },
        orderBy: { priority: 'desc' },
        take: 1,
      });
      return partialRules[0] ?? null;
    }

    return rules[0] ?? null;
  }

  /**
   * Obtém configuração de transição tributária da Reforma para o ano.
   */
  private async getTransitionConfig(companyId: string, year: number) {
    const config = await this.prisma.taxRegimeConfig.findFirst({
      where: { companyId, anoReferencia: year },
      orderBy: { vigenciaInicio: 'desc' },
    });

    if (config) {
      return {
        percentualIbs: Number(config.percentualIbs ?? 0),
        percentualCbs: Number(config.percentualCbs ?? 0),
        cbsAtiva: config.cbsAtiva,
        ibsAtiva: config.ibsAtiva,
        isAtivo: config.isAtivo,
      };
    }

    // Defaults por ano (EC 132/2023)
    if (year < 2026) return { percentualIbs: 0, percentualCbs: 0, cbsAtiva: false, ibsAtiva: false, isAtivo: false };
    if (year === 2026) return { percentualIbs: 10, percentualCbs: 10, cbsAtiva: true, ibsAtiva: true, isAtivo: true };
    if (year === 2027) return { percentualIbs: 20, percentualCbs: 20, cbsAtiva: true, ibsAtiva: true, isAtivo: true };
    if (year >= 2033) return { percentualIbs: 100, percentualCbs: 100, cbsAtiva: true, ibsAtiva: true, isAtivo: true };

    const pct = Math.min(100, (year - 2026) * 15 + 10);
    return { percentualIbs: pct, percentualCbs: pct, cbsAtiva: true, ibsAtiva: true, isAtivo: true };
  }

  /**
   * CST PIS/COFINS padrão por regime e direção.
   */
  private defaultCstPisCofins(regime: string, isSaida: boolean): string {
    if (regime === 'SIMPLES_NACIONAL') return '07'; // SN sem crédito
    if (isSaida) return regime === 'LUCRO_REAL' ? '01' : '01'; // tributada
    return '50'; // entrada — operação de aquisição
  }

  private round(value: number): number {
    return Math.round(value * 10000) / 10000;
  }
}
