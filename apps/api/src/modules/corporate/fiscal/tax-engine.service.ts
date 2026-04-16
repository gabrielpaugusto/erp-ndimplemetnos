import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';

interface TaxItem {
  productId?: string;
  description: string;
  ncmCode: string;
  cfopCode: string;
  quantity: number;
  unitPrice: number;
  unit: string;
}

interface TaxResult {
  // ICMS
  cstIcms: string;
  bcIcms: number;
  aliqIcms: number;
  valorIcms: number;
  // ICMS-ST
  bcIcmsSt: number;
  aliqIcmsSt: number;
  valorIcmsSt: number;
  // IPI
  cstIpi: string;
  bcIpi: number;
  aliqIpi: number;
  valorIpi: number;
  // PIS
  cstPis: string;
  bcPis: number;
  aliqPis: number;
  valorPis: number;
  // COFINS
  cstCofins: string;
  bcCofins: number;
  aliqCofins: number;
  valorCofins: number;
  // IBS (Reforma Tributaria)
  bcIbs: number;
  aliqIbs: number;
  valorIbs: number;
  // CBS (Reforma Tributaria)
  bcCbs: number;
  aliqCbs: number;
  valorCbs: number;
  // IS (Imposto Seletivo)
  bcIs: number;
  aliqIs: number;
  valorIs: number;
}

interface TransitionConfig {
  anoReferencia: number;
  percentualIcms: number;
  percentualIbs: number;
  percentualPisCofins: number;
  percentualCbs: number;
  cbsAtiva: boolean;
  ibsAtiva: boolean;
  isAtivo: boolean;
  pisCofinsAtiva: boolean;
  icmsAtivo: boolean;
  ipiAtivo: boolean;
}

// Default transition proportions per year (2026-2033)
const DEFAULT_TRANSITION: Record<number, { oldPct: number; newPct: number }> = {
  2026: { oldPct: 90, newPct: 10 },
  2027: { oldPct: 80, newPct: 20 },
  2028: { oldPct: 70, newPct: 30 },
  2029: { oldPct: 60, newPct: 40 },
  2030: { oldPct: 50, newPct: 50 },
  2031: { oldPct: 40, newPct: 60 },
  2032: { oldPct: 20, newPct: 80 },
  2033: { oldPct: 0, newPct: 100 },
};

