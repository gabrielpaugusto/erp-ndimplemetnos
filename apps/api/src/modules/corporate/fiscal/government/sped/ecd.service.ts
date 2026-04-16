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
 * A13 — ECD (Escrituração Contábil Digital) — SPED Contábil — Layout 010
 *
 * Blocos gerados com dados reais do banco:
 *  - Bloco 0 : identificação da empresa
 *  - Bloco I : plano de contas (I050) + lançamentos contábeis (I200/I250)
 *              + totalização por conta (I355)
 *  - Bloco J : balanço patrimonial (J100) + DRE sintética (J210)
 *  - Bloco 9 : encerramento com contagens dinâmicas
 */
@Injectable()
export class EcdService extends GovernmentTransmissionService {
  private static readonly LAYOUT_VERSION = '010';

  constructor(
    protected readonly prisma: PrismaService,
    protected readonly configService: ConfigService,
  ) {
    super(prisma, configService);
  }

  // ---------------------------------------------------------------------------
  // Mappers
  // ---------------------------------------------------------------------------

  /** AccountType → ECD cod_natureza */
  private mapNatureza(type: string): string {
    switch (type) {
      case 'ATIVO':              return '01';
      case 'PASSIVO':            return '02';
      case 'PATRIMONIO_LIQUIDO': return '03';
      case 'RECEITA':            return '04';
      case 'DESPESA':            return '05';
      default:                   return '09';
    }
  }

  /** Account code prefix → ECD cod_AGL_DRE (plano referencial simplificado) */
  private mapAglCtn(code: string): string {
    const prefix = code.split('.')[0];
    switch (prefix) {
      case '1': return '1';
      case '2': return '2';
      case '3': return '3';
      case '4': return '4';
      case '5': return '5';
      default:  return '9';
    }
  }

  // ---------------------------------------------------------------------------
  // Main generator
  // ---------------------------------------------------------------------------

