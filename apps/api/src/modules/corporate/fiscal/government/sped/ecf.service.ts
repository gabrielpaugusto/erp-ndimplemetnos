import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';
import { ConfigService } from '@nestjs/config';
import { GovernmentTransmissionService } from '../government-transmission.service';
import {
  generateSpedLine,
  formatSpedDecimal,
  formatSpedDate,
} from './sped-file-header';

/**
 * A13 — ECF (Escrituração Contábil Fiscal) — Layout 010
 *
 * Gerado com dados reais do DRE (DreApuracao anual ou somatório mensal).
 *
 * Blocos:
 *  - Bloco 0  : identificação
 *  - Bloco C  : dados da empresa / declarante
 *  - Bloco L  : Lucro Real — dados do balanço patrimonial e DRE
 *  - Bloco M  : e-LALUR / e-LACS (adições e exclusões ao lucro líquido)
 *  - Bloco N  : cálculo do IRPJ (15% + 10% adicional) e CSLL (9%)
 *  - Bloco 9  : encerramento com contagens dinâmicas
 *
 * Regime suportado: Lucro Real (tipo_ecf = '1')
 */
@Injectable()
export class EcfService extends GovernmentTransmissionService {
  private static readonly LAYOUT_VERSION = '010';

  constructor(
    protected readonly prisma: PrismaService,
    protected readonly configService: ConfigService,
  ) {
    super(prisma, configService);
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /** Round to 2 decimal places */
  private round(v: number): number {
    return Math.round(v * 100) / 100;
  }

  /**
   * Fetch DRE annual data for the reference year.
   * Tries to find a DreApuracao of tipo='ANUAL' first; if not found,
   * sums all monthly records for the year.
   */
  private async fetchDreAnual(companyId: string, ano: number): Promise<{
    receitaBruta: number;
    deducoes: number;
    receitaLiquida: number;
    custoTotal: number;
    lucroBruto: number;
    despesasOp: number;
    ebitda: number;
    resultadoFinanceiro: number;
    lair: number;
    irpj: number;
    csll: number;
    lucroLiquido: number;
  }> {
    const periodoAnual = `${ano}-00`; // chave especial para tipo ANUAL

    // Tentar snapshot anual
    const anual = await this.prisma.dreApuracao.findFirst({
      where: { companyId, periodoReferencia: periodoAnual, tipo: 'ANUAL' },
    }).catch(() => null);

    if (anual) {
      return {
        receitaBruta:      Number(anual.receitaBrutaVendas) + Number(anual.receitaBrutaServicos),
        deducoes:          Number(anual.deducoesReceita),
        receitaLiquida:    Number(anual.receitaLiquida),
        custoTotal:        Number(anual.custoMercadorias) + Number(anual.custoServicos),
        lucroBruto:        Number(anual.lucroBruto),
        despesasOp:        Number(anual.despesasVendas) + Number(anual.despesasAdm) + Number(anual.despesasGerais),
        ebitda:            Number(anual.ebitda),
        resultadoFinanceiro: Number(anual.resultadoFinanceiro),
        lair:              Number(anual.lair),
        irpj:              Number(anual.irpj),
        csll:              Number(anual.csll),
        lucroLiquido:      Number(anual.lucroLiquido),
      };
    }

    // Somar registros mensais do ano
    const mensais = await this.prisma.dreApuracao.findMany({
      where: {
        companyId,
        tipo: 'MENSAL',
        periodoReferencia: { startsWith: `${ano}-` },
      },
    }).catch(() => [] as Awaited<ReturnType<typeof this.prisma.dreApuracao.findMany>>);

    const sum = mensais.reduce(
      (acc, m) => ({
        receitaBruta:       acc.receitaBruta    + Number(m.receitaBrutaVendas) + Number(m.receitaBrutaServicos),
        deducoes:           acc.deducoes        + Number(m.deducoesReceita),
        receitaLiquida:     acc.receitaLiquida  + Number(m.receitaLiquida),
        custoTotal:         acc.custoTotal      + Number(m.custoMercadorias) + Number(m.custoServicos),
        lucroBruto:         acc.lucroBruto      + Number(m.lucroBruto),
        despesasOp:         acc.despesasOp      + Number(m.despesasVendas) + Number(m.despesasAdm) + Number(m.despesasGerais),
        ebitda:             acc.ebitda          + Number(m.ebitda),
        resultadoFinanceiro:acc.resultadoFinanceiro + Number(m.resultadoFinanceiro),
        lair:               acc.lair            + Number(m.lair),
        irpj:               acc.irpj            + Number(m.irpj),
        csll:               acc.csll            + Number(m.csll),
        lucroLiquido:       acc.lucroLiquido    + Number(m.lucroLiquido),
      }),
      {
        receitaBruta: 0, deducoes: 0, receitaLiquida: 0, custoTotal: 0,
        lucroBruto: 0, despesasOp: 0, ebitda: 0, resultadoFinanceiro: 0,
        lair: 0, irpj: 0, csll: 0, lucroLiquido: 0,
      },
    );

    // Se não há DRE algum, calcular a partir de JournalEntry
    if (mensais.length === 0) {
      return await this.calcDreFromJournal(companyId, ano);
    }

    return sum;
  }

  /**
   * Fallback: calcular DRE diretamente dos lançamentos contábeis.
   * Agrupa por tipo de conta (RECEITA vs DESPESA).
   */
  private async calcDreFromJournal(companyId: string, ano: number): Promise<ReturnType<EcfService['fetchDreAnual']>> {
    const dtIni = new Date(ano, 0, 1);
    const dtFim = new Date(ano, 11, 31);

    const items = await this.prisma.journalEntryItem.findMany({
      where: {
        journalEntry: {
          companyId,
          date: { gte: dtIni, lte: dtFim },
          status: 'LANCADO' as any,
        },
      },
      include: {
        account: { select: { type: true, nature: true } },
      },
    });

    let receitaBruta = 0;
    let despesasTotal = 0;

    for (const item of items) {
      const type = (item.account as any).type as string;
      const nature = (item.account as any).nature as string;
      const valor = Number(item.value ?? 0);

      if (type === 'RECEITA') {
        receitaBruta += nature === 'CREDORA' ? valor : -valor;
      } else if (type === 'DESPESA') {
        despesasTotal += nature === 'DEVEDORA' ? valor : -valor;
      }
    }

    const receitaLiquida = receitaBruta;
    const lucroBruto = receitaLiquida - despesasTotal;
    const lair = lucroBruto;
    const irpj = this.round(Math.max(0, lair) * 0.15);
    const csll = this.round(Math.max(0, lair) * 0.09);
    const lucroLiquido = lair - irpj - csll;

    return {
      receitaBruta, deducoes: 0, receitaLiquida,
      custoTotal: 0, lucroBruto: receitaLiquida,
      despesasOp: despesasTotal, ebitda: lucroBruto,
      resultadoFinanceiro: 0, lair,
      irpj, csll, lucroLiquido,
    };
  }

  // ---------------------------------------------------------------------------
  // Main generator
  // ---------------------------------------------------------------------------

  async generateFile(companyId: string, anoReferencia: number): Promise<string> {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new Error(`Company ${companyId} not found`);

    const dtIni = new Date(anoReferencia, 0, 1);
    const dtFim = new Date(anoReferencia, 11, 31);

    // Buscar dados do DRE anual
    const dre = await this.fetchDreAnual(companyId, anoReferencia);

    // IRPJ — 15% sobre lucro real + 10% adicional sobre parcela acima de R$240k/ano
    const lucroReal = Math.max(0, dre.lair);
    const irpjBase  = this.round(lucroReal * 0.15);
    const adicionalBase = Math.max(0, lucroReal - 240000);
    const irpjAdicional = this.round(adicionalBase * 0.10);
    const irpjTotal = this.round(irpjBase + irpjAdicional);

    // CSLL — 9% sobre base de cálculo (mesma base do LAIR para simplificação)
    const csllTotal = this.round(lucroReal * 0.09);

    const lines: string[] = [];
    let lineCount = 0;
    const push = (line: string) => { lines.push(line); lineCount++; };

    // =========================================================================
    // BLOCO 0 — Abertura e Identificação
    // =========================================================================

    push(generateSpedLine(
      '0000',
      'LECF',
      EcfService.LAYOUT_VERSION,
      '',                                               // hash (preenchido pelo PVA)
      formatSpedDate(dtIni),
      formatSpedDate(dtFim),
      company.razaoSocial,
      (company.cnpj ?? '').replace(/\D/g, ''),
      company.uf || 'SP',
      '',  // hash ECF anterior
      '',  // NIRE
      '',  // natureza jurídica
      '0', // ind_sit_ini_per
      '0', // ind_sit_esp
      '',  // PAT_REMANESC
      '0', // ind_ativ_rural
      '',  // hash ECD vinculada
      '1', // tipo_ecf: 1=Lucro Real, 3=Lucro Presumido
      '',  // forma tributacao
    ));

    push(generateSpedLine('0001', '0'));

    // 0010 — Parâmetros tributários
    push(generateSpedLine(
      '0010',
      '',  // hash ECD
      '1', // forma_tributacao: 1=Lucro Real
      'A', // forma_apuracao: A=anual, T=trimestral
      'C', // tipo_escrit: C=PJ em geral
      '0', // optante REFIS
      '0', // optante PAES
      '0', // forma_aval_estoques: 0=custo médio
      '0', // ind_ativ_rural
      '0', // lucro_exploracao
      '0', // participante_exterior
      '0', // ind_isencao
      '0', // ind_trib_dif
      '0', // ind_trib_mono
      '0', // ind_trib_zona_franca
      '0', // ind_fundos_inv
      '0', // ind_obras_audio
      '0', // ind_ativ_incentivada
    ));

    push(generateSpedLine('0990', (lineCount + 1).toString()));

    // =========================================================================
    // BLOCO C — Dados do Declarante
    // =========================================================================

    push(generateSpedLine('C001', '0'));

    // C010 — Identificação do declarante
    push(generateSpedLine(
      'C010',
      (company.cnpj ?? '').replace(/\D/g, ''),
      company.razaoSocial,
      company.uf || 'SP',
      company.codigoMunicipioIbge || '9999999',
    ));

    push(generateSpedLine('C990', (lineCount + 1).toString()));

    // =========================================================================
    // BLOCO L — Lucro Real (Balanço e DRE resumidos)
    // =========================================================================

    push(generateSpedLine('L001', '0'));

    // L030 — Identificação do período
    push(generateSpedLine('L030',
      formatSpedDate(dtIni),
      formatSpedDate(dtFim),
    ));

    // L100 — Balanço Patrimonial simplificado (linhas obrigatórias)
    // Estas linhas usam o cod_AGL do plano referencial SPED
    push(generateSpedLine('L100', '109', '1', 'A', 'ATIVO TOTAL',
      formatSpedDecimal(dre.receitaBruta),  // simplificado: ativo ~ receita bruta
      'D',
      formatSpedDecimal(dre.receitaBruta),
      'D',
    ));
    push(generateSpedLine('L100', '207', '1', 'A', 'PASSIVO TOTAL',
      formatSpedDecimal(0), 'C',
      formatSpedDecimal(0), 'C',
    ));
    push(generateSpedLine('L100', '300', '1', 'A', 'PATRIMÔNIO LÍQUIDO',
      formatSpedDecimal(dre.lucroLiquido), 'C',
      formatSpedDecimal(dre.lucroLiquido), 'C',
    ));

    // L200 — DRE (Demonstração do Resultado do Exercício)
    push(generateSpedLine('L200', '301', '1', 'A', 'RECEITA BRUTA DE VENDAS E SERVIÇOS',
      formatSpedDecimal(dre.receitaBruta),
      formatSpedDecimal(0),
    ));
    push(generateSpedLine('L200', '302', '1', 'A', '(-) DEDUÇÕES DA RECEITA BRUTA',
      formatSpedDecimal(dre.deducoes),
      formatSpedDecimal(0),
    ));
    push(generateSpedLine('L200', '303', '1', 'A', '(=) RECEITA LÍQUIDA',
      formatSpedDecimal(dre.receitaLiquida),
      formatSpedDecimal(0),
    ));
    push(generateSpedLine('L200', '304', '1', 'A', '(-) CUSTO DAS MERCADORIAS / SERVIÇOS',
      formatSpedDecimal(dre.custoTotal),
      formatSpedDecimal(0),
    ));
    push(generateSpedLine('L200', '305', '1', 'A', '(=) LUCRO BRUTO',
      formatSpedDecimal(dre.lucroBruto),
      formatSpedDecimal(0),
    ));
    push(generateSpedLine('L200', '306', '1', 'A', '(-) DESPESAS OPERACIONAIS',
      formatSpedDecimal(dre.despesasOp),
      formatSpedDecimal(0),
    ));
    push(generateSpedLine('L200', '308', '1', 'A', '(=) RESULTADO ANTES DO IRPJ/CSLL (LAIR)',
      formatSpedDecimal(dre.lair),
      formatSpedDecimal(0),
    ));
    push(generateSpedLine('L200', '309', '1', 'A', '(-) IRPJ',
      formatSpedDecimal(irpjTotal),
      formatSpedDecimal(0),
    ));
    push(generateSpedLine('L200', '310', '1', 'A', '(-) CSLL',
      formatSpedDecimal(csllTotal),
      formatSpedDecimal(0),
    ));
    push(generateSpedLine('L200', '311', '1', 'A', '(=) LUCRO LÍQUIDO DO EXERCÍCIO',
      formatSpedDecimal(dre.lucroLiquido),
      formatSpedDecimal(0),
    ));

    push(generateSpedLine('L990', (lineCount + 1).toString()));

    // =========================================================================
    // BLOCO M — e-LALUR / e-LACS (Livro de Apuração do Lucro Real)
    // =========================================================================

    push(generateSpedLine('M001', '0'));

    // M010 — Identificação das contas do LALUR
    push(generateSpedLine('M010',
      '001', // cod_cta_lalur
      'LUCRO LÍQUIDO ANTES DO AJUSTE FISCAL',
    ));

    // M300 — Parte A do LALUR: lançamentos de adição/exclusão ao lucro
    // Registro 1: Lucro líquido contábil (ponto de partida)
    push(generateSpedLine('M300',
      '0001',                                          // NUM_LCTO
      'LUCRO LÍQUIDO DO EXERCÍCIO',                    // HIST
      formatSpedDecimal(Math.max(0, dre.lucroLiquido)), // VL_LCTO
      'A',                                             // IND_LCTO: A=adição
      'IRPJ',                                          // TRIBUTO
      '001',                                           // NAT_ADIC_EXCL
      formatSpedDate(dtFim),                           // PER_APURACAO
    ));

    // Registro 2: Ajustes temporários (simplificado — sem adições/exclusões específicas)
    push(generateSpedLine('M300',
      '0002',
      'BASE DE CÁLCULO DO IRPJ (LUCRO REAL)',
      formatSpedDecimal(lucroReal),
      'A',
      'IRPJ',
      '099',
      formatSpedDate(dtFim),
    ));

    // M350 — Parte A do LACS (CSLL)
    push(generateSpedLine('M350',
      '0001',
      'BASE DE CÁLCULO DA CSLL',
      formatSpedDecimal(lucroReal),
      'A',
      'CSLL',
      '001',
      formatSpedDate(dtFim),
    ));

    push(generateSpedLine('M990', (lineCount + 1).toString()));

    // =========================================================================
    // BLOCO N — Cálculo do IRPJ e CSLL
    // =========================================================================

    push(generateSpedLine('N001', '0'));

    // N600 — IRPJ — Cálculo anual (Lucro Real)
    push(generateSpedLine(
      'N600',
      formatSpedDate(dtIni),                   // DT_INI_APURACAO
      formatSpedDate(dtFim),                   // DT_FIM_APURACAO
      formatSpedDecimal(lucroReal),            // VL_BC_IRPJ (lucro real)
      formatSpedDecimal(15),                   // ALIQ_IRPJ (15%)
      formatSpedDecimal(irpjBase),             // VL_IRPJ_CALC
      formatSpedDecimal(adicionalBase),        // VL_BC_ADIC (base do adicional)
      formatSpedDecimal(10),                   // ALIQ_ADIC (10%)
      formatSpedDecimal(irpjAdicional),        // VL_ADIC
      formatSpedDecimal(irpjTotal),            // VL_IRPJ_DEVIDO
      formatSpedDecimal(0),                    // VL_DEDUCAO
      formatSpedDecimal(irpjTotal),            // VL_IRPJ_A_PAGAR
    ));

    // N650 — CSLL — Cálculo anual
    push(generateSpedLine(
      'N650',
      formatSpedDate(dtIni),                   // DT_INI_APURACAO
      formatSpedDate(dtFim),                   // DT_FIM_APURACAO
      formatSpedDecimal(lucroReal),            // VL_BC_CSLL
      formatSpedDecimal(9),                    // ALIQ_CSLL (9%)
      formatSpedDecimal(csllTotal),            // VL_CSLL_CALC
      formatSpedDecimal(0),                    // VL_DEDUCAO
      formatSpedDecimal(csllTotal),            // VL_CSLL_A_PAGAR
    ));

    push(generateSpedLine('N990', (lineCount + 1).toString()));

    // =========================================================================
    // BLOCO 9 — Controle e Encerramento
    // =========================================================================

    push(generateSpedLine('9001', '0'));

    // Contagem dinâmica de registros para 9900
    const regCounts = new Map<string, number>();
    for (const line of lines) {
      const parts = line.split('|');
      if (parts.length >= 2) {
        const reg = parts[1];
        regCounts.set(reg, (regCounts.get(reg) ?? 0) + 1);
      }
    }

    const sortedRegs = Array.from(regCounts.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    const extra9900 = 4;
    const total9900 = sortedRegs.length + extra9900;

    for (const [reg, count] of sortedRegs) {
      push(generateSpedLine('9900', reg, count.toString()));
    }
    push(generateSpedLine('9900', '9900', total9900.toString()));
    push(generateSpedLine('9900', '9990', '1'));
    push(generateSpedLine('9900', '9999', '1'));
    push(generateSpedLine('9900', '9001', '1'));

    push(generateSpedLine('9990', (lineCount + 1).toString()));
    push(generateSpedLine('9999', (lineCount + 1).toString()));

    const fileContent = lines.join('\r\n');

    await this.logTransmission({
      companyId,
      type: 'ECF',
      endpoint: 'local:file_generation',
      success: true,
      documentNumber: `ECF_${anoReferencia}`,
      processingTimeMs: 0,
    });

    this.logger.log(
      `[ECF] ${company.razaoSocial} — ano ${anoReferencia} — ${lineCount} linhas — ` +
      `LAIR R$ ${dre.lair.toFixed(2)} — IRPJ R$ ${irpjTotal.toFixed(2)} — CSLL R$ ${csllTotal.toFixed(2)}`,
    );

    return fileContent;
  }
}
