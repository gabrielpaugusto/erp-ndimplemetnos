import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';

export interface MetricasFeedback {
  totalDecisoes: number;
  autoAplicadas: number;
  revisadasHumano: number;
  taxaAutoAplicacao: number;    // %
  taxaAcertoIA: number;         // % de auto-aplicadas sem correção posterior
  mediaConfianca: number;
  excecoesPendentes: number;
}

@Injectable()
export class FeedbackLoopService {
  private readonly logger = new Logger(FeedbackLoopService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Calcula métricas de desempenho da IA para um período.
   * Usado no dashboard para mostrar a evolução da precisão.
   */
  async metricas(companyId: string, diasRetroativos = 30): Promise<MetricasFeedback> {
    const desde = new Date(Date.now() - diasRetroativos * 86400000);

    const [total, autoAplicadas, revisadas, semCorrecao, mediaConf, pendentes] = await Promise.all([
      this.prisma.fiscalBrainDecision.count({
        where: { companyId, createdAt: { gte: desde } },
      }),
      this.prisma.fiscalBrainDecision.count({
        where: { companyId, autoAplicado: true, createdAt: { gte: desde } },
      }),
      this.prisma.fiscalBrainDecision.count({
        where: { companyId, revisadoPor: { not: null as any }, createdAt: { gte: desde } },
      }),
      // Auto-aplicadas e depois revisadas SEM correção = IA acertou
      this.prisma.fiscalBrainDecision.count({
        where: {
          companyId, autoAplicado: true,
          revisadoPor: { not: null as any },
          correcao: { equals: null as any },
          createdAt: { gte: desde },
        },
      }),
      this.prisma.fiscalBrainDecision.aggregate({
        where: { companyId, createdAt: { gte: desde } },
        _avg: { confianca: true },
      }),
      this.prisma.excecaoFiscal.count({
        where: { companyId, status: 'PENDENTE' },
      }),
    ]);

    const taxaAuto = total > 0 ? (autoAplicadas / total) * 100 : 0;
    // Das auto-aplicadas que foram revisadas, quantas NÃO tiveram correção
    const revisadasAuto = await this.prisma.fiscalBrainDecision.count({
      where: {
        companyId, autoAplicado: true,
        revisadoPor: { not: null as any }, createdAt: { gte: desde },
      },
    });
    const taxaAcerto = revisadasAuto > 0 ? (semCorrecao / revisadasAuto) * 100 : 100;

    return {
      totalDecisoes:      total,
      autoAplicadas,
      revisadasHumano:    revisadas,
      taxaAutoAplicacao:  Math.round(taxaAuto * 10) / 10,
      taxaAcertoIA:       Math.round(taxaAcerto * 10) / 10,
      mediaConfianca:     Math.round((mediaConf._avg.confianca ?? 0) * 10) / 10,
      excecoesPendentes:  pendentes,
    };
  }

  /**
   * Retorna as últimas decisões com detalhes — para o painel de monitoramento.
   */
  async ultimasDecisoes(companyId: string, limit = 50) {
    return this.prisma.fiscalBrainDecision.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        documentType: true,
        documentId: true,
        cfop: true,
        cstIcms: true,
        cstPis: true,
        cstCofins: true,
        aliquotaIcms: true,
        confianca: true,
        autoAplicado: true,
        revisadoPor: true,
        correcao: true,
        revisadoEm: true,
        fundamentoLegal: true,
        raciocinio: true,
        alertas: true,
        createdAt: true,
      },
    });
  }

  /**
   * Retorna as correções mais frequentes feitas por humanos.
   * Ajuda a identificar onde a IA erra mais — para ajuste do prompt ou base de conhecimento.
   */
  async errosMaisFrequentes(companyId: string, limit = 10) {
    const correcoes = await this.prisma.fiscalBrainDecision.findMany({
      where: { companyId, correcao: { not: null as any } },
      select: { cfop: true, correcao: true, contexto: true },
      take: 200,
    });

    // Agrupa por (cfop original → cfop corrigido)
    const freq: Record<string, number> = {};
    for (const d of correcoes) {
      const corr = d.correcao as any;
      if (corr?.cfop && corr.cfop !== d.cfop) {
        const key = `${d.cfop} → ${corr.cfop}`;
        freq[key] = (freq[key] ?? 0) + 1;
      }
    }

    return Object.entries(freq)
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([transicao, count]) => ({ transicao, count }));
  }
}