  async generateFile(companyId: string, anoReferencia: number): Promise<string> {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new Error(`Company ${companyId} not found`);

    const dtIni = new Date(anoReferencia, 0, 1);
    const dtFim = new Date(anoReferencia, 11, 31);

    const lines: string[] = [];
    let lineCount = 0;
    const push = (line: string) => { lines.push(line); lineCount++; };

    // =========================================================================
    // BLOCO 0 — Abertura e Identificação
    // =========================================================================

    push(generateSpedLine(
      '0000',
      'LECD',
      EcdService.LAYOUT_VERSION,
      '',                                                  // hash (preenchido pelo PVA)
      formatSpedDate(dtIni),
      formatSpedDate(dtFim),
      company.razaoSocial,
      (company.cnpj ?? '').replace(/\D/g, ''),
      company.uf || 'SP',
      (company.inscricaoEstadual ?? '').replace(/\D/g, ''),
      company.codigoMunicipioIbge || '9999999',
      '',  // IM
      '0', // ind_sit_esp: 0=normal
      '0', // ind_sit_ini_per: 0=início normal
      '0', // ind_nire
      '0', // ind_finalidade: 0=original
      '',  // hash substituto
      '0', // ind_grande_porte: 0=não
    ));

    push(generateSpedLine('0001', '0')); // 0=com dados

    // 0007 — CNPJ responsável pela escrituração (própria empresa)
    push(generateSpedLine('0007', (company.cnpj ?? '').replace(/\D/g, '')));

    push(generateSpedLine('0990', (lineCount + 1).toString()));

    // =========================================================================
    // BLOCO I — Lançamentos Contábeis
    // =========================================================================

    push(generateSpedLine('I001', '0'));

    // I010 — Identificação do livro (G = Diário Geral)
    push(generateSpedLine('I010',
      'G',    // tipo livro: G=Diário Geral
      '2.00', // versão plano referencial FCONT
    ));

    // I015 — Parâmetros do Plano de Contas Referencial
    push(generateSpedLine('I015', '2.00'));

    // -------------------------------------------------------------------------
    // I050 — Plano de Contas (dados reais do ChartOfAccount)
    // -------------------------------------------------------------------------
    const accounts = await this.prisma.chartOfAccount.findMany({
      where: { companyId, active: true },
      orderBy: [{ level: 'asc' }, { code: 'asc' }],
      include: { parent: { select: { code: true } } },
    });

    for (const acc of accounts) {
      push(generateSpedLine(
        'I050',
        formatSpedDate(dtIni),                                 // DT_ALT
        this.mapNatureza((acc as any).type),                   // COD_NAT
        acc.acceptsEntries ? 'A' : 'S',                       // IND_CTA: S=sintética, A=analítica
        acc.level.toString(),                                  // NIVEL
        acc.code,                                              // COD_CTA
        (acc as any).parent?.code ?? '',                       // COD_CTA_SUP
        acc.name,                                              // NOME_CTA
      ));
    }

    // Plano mínimo de fallback caso não haja contas cadastradas
    if (accounts.length === 0) {
      push(generateSpedLine('I050', formatSpedDate(dtIni), '01', 'S', '1', '1', '', 'ATIVO'));
      push(generateSpedLine('I050', formatSpedDate(dtIni), '02', 'S', '1', '2', '', 'PASSIVO'));
      push(generateSpedLine('I050', formatSpedDate(dtIni), '03', 'S', '1', '3', '', 'PATRIMÔNIO LÍQUIDO'));
      push(generateSpedLine('I050', formatSpedDate(dtIni), '04', 'S', '1', '4', '', 'RECEITAS'));
      push(generateSpedLine('I050', formatSpedDate(dtIni), '05', 'S', '1', '5', '', 'DESPESAS'));
    }

    // -------------------------------------------------------------------------
    // I150 — Identificação do período
    // -------------------------------------------------------------------------
    push(generateSpedLine('I150', formatSpedDate(dtIni), formatSpedDate(dtFim)));

    // -------------------------------------------------------------------------
    // I200/I250 — Lançamentos contábeis (dados reais do JournalEntry)
    // -------------------------------------------------------------------------
    const entries = await this.prisma.journalEntry.findMany({
      where: {
        companyId,
        date: { gte: dtIni, lte: dtFim },
        status: 'LANCADO' as any,
      },
      include: {
        items: {
          include: { account: { select: { code: true } } },
          orderBy: { id: 'asc' },
        },
      },
      orderBy: { numero: 'asc' },
    });

    for (const entry of entries) {
      push(generateSpedLine(
        'I200',
        entry.numero,                                               // NUM_LCTO
        formatSpedDate(new Date(entry.date)),                       // DT_LCTO
        formatSpedDecimal(Number(entry.totalValue ?? 0)),           // VL_LCTO
        'N',                                                        // IND_LCTO: N=normal
      ));

      for (const item of entry.items) {
        push(generateSpedLine(
          'I250',
          item.account.code,                                              // COD_CTA
          (item as any).type === 'DEVEDORA' ? 'D' : 'C',                 // IND_DC
          formatSpedDecimal(Number(item.value ?? 0)),                    // VL_ITEM
          entry.numero,                                                    // NUM_LCTO
          '',                                                              // COD_HIST
          ((item.description ?? entry.description) ?? '').slice(0, 60),  // HIST
        ));
      }
    }

    // -------------------------------------------------------------------------
    // I355 — Totalização por conta no período (créditos, débitos)
    // -------------------------------------------------------------------------
    const accountTotals = new Map<string, { debitos: number; creditos: number }>();

    for (const entry of entries) {
      for (const item of entry.items) {
        const cod = item.account.code;
        const cur = accountTotals.get(cod) ?? { debitos: 0, creditos: 0 };
        if ((item as any).type === 'DEVEDORA') {
          cur.debitos += Number(item.value ?? 0);
        } else {
          cur.creditos += Number(item.value ?? 0);
        }
        accountTotals.set(cod, cur);
      }
    }

    for (const [cod, totals] of accountTotals.entries()) {
      push(generateSpedLine(
        'I355',
        cod,
        formatSpedDate(dtIni),
        formatSpedDate(dtFim),
        formatSpedDecimal(totals.debitos),
        formatSpedDecimal(totals.creditos),
      ));
    }

    push(generateSpedLine('I990', (lineCount + 1).toString()));

    // =========================================================================
    // BLOCO J — Demonstrações Contábeis
    // =========================================================================

    push(generateSpedLine('J001', '0'));

    // J005 — Cabeçalho do balanço / balancete
    push(generateSpedLine('J005',
      formatSpedDate(dtFim),
      '',
      'BALANÇO PATRIMONIAL E DRE',
    ));

    // -------------------------------------------------------------------------
    // J100 — Balanço Patrimonial (uma linha por conta analítica)
    // -------------------------------------------------------------------------
    for (const acc of accounts) {
      if (!acc.acceptsEntries) continue;
      const totals = accountTotals.get(acc.code);
      if (!totals) continue;

      const nature = (acc as any).nature as string; // DEVEDORA ou CREDORA
      const saldo = nature === 'DEVEDORA'
        ? totals.debitos - totals.creditos
        : totals.creditos - totals.debitos;

      push(generateSpedLine(
        'J100',
        acc.code,
        acc.name,
        acc.level.toString(),
        acc.acceptsEntries ? 'A' : 'S',
        this.mapNatureza((acc as any).type),
        formatSpedDecimal(0),                       // VL_SLD_INI (saldo inicial simplificado = 0)
        nature === 'DEVEDORA' ? 'D' : 'C',         // IND_SLD_INI
        formatSpedDecimal(Math.abs(saldo)),         // VL_SLD_FIN
        saldo >= 0 ? (nature === 'DEVEDORA' ? 'D' : 'C') : (nature === 'DEVEDORA' ? 'C' : 'D'),
      ));
    }

    // -------------------------------------------------------------------------
    // J210 — DRE sintética (contas de Receita e Despesa)
    // -------------------------------------------------------------------------
    for (const acc of accounts) {
      if (!acc.acceptsEntries) continue;
      const type = (acc as any).type as string;
      if (type !== 'RECEITA' && type !== 'DESPESA') continue;

      const totals = accountTotals.get(acc.code);
      if (!totals) continue;

      const valor = type === 'RECEITA'
        ? totals.creditos - totals.debitos
        : totals.debitos - totals.creditos;

      push(generateSpedLine(
        'J210',
        this.mapAglCtn(acc.code),
        acc.level.toString(),
        acc.acceptsEntries ? 'A' : 'S',
        acc.name,
        formatSpedDecimal(Math.abs(valor)),
        formatSpedDecimal(0),                       // VL_CTA_ANO_ANT (não disponível)
      ));
    }

    push(generateSpedLine('J990', (lineCount + 1).toString()));

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
    const extra9900 = 4; // 9900 + 9990 + 9999 + 9001
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
      type: 'ECD',
      endpoint: 'local:file_generation',
      success: true,
      documentNumber: `ECD_${anoReferencia}`,
      processingTimeMs: 0,
    });

    this.logger.log(
      `[ECD] ${company.razaoSocial} — ano ${anoReferencia} — ${lineCount} linhas — ` +
      `${entries.length} lançamentos — ${accounts.length} contas`,
    );

    return fileContent;
  }
}
