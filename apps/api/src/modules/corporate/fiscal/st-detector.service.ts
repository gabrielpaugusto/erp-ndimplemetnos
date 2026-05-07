import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';

// ─── Tipos públicos ───────────────────────────────────────────────────────────

export interface STDetectorInput {
  /** NCM de 8 dígitos (ex.: "87089990") ou com pontos ("8708.99.90") */
  ncm: string;
  /** Descrição do produto — usada para dupla condição NCM+descrição (CAT 12/2009) */
  descricaoProduto: string;
  /** UF do emitente (ex.: "SP") */
  ufOrigem: string;
  /** UF do destinatário */
  ufDestino: string;
  /** Data de emissão — usada para verificar vigência do protocolo */
  dataEmissao: Date;
  /** Destinatário tem Inscrição Estadual válida (não ISENTO)? */
  isContribuinte: boolean;
  /** Destinatário é pessoa física? */
  isPessoaFisica: boolean;
  /**
   * Finalidade da operação para o destinatário.
   * REVENDA           → ST incide se houver protocolo ativo (Art. 264 contrário)
   * INDUSTRIALIZACAO  → Art. 264 I afasta ST; exige declaração escrita do comprador
   * USO_CONSUMO       → Art. 264 afasta ST
   * ATIVO_IMOBILIZADO → Art. 264 afasta ST
   */
  finalidade: 'REVENDA' | 'INDUSTRIALIZACAO' | 'USO_CONSUMO' | 'ATIVO_IMOBILIZADO';
  /** Valor do item na NF-e (sem IPI e sem frete) */
  valorItem: number;
  /** IPI do item — entra na BC-ST para fabricante industrial */
  ipi?: number;
  /** Frete proporcional ao item */
  frete?: number;
  /** Seguro proporcional ao item */
  seguro?: number;
  /** Empresa emitente é estabelecimento industrial (fabricante)? */
  isIndustrial?: boolean;
  /** Usar MVA de fidelidade (fabricante de veículos com contrato)? */
  fidelidade?: boolean;
}

export interface STDetectorResult {
  /** A operação está sujeita ao ICMS-ST? */
  temST: boolean;
  /** Quando temST=false: motivo pelo qual a ST não se aplica */
  motivoSemST?: string;
  /** Dispositivo legal aplicado */
  fundamentoLegal: string;
  /** Número do protocolo/convênio (ex.: "Protocolo ICMS 41/2008") */
  protocolo?: string;
  /** CEST do produto (7 dígitos sem pontos) */
  cest?: string;
  /** MVA original conforme protocolo (%) */
  mvaOriginal?: number;
  /** MVA ajustado para operação interestadual (%) */
  mvaAjustado?: number;
  /** MVA efetivamente aplicado no cálculo (ajustado se interestadual, original se interno) */
  mvaAplicado?: number;
  /** Alíquota interestadual do emitente (%) */
  aliquotaInterestadual?: number;
  /** Alíquota interna do estado de destino (%) */
  aliquotaInternaDestino?: number;
  /** Base de cálculo da ST */
  bcST?: number;
  /** ICMS-ST a recolher = (BC-ST × aliq_interna_destino) - ICMS_próprio */
  icmsST?: number;
  /** ICMS da operação própria deduzido no cálculo de ICMS-ST */
  icmsProprio?: number;
  /** CFOP sugerido para a NF-e */
  cfopSugerido: string;
  /** CST ICMS sugerido */
  cstSugerido: string;
  /** Se true: exige declaração escrita do comprador (Art. 264 I) */
  exigeDeclaracaoComprador: boolean;
  /** Texto sugerido para campo <infCpl> da NF-e quando não há ST por Art. 264 */
  infCplSugerido?: string;
  /** Quando operação interestadual com ST: guia GNRE necessária? */
  exigeGnre?: boolean;
  /** Alertas fiscais para o usuário */
  alertas: string[];
}

// ─── Tabelas de alíquotas ─────────────────────────────────────────────────────

/**
 * Alíquota interna de ICMS por UF para autopeças e implementos.
 * Fonte: legislações estaduais — verificar atualizações periódicas.
 */
const ALIQ_INTERNA_UF: Record<string, number> = {
  AC: 17,   AL: 18,   AP: 18,   AM: 18,   BA: 20.5,
  CE: 18,   DF: 18,   ES: 17,   GO: 17,   MA: 18,
  MT: 17,   MS: 17,   MG: 18,   PA: 17,   PB: 18,
  PR: 18,   PE: 18,   PI: 18,   RJ: 20,   RN: 18,
  RS: 18,   RO: 17.5, RR: 17,   SC: 17,   SP: 18,
  SE: 18,   TO: 18,
};

