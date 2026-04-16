import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';

export interface DreResultado {
  companyId: string;
  periodoReferencia: string;
  tipo: string;

  // Receitas
  receitaBrutaVendas: number;
  receitaBrutaServicos: number;
  deducoesReceita: number;
  receitaLiquida: number;

  // Custos
  custoMercadorias: number;
  custoServicos: number;
  lucroBruto: number;

  // Despesas Operacionais
  despesasVendas: number;
  despesasAdm: number;
  despesasGerais: number;
  ebitda: number;

  // Resultado Financeiro
  receitasFinanceiras: number;
  despesasFinanceiras: number;
  resultadoFinanceiro: number;

  // Resultado Final
  lair: number;
  irpj: number;
  csll: number;
  lucroLiquido: number;

  calculadoEm: Date;
  fromSnapshot: boolean;
}

@Injectable()
export class DreService {
  constructor(private readonly prisma: PrismaService) {}

  // --------------------------------------------------------------------------
  // Main: calculate DRE from JournalEntries for a given period
  // --------------------------------------------------------------------------
  async calcular(companyId: string, periodo: string): Promise<DreResultado> {
    const [year, month] = periodo.split('-').map(Number);
    const inicio = new Date(year, month - 1, 1);
    const fim = new Date(year, month, 1);

    // Load all JournalEntryItems for this period, with account info
    const items = await this.prisma.journalEntryItem.findMany({
      where: {
        journalEntry: {
          companyId,
          status: 'LANCADO',
          date: { gte: inicio, lt: fim },
        },
      },
      include: {
        account: { select: { code: true, type: true, nature: true, name: true } },
      },
    });

    // Helper: sum values by account code prefix and entry type
    const sumByPrefix = (prefix: string, entryType: 'DEVEDORA' | 'CREDORA'): number => {
      return items
        .filter((i) => i.account.code.startsWith(prefix) && i.type === entryType)
        .reduce((sum, i) => sum + toNum(i.value), 0);
    };

    // ------------------------------------------------------------------
    // RECEITAS — accounts 3.x (CREDORA entries = revenue)
    // ------------------------------------------------------------------
    const receitaBrutaVendas   = sumByPrefix('3.1.1', 'CREDORA');
    const receitaBrutaServicos = sumByPrefix('3.1.2', 'CREDORA');
    const deducoesReceita      = sumByPrefix('3.2', 'DEVEDORA'); // devoluções / descontos
    const receitaLiquida       = receitaBrutaVendas + receitaBrutaServicos - deducoesReceita;

    // ------------------------------------------------------------------
    // CUSTOS — accounts 4.1.x
    // ------------------------------------------------------------------
    const custoMercadorias = sumByPrefix('4.1.1', 'DEVEDORA'); // CMV
    const custoServicos    = sumByPrefix('4.1.2', 'DEVEDORA'); // CSP
    const lucroBruto       = receitaLiquida - custoMercadorias - custoServicos;

    // ------------------------------------------------------------------
    // DESPESAS OPERACIONAIS — accounts 4.2.x, 4.3.x, 4.4.x
    // ------------------------------------------------------------------
    const despesasAdm    = sumByPrefix('4.2', 'DEVEDORA');
    const despesasVendas = sumByPrefix('4.3', 'DEVEDORA');
    const despesasGerais = sumByPrefix('4.4', 'DEVEDORA');
    const ebitda         = lucroBruto - despesasAdm - despesasVendas - despesasGerais;

    // ------------------------------------------------------------------
    // RESULTADO FINANCEIRO — accounts 5.x
    // ------------------------------------------------------------------
    const receitasFinanceiras  = sumByPrefix('5.', 'CREDORA');
    const despesasFinanceiras  = sumByPrefix('5.', 'DEVEDORA');
    const resultadoFinanceiro  = receitasFinanceiras - despesasFinanceiras;

    // ------------------------------------------------------------------
    // RESULTADO FINAL
    // ------------------------------------------------------------------
    const lair          = ebitda + resultadoFinanceiro;
    // IRPJ/CSLL simplified: 15% + 9% over positive LAIR (Lucro Real)
    const irpj          = lair > 0 ? round(lair * 0.15) : 0;
    const csll          = lair > 0 ? round(lair * 0.09) : 0;
    const lucroLiquido  = lair - irpj - csll;

    return {
      companyId,
      periodoReferencia: periodo,
      tipo: 'MENSAL',
      receitaBrutaVendas:   round(receitaBrutaVendas),
      receitaBrutaServicos: round(receitaBrutaServicos),
      deducoesReceita:      round(deducoesReceita),
      receitaLiquida:       round(receitaLiquida),
      custoMercadorias:     round(custoMercadorias),
      custoServicos:        round(custoServicos),
      lucroBruto:           round(lucroBruto),
      despesasVendas:       round(despesasVendas),
      despesasAdm:          round(despesasAdm),
      despesasGerais:       round(despesasGerais),
      ebitda:               round(ebitda),
      receitasFinanceiras:  round(receitasFinanceiras),
      despesasFinanceiras:  round(despesasFinanceiras),
      resultadoFinanceiro:  round(resultadoFinanceiro),
      lair:                 round(lair),
      irpj,
      csll,
      lucroLiquido:         round(lucroLiquido),
      calculadoEm:          new Date(),
      fromSnapshot:         false,
    };
  }

