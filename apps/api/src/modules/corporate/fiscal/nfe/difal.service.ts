import { Injectable } from '@nestjs/common';

/**
 * Serviço de DIFAL — Diferencial de Alíquota de ICMS
 *
 * Art. 155, §2º, VII da CF/88 (EC 87/2015):
 *   Operações interestaduais destinadas a consumidor final (contribuinte ou não):
 *   - DIFAL = Alíquota Interna (destino) - Alíquota Interestadual
 *
 * Partilha DIFAL (EC 87/2015, em vigor de 2016 a 2018; a partir de 2019: 100% destino):
 *   2016: 40% destino / 60% origem
 *   2017: 60% destino / 40% origem
 *   2018: 80% destino / 20% origem
 *   2019+: 100% destino
 *
 * FCP (Fundo de Combate à Pobreza): adicional sobre ICMS para alguns estados.
 *
 * Quem recolhe o DIFAL:
 *   - Destinatário contribuinte do ICMS: recolhe ele mesmo (GNRE/declaração)
 *   - Destinatário NÃO contribuinte: emitente recolhe GNRE no estado destino
 */

export interface DifalInput {
  valorBc: number;           // Base de cálculo (valor dos produtos + IPI, se aplicável)
  aliqInterestadual: number; // Alíquota interestadual (4%, 7% ou 12%)
  ufOrigem: string;          // UF do emitente
  ufDestino: string;         // UF do destinatário
  dataOperacao?: Date;       // Para calcular partilha correta por ano
}

export interface DifalResult {
  aliqInterestadual: number;
  aliqInternaDestino: number;
  aliqFcp: number;
  bcDifal: number;
  valorDifal: number;              // Total DIFAL
  valorDifalDestino: number;       // Parte devida ao estado destino
  valorDifalOrigem: number;        // Parte devida ao estado origem (0 a partir de 2019)
  valorFcp: number;                // FCP separado
  percentualPartilhaDestino: number;
  percentualPartilhaOrigem: number;
}

@Injectable()
export class DifalService {

  /**
   * Retorna a alíquota interna da UF destino.
   * AliquotaIcmsUf table removed — uses hardcoded standard rates per state.
   * Fonte: CONFAZ — alíquotas internas estaduais padrão.
   */
  async getAliquotaInterna(uf: string): Promise<{ aliquotaPadrao: number; aliquotaFcp: number }> {
    // Hardcoded standard ICMS rates per state (CONFAZ)
    const ALIQUOTAS_ICMS_UF: Record<string, { padrao: number; fcp: number }> = {
      AC: { padrao: 17, fcp: 0 },
      AL: { padrao: 18, fcp: 2 },
      AM: { padrao: 18, fcp: 0 },
      AP: { padrao: 18, fcp: 0 },
      BA: { padrao: 19, fcp: 2 },
      CE: { padrao: 18, fcp: 2 },
      DF: { padrao: 18, fcp: 0 },
      ES: { padrao: 17, fcp: 0 },
      GO: { padrao: 17, fcp: 0 },
      MA: { padrao: 18, fcp: 2 },
      MG: { padrao: 18, fcp: 2 },
      MS: { padrao: 17, fcp: 0 },
      MT: { padrao: 17, fcp: 0 },
      PA: { padrao: 19, fcp: 2 },
      PB: { padrao: 18, fcp: 2 },
      PE: { padrao: 18, fcp: 2 },
      PI: { padrao: 18, fcp: 2 },
      PR: { padrao: 19, fcp: 0 },
      RJ: { padrao: 20, fcp: 2 },
      RN: { padrao: 18, fcp: 2 },
      RO: { padrao: 17.5, fcp: 0 },
      RR: { padrao: 17, fcp: 0 },
      RS: { padrao: 17, fcp: 0 },
      SC: { padrao: 17, fcp: 0 },
      SE: { padrao: 18, fcp: 2 },
      SP: { padrao: 18, fcp: 2 },
      TO: { padrao: 18, fcp: 0 },
    };

    const rate = ALIQUOTAS_ICMS_UF[uf.toUpperCase()];
    return {
      aliquotaPadrao: rate?.padrao ?? 18,
      aliquotaFcp: rate?.fcp ?? 0,
    };
  }

  /**
   * Calcula o DIFAL completo para uma operação interestadual a consumidor final.
   */
  async calcularDifal(input: DifalInput): Promise<DifalResult> {
    const { valorBc, aliqInterestadual, ufOrigem, ufDestino, dataOperacao } = input;
    const ano = (dataOperacao ?? new Date()).getFullYear();

    const { aliquotaPadrao: aliqInterna, aliquotaFcp: aliqFcp } =
      await this.getAliquotaInterna(ufDestino);

    // DIFAL = BC × (AliqInterna - AliqInterestadual)
    const diferencialAliq = Math.max(aliqInterna - aliqInterestadual, 0);
    const valorDifal = this.round(valorBc * diferencialAliq / 100);

    // FCP calculado sobre o valor do DIFAL
    const valorFcp = this.round(valorBc * aliqFcp / 100);

    // Partilha por ano (EC 87/2015)
    const { pctDestino, pctOrigem } = this.getPartilha(ano);
    const valorDifalDestino = this.round(valorDifal * pctDestino / 100);
    const valorDifalOrigem = this.round(valorDifal * pctOrigem / 100);

    return {
      aliqInterestadual,
      aliqInternaDestino: aliqInterna,
      aliqFcp,
      bcDifal: valorBc,
      valorDifal,
      valorDifalDestino,
      valorDifalOrigem,
      valorFcp,
      percentualPartilhaDestino: pctDestino,
      percentualPartilhaOrigem: pctOrigem,
    };
  }

  /**
   * Determina se uma operação está sujeita a DIFAL.
   * Requisitos: interestadual + destinado a consumidor final (contribuinte ou não).
   */
  isSubjectToDifal(ufOrigem: string, ufDestino: string, consumidorFinal: boolean): boolean {
    if (!consumidorFinal) return false;           // Revenda → sem DIFAL
    if (!ufOrigem || !ufDestino) return false;
    return ufOrigem.toUpperCase() !== ufDestino.toUpperCase();
  }

  private getPartilha(ano: number): { pctDestino: number; pctOrigem: number } {
    if (ano <= 2015) return { pctDestino: 0, pctOrigem: 100 };
    if (ano === 2016) return { pctDestino: 40, pctOrigem: 60 };
    if (ano === 2017) return { pctDestino: 60, pctOrigem: 40 };
    if (ano === 2018) return { pctDestino: 80, pctOrigem: 20 };
    return { pctDestino: 100, pctOrigem: 0 }; // 2019+
  }

  private round(v: number): number {
    return Math.round(v * 100) / 100;
  }
}
