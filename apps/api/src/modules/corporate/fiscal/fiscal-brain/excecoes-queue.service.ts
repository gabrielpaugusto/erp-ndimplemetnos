import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';
import { ClassificacaoFiscal, ContextoOperacao } from './classificador.service';

@Injectable()
export class ExcoesQueueService {
  private readonly logger = new Logger(ExcoesQueueService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Cria uma exceção para revisão humana e retorna o ID. */
  async criar(params: {
    companyId: string;
    decisionId: string;
    documentType: string;
    documentId: string;
    confianca: number;
    errosValidacao: string[];
  }): Promise<string> {
    const motivo = this.buildMotivo(params.confianca, params.errosValidacao);
    const excecao = await this.prisma.excecaoFiscal.create({
      data: {
        companyId:    params.companyId,
        decisionId:   params.decisionId,
        documentType: params.documentType,
        documentId:   params.documentId,
        motivo,
        status:       'PENDENTE',
      },
    });
    this.logger.warn(`Exceção criada ${excecao.id} — doc ${params.documentType}#${params.documentId} (conf.${params.confianca}%)`);
    return excecao.id;
  }

  /** Lista exceções pendentes da empresa. */
  async listar(companyId: string, status?: string) {
    return this.prisma.excecaoFiscal.findMany({
      where: {
        companyId,
        ...(status ? { status: status as any } : {}),
      },
      include: {
        decision: {
          select: {
            cfop: true, cstIcms: true, cstPis: true, cstCofins: true,
            aliquotaIcms: true, aliquotaPis: true, aliquotaCofins: true,
            confianca: true, raciocinio: true, fundamentoLegal: true,
            alternativas: true, alertas: true, contexto: true,
            autoAplicado: true, createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /** Resolver uma exceção: humano aprova ou corrige a classificação. */
  async resolver(params: {
    excecaoId: string;
    companyId: string;
    userId: string;
    resolucao: Partial<ClassificacaoFiscal>;
    aceitar: boolean; // true = aceitar sugestão da IA sem mudanças
  }) {
    const excecao = await this.prisma.excecaoFiscal.findFirst({
      where: { id: params.excecaoId, companyId: params.companyId },
    });
    if (!excecao) throw new NotFoundException('Exceção não encontrada');

    // Atualiza a decisão com a correção humana
    await this.prisma.fiscalBrainDecision.update({
      where: { id: excecao.decisionId },
      data: {
        revisadoPor: params.userId,
        correcao:    params.aceitar ? null : (params.resolucao as any),
        revisadoEm:  new Date(),
        autoAplicado: true, // após revisão humana, considera aplicado
      },
    });

    // Fecha a exceção
    return this.prisma.excecaoFiscal.update({
      where: { id: params.excecaoId },
      data: {
        status:       'RESOLVIDA',
        resolvidoPor: params.userId,
        resolucao:    params.resolucao as any,
        resolvidoEm:  new Date(),
      },
    });
  }

  /** Ignorar uma exceção (documento não precisa de classificação automática). */
  async ignorar(excecaoId: string, companyId: string, userId: string) {
    const excecao = await this.prisma.excecaoFiscal.findFirst({
      where: { id: excecaoId, companyId },
    });
    if (!excecao) throw new NotFoundException('Exceção não encontrada');
    return this.prisma.excecaoFiscal.update({
      where: { id: excecaoId },
      data: { status: 'IGNORADA', resolvidoPor: userId, resolvidoEm: new Date() },
    });
  }

  /** Contagem resumida para o dashboard. */
  async contagem(companyId: string): Promise<{ pendentes: number; resolvidas: number; ignoradas: number }> {
    const [pendentes, resolvidas, ignoradas] = await Promise.all([
      this.prisma.excecaoFiscal.count({ where: { companyId, status: 'PENDENTE' } }),
      this.prisma.excecaoFiscal.count({ where: { companyId, status: 'RESOLVIDA' } }),
      this.prisma.excecaoFiscal.count({ where: { companyId, status: 'IGNORADA' } }),
    ]);
    return { pendentes, resolvidas, ignoradas };
  }

  private buildMotivo(confianca: number, erros: string[]): string {
    const partes: string[] = [];
    if (confianca < 92) partes.push(`Confiança ${confianca}% — abaixo do limite de 92%`);
    if (erros.length) partes.push(`Erros de validação: ${erros.join('; ')}`);
    return partes.join(' | ') || 'Revisão manual solicitada';
  }
}