  // --------------------------------------------------------------------------
  // Persist snapshot
  // --------------------------------------------------------------------------
  async salvarSnapshot(companyId: string, periodo: string, tipo = 'MENSAL'): Promise<DreResultado> {
    const dre = await this.calcular(companyId, periodo);

    await this.prisma.dreApuracao.upsert({
      where: { companyId_periodoReferencia_tipo: { companyId, periodoReferencia: periodo, tipo } },
      create: {
        companyId,
        periodoReferencia: periodo,
        tipo,
        receitaBrutaVendas:   dre.receitaBrutaVendas,
        receitaBrutaServicos: dre.receitaBrutaServicos,
        deducoesReceita:      dre.deducoesReceita,
        receitaLiquida:       dre.receitaLiquida,
        custoMercadorias:     dre.custoMercadorias,
        custoServicos:        dre.custoServicos,
        lucroBruto:           dre.lucroBruto,
        despesasVendas:       dre.despesasVendas,
        despesasAdm:          dre.despesasAdm,
        despesasGerais:       dre.despesasGerais,
        ebitda:               dre.ebitda,
        receitasFinanceiras:  dre.receitasFinanceiras,
        despesasFinanceiras:  dre.despesasFinanceiras,
        resultadoFinanceiro:  dre.resultadoFinanceiro,
        lair:                 dre.lair,
        irpj:                 dre.irpj,
        csll:                 dre.csll,
        lucroLiquido:         dre.lucroLiquido,
        calculadoEm:          new Date(),
      },
      update: {
        receitaBrutaVendas:   dre.receitaBrutaVendas,
        receitaBrutaServicos: dre.receitaBrutaServicos,
        deducoesReceita:      dre.deducoesReceita,
        receitaLiquida:       dre.receitaLiquida,
        custoMercadorias:     dre.custoMercadorias,
        custoServicos:        dre.custoServicos,
        lucroBruto:           dre.lucroBruto,
        despesasVendas:       dre.despesasVendas,
        despesasAdm:          dre.despesasAdm,
        despesasGerais:       dre.despesasGerais,
        ebitda:               dre.ebitda,
        receitasFinanceiras:  dre.receitasFinanceiras,
        despesasFinanceiras:  dre.despesasFinanceiras,
        resultadoFinanceiro:  dre.resultadoFinanceiro,
        lair:                 dre.lair,
        irpj:                 dre.irpj,
        csll:                 dre.csll,
        lucroLiquido:         dre.lucroLiquido,
        calculadoEm:          new Date(),
      },
    });

    return dre;
  }

  // --------------------------------------------------------------------------
  // Find snapshot or recalculate
  // --------------------------------------------------------------------------
  async findOrCalc(companyId: string, periodo: string): Promise<DreResultado> {
    const snap = await this.prisma.dreApuracao.findUnique({
      where: { companyId_periodoReferencia_tipo: { companyId, periodoReferencia: periodo, tipo: 'MENSAL' } },
    });

    if (snap) {
      return {
        companyId,
        periodoReferencia: periodo,
        tipo: snap.tipo,
        receitaBrutaVendas:   toNum(snap.receitaBrutaVendas),
        receitaBrutaServicos: toNum(snap.receitaBrutaServicos),
        deducoesReceita:      toNum(snap.deducoesReceita),
        receitaLiquida:       toNum(snap.receitaLiquida),
        custoMercadorias:     toNum(snap.custoMercadorias),
        custoServicos:        toNum(snap.custoServicos),
        lucroBruto:           toNum(snap.lucroBruto),
        despesasVendas:       toNum(snap.despesasVendas),
        despesasAdm:          toNum(snap.despesasAdm),
        despesasGerais:       toNum(snap.despesasGerais),
        ebitda:               toNum(snap.ebitda),
        receitasFinanceiras:  toNum(snap.receitasFinanceiras),
        despesasFinanceiras:  toNum(snap.despesasFinanceiras),
        resultadoFinanceiro:  toNum(snap.resultadoFinanceiro),
        lair:                 toNum(snap.lair),
        irpj:                 toNum(snap.irpj),
        csll:                 toNum(snap.csll),
        lucroLiquido:         toNum(snap.lucroLiquido),
        calculadoEm:          snap.calculadoEm,
        fromSnapshot:         true,
      };
    }

    return this.calcular(companyId, periodo);
  }

  // --------------------------------------------------------------------------
  // Historical DRE (last N months)
  // --------------------------------------------------------------------------
  async historico(companyId: string, meses = 12): Promise<DreResultado[]> {
    const result: DreResultado[] = [];
    const now = new Date();

    for (let i = meses - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const periodo = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      try {
        const dre = await this.findOrCalc(companyId, periodo);
        result.push(dre);
      } catch {
        // Empty period — push zeros
        result.push(zeroDre(companyId, periodo));
      }
    }

    return result;
  }

  // --------------------------------------------------------------------------
  // Comparative (array of periods)
  // --------------------------------------------------------------------------
  async comparativo(companyId: string, periodos: string[]): Promise<DreResultado[]> {
    return Promise.all(periodos.map((p) => this.findOrCalc(companyId, p)));
  }
}

// --------------------------------------------------------------------------
// Utility
// --------------------------------------------------------------------------
function toNum(v: any): number {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'object' && typeof v.toNumber === 'function') return v.toNumber();
  return Number(v) || 0;
}

function round(v: number): number {
  return Math.round(v * 100) / 100;
}

function zeroDre(companyId: string, periodo: string): DreResultado {
  return {
    companyId, periodoReferencia: periodo, tipo: 'MENSAL',
    receitaBrutaVendas: 0, receitaBrutaServicos: 0, deducoesReceita: 0, receitaLiquida: 0,
    custoMercadorias: 0, custoServicos: 0, lucroBruto: 0,
    despesasVendas: 0, despesasAdm: 0, despesasGerais: 0, ebitda: 0,
    receitasFinanceiras: 0, despesasFinanceiras: 0, resultadoFinanceiro: 0,
    lair: 0, irpj: 0, csll: 0, lucroLiquido: 0,
    calculadoEm: new Date(), fromSnapshot: false,
  };
}
