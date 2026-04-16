import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';
import { ClassificadorService, ContextoOperacao, ClassificacaoFiscal } from './classificador.service';
import { ValidadorService } from './validador.service';
import { ExcoesQueueService } from './excecoes-queue.service';

const CONFIDENCE_THRESHOLD = 92;

export interface ResultadoClassificacao {
  decisionId: string;
  classificacao: ClassificacaoFiscal;
  autoAplicado: boolean;
  excecaoId: string | null;
  validacao: { valido: boolean; erros: string[]; avisos: string[] };
}

@Injectable()
export class FiscalBrainService {
  private readonly logger = new Logger(FiscalBrainService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly classificador: ClassificadorService,
    private readonly validador: ValidadorService,
    private readonly excecoes: ExcoesQueueService,
  ) {}

  /**
   * Ponto de entrada principal.
   * Classifica um documento, valida, persiste e decide se aplica automaticamente
   * ou envia para a fila de exceções.
   */
  async classificarDocumento(params: {
    companyId: string;
    documentType: string;
    documentId: string;
    contexto: ContextoOperacao;
  }): Promise<ResultadoClassificacao> {
    const { companyId, documentType, documentId, contexto } = params;

    // Verifica se já existe decisão para este documento
    const existente = await this.prisma.fiscalBrainDecision.findFirst({
      where: { companyId, documentId, documentType },
      orderBy: { createdAt: 'desc' },
    });
    if (existente) {
      this.logger.log(`Reclassificando ${documentType}#${documentId} (decisão anterior: ${existente.id})`);
    }

    // 1. Busca histórico similar para contexto
    const similares = await this.buscarSimilares(companyId, contexto);

    // 2. Classifica com IA
    const classificacao = await this.classificador.classificar({
      ...contexto,
      operacoesSimilares: similares,
    });

    // 3. Valida a classificação
    const validacao = this.validador.validar(classificacao, contexto);

    // Reduz confiança se houver erros de validação
    const confiancaEfetiva = validacao.erros.length > 0
      ? Math.min(classificacao.confianca, 75)
      : classificacao.confianca;

    const autoAplicado = confiancaEfetiva >= CONFIDENCE_THRESHOLD && validacao.erros.length === 0;

    // 4. Persiste a decisão
    const decision = await this.prisma.fiscalBrainDecision.create({
      data: {
        companyId,
        documentType,
        documentId,
        contexto: contexto as any,
        cfop:            classificacao.cfop,
        cstIcms:         classificacao.cstIcms,
        cstPis:          classificacao.cstPis,
        cstCofins:       classificacao.cstCofins,
        aliquotaIcms:    classificacao.aliquotaIcms,
        aliquotaPis:     classificacao.aliquotaPis,
        aliquotaCofins:  classificacao.aliquotaCofins,
        aliquotaIpi:     classificacao.aliquotaIpi,
        beneficioFiscal: classificacao.beneficioFiscal,
        fundamentoLegal: classificacao.fundamentoLegal as any,
        raciocinio:      classificacao.raciocinio,
        alternativas:    classificacao.alternativas as any,
        alertas:         [...classificacao.alertas, ...validacao.avisos] as any,
        confianca:       confiancaEfetiva,
        autoAplicado,
      },
    });

    // 5. Se não passou no threshold, cria exceção
    let excecaoId: string | null = null;
    if (!autoAplicado) {
      excecaoId = await this.excecoes.criar({
        companyId,
        decisionId:   decision.id,
        documentType,
        documentId,
        confianca:    confiancaEfetiva,
        errosValidacao: validacao.erros,
      });
    }

    this.logger.log(
      `[FiscalBrain] ${documentType}#${documentId} — CFOP ${classificacao.cfop} | ` +
      `CST ${classificacao.cstIcms} | conf.${confiancaEfetiva}% | ` +
      (autoAplicado ? '✓ auto' : `⚠ exceção ${excecaoId}`),
    );

    return { decisionId: decision.id, classificacao, autoAplicado, excecaoId, validacao };
  }

  /** Busca decisões similares passadas para enriquecer o contexto. */
  private async buscarSimilares(companyId: string, ctx: ContextoOperacao) {
    const decisoes = await this.prisma.fiscalBrainDecision.findMany({
      where: {
        companyId,
        autoAplicado: true,
        confianca: { gte: 90 },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: { cfop: true, contexto: true, confianca: true },
    });

    // Filtra operações com mesmo tipo e UF de destino similares
    return decisoes
      .filter((d) => {
        const c = d.contexto as any;
        return (
          c?.tipoOperacao === ctx.tipoOperacao &&
          c?.ufDestinatario === ctx.ufDestinatario
        );
      })
      .slice(0, 5)
      .map((d) => ({
        cfop: d.cfop ?? '',
        natureza: (d.contexto as any)?.naturezaOperacao ?? '',
        confianca: d.confianca,
      }));
  }
}