/**
 * UFs que recebem alíquota interestadual de 7% (regiões Norte, Nordeste,
 * Centro-Oeste + Espírito Santo). As demais recebem 12%.
 * Fonte: Resolução Senado Federal 22/1989.
 */
const UF_ALIQ_7_PERCENT = new Set([
  'AC','AL','AP','AM','BA','CE','GO','MA','MT','MS',
  'PA','PB','PI','RN','RO','RR','SE','TO','ES',
]);

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class STDetectorService {
  private readonly logger = new Logger(STDetectorService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Detecta se uma operação está sujeita ao ICMS-ST e calcula os valores.
   *
   * Lógica (em ordem):
   * 1. Exceções Art. 264 RICMS-SP: PF, não-contribuinte, industrialização,
   *    uso/consumo, ativo — afastam a ST imediatamente.
   * 2. Se REVENDA + contribuinte: consulta StProtocoloConfaz.
   * 3. Se protocolo encontrado: calcula MVA ajustado, BC-ST e ICMS-ST.
   * 4. Retorna CFOP, CST, CEST e alertas.
   */
  async detectar(input: STDetectorInput): Promise<STDetectorResult> {
    const {
      ncm, descricaoProduto, ufOrigem, ufDestino, dataEmissao,
      isContribuinte, isPessoaFisica, finalidade,
      valorItem, ipi = 0, frete = 0, seguro = 0,
      isIndustrial = true, fidelidade = false,
    } = input;

    const interestadual = ufOrigem.toUpperCase() !== ufDestino.toUpperCase();
    const ncmLimpo = ncm.replace(/[.\-]/g, ''); // "8708.99.90" → "87089990"

    // ── ETAPA 1: Exceções Art. 264 ──────────────────────────────────────────

    if (isPessoaFisica) {
      return this.semST(
        input,
        'Destinatário é pessoa física — ST não se aplica. Verificar incidência de DIFAL (EC 87/2015 + LC 190/2022).',
        'Art. 264 RICMS-SP + EC 87/2015',
        false,
        interestadual,
      );
    }

    if (!isContribuinte) {
      return this.semST(
        input,
        'Destinatário PJ não-contribuinte do ICMS — ST não se aplica. Verificar incidência de DIFAL.',
        'Art. 264 RICMS-SP + EC 87/2015',
        false,
        interestadual,
      );
    }

    if (finalidade === 'INDUSTRIALIZACAO') {
      return this.semST(
        input,
        'Destinatário utilizará o produto em processo de industrialização — Art. 264, I, RICMS-SP afasta a ST. OBRIGATÓRIO: exigir declaração escrita do comprador e incluir no campo <infCpl> da NF-e o texto de não-retenção.',
        'Art. 264, inciso I, RICMS-SP (Decreto 45.490/2000)',
        true, // exigeDeclaracaoComprador
        interestadual,
      );
    }

    if (finalidade === 'USO_CONSUMO') {
      return this.semST(
        input,
        'Destinatário adquire para uso/consumo próprio — Art. 264 RICMS-SP afasta a ST. Não há operação subsequente de venda.',
        'Art. 264 RICMS-SP (Decreto 45.490/2000)',
        false,
        interestadual,
      );
    }

    if (finalidade === 'ATIVO_IMOBILIZADO') {
      return this.semST(
        input,
        'Destinatário incorporará ao ativo imobilizado — Art. 264 RICMS-SP afasta a ST.',
        'Art. 264 RICMS-SP (Decreto 45.490/2000)',
        false,
        interestadual,
      );
    }

    // ── ETAPA 2: Finalidade = REVENDA — consultar protocolo ─────────────────

    const protocolo = await this.buscarProtocolo(
      ufOrigem, ufDestino, ncmLimpo, dataEmissao, fidelidade,
    );

    if (!protocolo) {
      const motivo = interestadual
        ? `Sem protocolo/convênio ICMS ativo entre ${ufOrigem} e ${ufDestino} para NCM ${ncm} — Art. 264, V, RICMS-SP afasta a ST interestadual.`
        : `NCM ${ncm} não consta na portaria de ST interna SP como sujeito ao regime — tributação normal.`;
      return this.semST(input, motivo, 'Art. 264, V, RICMS-SP', false, interestadual);
    }

    // ── ETAPA 3: Protocolo encontrado — calcular ST ──────────────────────────

    const aliqIntra = ALIQ_INTERNA_UF[ufDestino.toUpperCase()] ?? 18;
    const aliqInter = interestadual
      ? (UF_ALIQ_7_PERCENT.has(ufDestino.toUpperCase()) ? 7 : 12)
      : aliqIntra; // operação interna usa alíquota interna

    // MVA: usar o pré-calculado do DB quando disponível, senão recalcular
    const mvaOriginal = Number(protocolo.mvaOriginal);
    let mvaAplicado: number;

    if (interestadual) {
      const mvaAjDb = protocolo.mvaAjustado ? Number(protocolo.mvaAjustado) : null;
      mvaAplicado = mvaAjDb ?? this.calcularMvaAjustado(mvaOriginal, aliqInter, aliqIntra);
    } else {
      mvaAplicado = mvaOriginal;
    }

    // BC-ST = (valor + IPI + frete + seguro) × (1 + MVA/100)
    const subtotalBcST = valorItem + ipi + frete + seguro;
    const bcST = this.round(subtotalBcST * (1 + mvaAplicado / 100));

    // ICMS próprio = valor × alíquota interestadual (ou interna, se mesmo estado)
    const icmsProprio = this.round(valorItem * aliqInter / 100);

    // ICMS-ST = BC-ST × aliq_interna_destino% − ICMS_próprio
    const icmsST = Math.max(0, this.round(bcST * aliqIntra / 100 - icmsProprio));

    // CFOP: substituto (tem ST)
    // 5.401 = saída interna com ST (produção própria)
    // 6.401 = saída interestadual com ST (produção própria)
    // 5.403 = saída interna com ST (mercadoria de terceiros)
    // 6.403 = saída interestadual com ST (mercadoria de terceiros)
    const cfopSugerido = isIndustrial
      ? (interestadual ? '6401' : '5401')
      : (interestadual ? '6403' : '5403');

    const alertas: string[] = [];

    if (interestadual) {
      alertas.push(`GNRE obrigatória: recolher ICMS-ST de R$ ${icmsST.toFixed(2)} para ${ufDestino} via GNRE por NF-e (${protocolo.protocolo}).`);
    }
    if (!protocolo.cest) {
      alertas.push(`CEST não encontrado para NCM ${ncm} — verificar Convênio ICMS 142/2018 e preencher manualmente.`);
    }
    alertas.push(
      `Verificar dupla condição (CAT 12/2009): confirmar que a descrição "${descricaoProduto}" corresponde ao item listado na portaria de ST para NCM ${ncm}.`,
    );

    this.logger.log(
      `[STDetector] NCM ${ncm} ${ufOrigem}→${ufDestino} | ` +
      `MVA ${mvaAplicado}% | BC-ST R$${bcST} | ICMS-ST R$${icmsST} | ` +
      `CFOP ${cfopSugerido} | CEST ${protocolo.cest ?? 'N/A'}`,
    );

    return {
      temST:                  true,
      fundamentoLegal:        protocolo.protocolo,
      protocolo:              protocolo.protocolo,
      cest:                   protocolo.cest ?? undefined,
      mvaOriginal,
      mvaAjustado:            interestadual ? this.calcularMvaAjustado(mvaOriginal, aliqInter, aliqIntra) : undefined,
      mvaAplicado,
      aliquotaInterestadual:  interestadual ? aliqInter : undefined,
      aliquotaInternaDestino: aliqIntra,
      bcST,
      icmsST,
      icmsProprio,
      cfopSugerido,
      cstSugerido:            '10',       // Tributado + ST (caso padrão)
      exigeDeclaracaoComprador: false,
      exigeGnre:              interestadual,
      alertas,
    };
  }

  // ── Helpers públicos ──────────────────────────────────────────────────────

  /**
   * Calcula o MVA ajustado para operações interestaduais.
   * Fórmula: [(1 + MVA_orig/100) × (1 − aliq_inter/100) / (1 − aliq_intra/100)] − 1
   * Resultado em porcentagem (ex.: 84.35).
   */
  calcularMvaAjustado(mvaOriginal: number, aliqInter: number, aliqIntra: number): number {
    const resultado = (1 + mvaOriginal / 100) * (1 - aliqInter / 100) / (1 - aliqIntra / 100) - 1;
    return this.round(resultado * 100);
  }

  /**
   * Retorna a alíquota interestadual aplicável para um par UF origem/destino.
   * 7% para N/NE/CO/ES | 12% para S/SE (exceto ES) | 4% para produtos importados.
   */
  aliquotaInterestadual(ufDestino: string, produtoImportado = false): number {
    if (produtoImportado) return 4; // Res. Senado 13/2012
    return UF_ALIQ_7_PERCENT.has(ufDestino.toUpperCase()) ? 7 : 12;
  }

  /**
   * Retorna a alíquota interna de ICMS do estado de destino.
   * Usa a tabela embutida — verificar atualizações na SEFAZ do estado.
   */
  aliquotaInternaDestino(ufDestino: string): number {
    return ALIQ_INTERNA_UF[ufDestino.toUpperCase()] ?? 18;
  }

  // ── Helpers privados ──────────────────────────────────────────────────────

  private async buscarProtocolo(
    ufOrigem: string,
    ufDestino: string,
    ncmLimpo: string,
    dataEmissao: Date,
    fidelidade: boolean,
  ) {
    // Tenta matching por: NCM completo (8 dígitos) → prefixo 4 dígitos → prefixo 2 dígitos
    // A coluna ncm do banco pode ter "8708", "87089990", "8716.90.90" etc.
    const ncmCandidates = [
      ncmLimpo,                          // "87089990"
      ncmLimpo.substring(0, 4),          // "8708"
      ncmLimpo.substring(0, 2),          // "87"
      // Versão com pontos (legacy)
      `${ncmLimpo.substring(0, 4)}.${ncmLimpo.substring(4, 6)}.${ncmLimpo.substring(6, 8)}`,
    ];

    const protocoloSuffix = fidelidade ? '-FIDELIDADE' : '';

    return this.prisma.stProtocoloConfaz.findFirst({
      where: {
        ufOrigem:  ufOrigem.toUpperCase(),
        ufDestino: ufDestino.toUpperCase(),
        ativo:     true,
        ncm: {
          in: fidelidade
            ? ncmCandidates.map(n => `${n}${protocoloSuffix}`)
            : ncmCandidates,
        },
        vigenciaInicio: { lte: dataEmissao },
        OR: [
          { vigenciaFim: null },
          { vigenciaFim: { gte: dataEmissao } },
        ],
      },
      orderBy: { ncm: 'desc' }, // mais específico primeiro
    });
  }

  /** Monta resultado de "sem ST" com CFOP e CST corretos */
  private semST(
    input: STDetectorInput,
    motivo: string,
    fundamentoLegal: string,
    exigeDeclaracaoComprador: boolean,
    interestadual: boolean,
  ): STDetectorResult {
    const { isIndustrial = true, ufOrigem, ufDestino, finalidade } = input;

    // CFOP sem ST:
    // 5.101 / 6.101 = venda produção própria (fabricante)
    // 5.102 / 6.102 = venda mercadoria de terceiros
    const cfopSugerido = isIndustrial
      ? (interestadual ? '6101' : '5101')
      : (interestadual ? '6102' : '5102');

    const alertas: string[] = [];

    if (finalidade === 'INDUSTRIALIZACAO') {
      alertas.push(
        `Art. 264, I, RICMS-SP: exigir declaração escrita do comprador confirmando uso em industrialização. ` +
        `Incluir no <infCpl> da NF-e: "Operação não sujeita à ST — Art. 264, I, RICMS/SP — ` +
        `Mercadoria destinada à integração em processo de industrialização."`,
      );
    }

    if ((input.isPessoaFisica || !input.isContribuinte) && interestadual) {
      alertas.push(
        `Operação interestadual para não-contribuinte/PF: verificar incidência de DIFAL ` +
        `(EC 87/2015 + LC 190/2022 — alíquota interna ${ufDestino} menos alíquota interestadual).`,
      );
    }

    const infCplMap: Record<string, string> = {
      INDUSTRIALIZACAO:
        `Operação não sujeita à substituição tributária — Art. 264, inciso I, do RICMS/SP ` +
        `(Decreto 45.490/2000) — Mercadoria destinada à integração em processo de industrialização pelo destinatário.`,
      USO_CONSUMO:
        `Operação não sujeita à substituição tributária — Art. 264, RICMS/SP — ` +
        `Mercadoria destinada ao uso e consumo do destinatário.`,
      ATIVO_IMOBILIZADO:
        `Operação não sujeita à substituição tributária — Art. 264, RICMS/SP — ` +
        `Mercadoria destinada ao ativo imobilizado do destinatário.`,
    };

    return {
      temST:                    false,
      motivoSemST:              motivo,
      fundamentoLegal,
      cfopSugerido,
      cstSugerido:              '00',
      exigeDeclaracaoComprador,
      infCplSugerido:           infCplMap[input.finalidade],
      exigeGnre:                false,
      alertas,
    };
  }

  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