@Injectable()
export class TaxEngineService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Main tax calculation method — Strategy Pattern entry point.
   * For each item: lookup TaxRule by NCM+CFOP+operation (highest priority wins), apply rates.
   */
  async calculateTax(
    companyId: string,
    items: TaxItem[],
    operation: string,
    cfop: string,
    date: Date,
  ): Promise<TaxResult[]> {
    const year = date.getFullYear();
    const transitionConfig = await this.getTaxRegimeConfig(companyId, year);

    const results: TaxResult[] = [];

    for (const item of items) {
      // TaxRule removed — FiscalBrain handles fiscal classification; rule is always null
      const rule: any = null;

      const totalPrice = item.quantity * item.unitPrice;

      // Calculate current system taxes
      const currentTaxes = {
        icms: this.calculateIcms(totalPrice, rule),
        ipi: this.calculateIpi(totalPrice, rule),
        pisCofins: this.calculatePisCofins(totalPrice, rule),
      };

      // Calculate new system taxes (Reforma Tributaria)
      const newTaxes = this.calculateIbsCbs(totalPrice, rule);
      const isTaxes = this.calculateIs(totalPrice, rule);

      // Apply transition blending
      const blended = this.applyTransition(currentTaxes, newTaxes, transitionConfig);

      results.push({
        // ICMS (TaxRule removed — FiscalBrain handles; use system defaults)
        cstIcms: '00',
        bcIcms: blended.bcIcms,
        aliqIcms: blended.aliqIcms,
        valorIcms: blended.valorIcms,
        // ICMS-ST (no transition blending — direct)
        bcIcmsSt: 0,
        aliqIcmsSt: 0,
        valorIcmsSt: 0,
        // IPI
        cstIpi: '50',
        bcIpi: blended.bcIpi,
        aliqIpi: blended.aliqIpi,
        valorIpi: blended.valorIpi,
        // PIS
        cstPis: '01',
        bcPis: blended.bcPis,
        aliqPis: blended.aliqPis,
        valorPis: blended.valorPis,
        // COFINS
        cstCofins: '01',
        bcCofins: blended.bcCofins,
        aliqCofins: blended.aliqCofins,
        valorCofins: blended.valorCofins,
        // IBS
        bcIbs: blended.bcIbs,
        aliqIbs: blended.aliqIbs,
        valorIbs: blended.valorIbs,
        // CBS
        bcCbs: blended.bcCbs,
        aliqCbs: blended.aliqCbs,
        valorCbs: blended.valorCbs,
        // IS
        bcIs: isTaxes.bcIs,
        aliqIs: isTaxes.aliqIs,
        valorIs: isTaxes.valorIs,
      });
    }

    return results;
  }

  /**
   * Get transition proportions from TaxRegimeConfig table for a given company/year.
   */
  async getTaxRegimeConfig(
    companyId: string,
    year: number,
  ): Promise<TransitionConfig> {
    const config = await this.prisma.taxRegimeConfig.findFirst({
      where: {
        companyId,
        anoReferencia: year,
      },
      orderBy: { vigenciaInicio: 'desc' },
    });

    if (config) {
      return {
        anoReferencia: config.anoReferencia || year,
        percentualIcms: Number(config.percentualIcms ?? 100),
        percentualIbs: Number(config.percentualIbs ?? 0),
        percentualPisCofins: Number(config.percentualPisCofins ?? 100),
        percentualCbs: Number(config.percentualCbs ?? 0),
        cbsAtiva: config.cbsAtiva,
        ibsAtiva: config.ibsAtiva,
        isAtivo: config.isAtivo,
        pisCofinsAtiva: config.pisCofinsAtiva,
        icmsAtivo: config.icmsAtivo,
        ipiAtivo: config.ipiAtivo,
      };
    }

    // Fallback to default transition schedule
    const transition = DEFAULT_TRANSITION[year];
    if (transition) {
      return {
        anoReferencia: year,
        percentualIcms: transition.oldPct,
        percentualIbs: transition.newPct,
        percentualPisCofins: transition.oldPct,
        percentualCbs: transition.newPct,
        cbsAtiva: transition.newPct > 0,
        ibsAtiva: transition.newPct > 0,
        isAtivo: transition.newPct > 0,
        pisCofinsAtiva: transition.oldPct > 0,
        icmsAtivo: transition.oldPct > 0,
        ipiAtivo: transition.oldPct > 0,
      };
    }

    // Before 2026 — 100% current system
    if (year < 2026) {
      return {
        anoReferencia: year,
        percentualIcms: 100,
        percentualIbs: 0,
        percentualPisCofins: 100,
        percentualCbs: 0,
        cbsAtiva: false,
        ibsAtiva: false,
        isAtivo: false,
        pisCofinsAtiva: true,
        icmsAtivo: true,
        ipiAtivo: true,
      };
    }

    // After 2033 — 100% new system
    return {
      anoReferencia: year,
      percentualIcms: 0,
      percentualIbs: 100,
      percentualPisCofins: 0,
      percentualCbs: 100,
      cbsAtiva: true,
      ibsAtiva: true,
      isAtivo: true,
      pisCofinsAtiva: false,
      icmsAtivo: false,
      ipiAtivo: false,
    };
  }

  /**
   * Blend old/new taxes based on transition year proportion.
   * E.g. 2026: 90% old + 10% new IBS/CBS
   */
  applyTransition(
    currentTaxes: {
      icms: { bc: number; aliq: number; valor: number };
      ipi: { bc: number; aliq: number; valor: number };
      pisCofins: {
        bcPis: number;
        aliqPis: number;
        valorPis: number;
        bcCofins: number;
        aliqCofins: number;
        valorCofins: number;
      };
    },
    newTaxes: {
      bcIbs: number;
      aliqIbs: number;
      valorIbs: number;
      bcCbs: number;
      aliqCbs: number;
      valorCbs: number;
    },
    config: TransitionConfig,
  ) {
    const oldPct = config.percentualIcms / 100;
    const newPctIbs = config.percentualIbs / 100;
    const oldPctPisCofins = config.percentualPisCofins / 100;
    const newPctCbs = config.percentualCbs / 100;

    return {
      // ICMS blended
      bcIcms: currentTaxes.icms.bc,
      aliqIcms: this.round(currentTaxes.icms.aliq * oldPct),
      valorIcms: this.round(currentTaxes.icms.valor * oldPct),
      // IPI (same proportion as ICMS during transition)
      bcIpi: currentTaxes.ipi.bc,
      aliqIpi: config.ipiAtivo ? currentTaxes.ipi.aliq : 0,
      valorIpi: config.ipiAtivo ? currentTaxes.ipi.valor : 0,
      // PIS blended
      bcPis: currentTaxes.pisCofins.bcPis,
      aliqPis: this.round(currentTaxes.pisCofins.aliqPis * oldPctPisCofins),
      valorPis: this.round(currentTaxes.pisCofins.valorPis * oldPctPisCofins),
      // COFINS blended
      bcCofins: currentTaxes.pisCofins.bcCofins,
      aliqCofins: this.round(currentTaxes.pisCofins.aliqCofins * oldPctPisCofins),
      valorCofins: this.round(currentTaxes.pisCofins.valorCofins * oldPctPisCofins),
      // IBS blended
      bcIbs: newTaxes.bcIbs,
      aliqIbs: this.round(newTaxes.aliqIbs * newPctIbs),
      valorIbs: this.round(newTaxes.valorIbs * newPctIbs),
      // CBS blended
      bcCbs: newTaxes.bcCbs,
      aliqCbs: this.round(newTaxes.aliqCbs * newPctCbs),
      valorCbs: this.round(newTaxes.valorCbs * newPctCbs),
    };
  }

  /**
   * Calculate ICMS based on rule.
   */
  calculateIcms(
    totalPrice: number,
    rule: any,
  ): { bc: number; aliq: number; valor: number } {
    const aliq = rule?.aliqIcms ?? 18; // Default ICMS rate
    const reducao = rule?.reducaoBcIcms ?? 0;
    const bc = this.round(totalPrice * (1 - reducao / 100));
    const valor = this.round(bc * aliq / 100);

    return { bc, aliq, valor };
  }

  /**
   * Calculate IPI based on rule.
   */
  calculateIpi(
    totalPrice: number,
    rule: any,
  ): { bc: number; aliq: number; valor: number } {
    const aliq = rule?.aliqIpi ?? 0;
    const bc = totalPrice;
    const valor = this.round(bc * aliq / 100);

    return { bc, aliq, valor };
  }

  /**
   * Calculate PIS and COFINS (Lucro Real — non-cumulative).
   */
  calculatePisCofins(
    totalPrice: number,
    rule: any,
  ): {
    bcPis: number;
    aliqPis: number;
    valorPis: number;
    bcCofins: number;
    aliqCofins: number;
    valorCofins: number;
  } {
    // Lucro Real defaults: PIS 1.65%, COFINS 7.6%
    const aliqPis = rule?.aliqPis ?? 1.65;
    const aliqCofins = rule?.aliqCofins ?? 7.6;
    const bc = totalPrice;

    return {
      bcPis: bc,
      aliqPis,
      valorPis: this.round(bc * aliqPis / 100),
      bcCofins: bc,
      aliqCofins,
      valorCofins: this.round(bc * aliqCofins / 100),
    };
  }

  /**
   * Calculate IBS and CBS (Reforma Tributaria).
   */
  calculateIbsCbs(
    totalPrice: number,
    rule: any,
  ): {
    bcIbs: number;
    aliqIbs: number;
    valorIbs: number;
    bcCbs: number;
    aliqCbs: number;
    valorCbs: number;
  } {
    const aliqIbs = rule?.aliqIbs ?? 25.0; // Default combined IBS rate
    const aliqCbs = rule?.aliqCbs ?? 8.8; // Default CBS rate
    const bc = totalPrice;

    return {
      bcIbs: bc,
      aliqIbs,
      valorIbs: this.round(bc * aliqIbs / 100),
      bcCbs: bc,
      aliqCbs,
      valorCbs: this.round(bc * aliqCbs / 100),
    };
  }

  /**
   * Calculate Imposto Seletivo.
   */
  calculateIs(
    totalPrice: number,
    rule: any,
  ): { bcIs: number; aliqIs: number; valorIs: number } {
    const aliqIs = rule?.aliqIs ?? 0;
    const bc = totalPrice;

    return {
      bcIs: bc,
      aliqIs,
      valorIs: this.round(bc * aliqIs / 100),
    };
  }

  /**
   * Find the best matching TaxRule — TaxRule model removed (FiscalBrain now handles classification).
   * Returns null so the engine falls back to system defaults.
   */
  private async findBestRule(
    _companyId: string,
    _ncmCode: string,
    _cfopCode: string,
    _operation: string,
  ) {
    // TaxRule table removed — FiscalBrain AI engine handles fiscal classification automatically
    return null;
  }

  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
