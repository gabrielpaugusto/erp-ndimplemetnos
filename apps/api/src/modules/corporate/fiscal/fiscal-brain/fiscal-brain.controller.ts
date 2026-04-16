import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '@/modules/core/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/modules/core/auth/decorators/current-user.decorator';
import { FiscalBrainService } from './fiscal-brain.service';
import { ContextoOperacao } from './classificador.service';
import { ExcoesQueueService } from './excecoes-queue.service';
import { FeedbackLoopService } from './feedback-loop.service';
import { KnowledgeBaseService } from './knowledge-base.service';
import { ClassificacaoFiscal } from './classificador.service';
import { FiscalBrainChatService } from './fiscal-brain-chat.service';

@UseGuards(JwtAuthGuard)
@Controller('fiscal-brain')
export class FiscalBrainController {
  constructor(
    private readonly brain: FiscalBrainService,
    private readonly excecoes: ExcoesQueueService,
    private readonly feedback: FeedbackLoopService,
    private readonly kb: KnowledgeBaseService,
    private readonly chatService: FiscalBrainChatService,
  ) {}

  // ── Classificação ──────────────────────────────────────────────────────────

  /**
   * POST /fiscal-brain/classificar
   * Classifica um documento fiscal via IA.
   */
  @Post('classificar')
  async classificar(
    @CurrentUser() user: any,
    @Body()
    body: {
      documentType: string;
      documentId: string;
      contexto: ContextoOperacao;
    },
  ) {
    return this.brain.classificarDocumento({
      companyId: user.companyId,
      documentType: body.documentType,
      documentId: body.documentId,
      contexto: body.contexto,
    });
  }

  // ── Exceções ───────────────────────────────────────────────────────────────

  /**
   * GET /fiscal-brain/excecoes
   * Lista exceções da empresa (filtro por status: PENDENTE | RESOLVIDA | IGNORADA).
   */
  @Get('excecoes')
  listarExcecoes(
    @CurrentUser() user: any,
    @Query('status') status?: string,
  ) {
    return this.excecoes.listar(user.companyId, status);
  }

  /**
   * GET /fiscal-brain/excecoes/contagem
   */
  @Get('excecoes/contagem')
  contagemExcecoes(@CurrentUser() user: any) {
    return this.excecoes.contagem(user.companyId);
  }

  /**
   * PATCH /fiscal-brain/excecoes/:id/resolver
   * Humano resolve uma exceção (aprova ou corrige a classificação).
   */
  @Patch('excecoes/:id/resolver')
  resolverExcecao(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body()
    body: {
      aceitar: boolean;
      resolucao?: Partial<ClassificacaoFiscal>;
    },
  ) {
    return this.excecoes.resolver({
      excecaoId: id,
      companyId: user.companyId,
      userId: user.id,
      aceitar: body.aceitar,
      resolucao: body.resolucao ?? {},
    });
  }

  /**
   * PATCH /fiscal-brain/excecoes/:id/ignorar
   */
  @Patch('excecoes/:id/ignorar')
  ignorarExcecao(@CurrentUser() user: any, @Param('id') id: string) {
    return this.excecoes.ignorar(id, user.companyId, user.id);
  }

  // ── Decisões / Histórico ───────────────────────────────────────────────────

  /**
   * GET /fiscal-brain/decisoes
   * Últimas N decisões — para o painel de monitoramento.
   */
  @Get('decisoes')
  ultimasDecisoes(
    @CurrentUser() user: any,
    @Query('limit') limit?: string,
  ) {
    return this.feedback.ultimasDecisoes(user.companyId, limit ? Number(limit) : 50);
  }

  // ── Métricas / Dashboard ───────────────────────────────────────────────────

  /**
   * GET /fiscal-brain/metricas
   * Métricas de desempenho da IA nos últimos N dias.
   */
  @Get('metricas')
  metricas(
    @CurrentUser() user: any,
    @Query('dias') dias?: string,
  ) {
    return this.feedback.metricas(user.companyId, dias ? Number(dias) : 30);
  }

  /**
   * GET /fiscal-brain/erros-frequentes
   * CFOPs mais corrigidos pelos usuários.
   */
  @Get('erros-frequentes')
  errosFrequentes(@CurrentUser() user: any) {
    return this.feedback.errosMaisFrequentes(user.companyId);
  }

  // ── Base de Conhecimento ───────────────────────────────────────────────────

  /**
   * POST /fiscal-brain/seed-legislacao
   * Popula a base de conhecimento com as regras fiscais iniciais.
   */
  @Post('seed-legislacao')
  async seedLegislacao() {
    return this.kb.seedLegislacaoBase();
  }

  /**
   * GET /fiscal-brain/knowledge-base/status
   * Verifica quantos itens a base de conhecimento tem.
   */
  @Get('knowledge-base/status')
  async kbStatus() {
    const count = await this.kb.count();
    return { totalItens: count, populada: count > 0 };
  }

  // ── Chat ──────────────────────────────────────────────────────────────────

  @Post('chat')
  chat(
    @CurrentUser() user: { id: string; companyId: string },
    @Body() body: { mensagem: string },
  ) {
    return this.chatService.enviarMensagem(user.companyId, body.mensagem);
  }

  @Get('chat/historico')
  chatHistorico(
    @CurrentUser() user: { id: string; companyId: string },
    @Query('limit') limit?: string,
  ) {
    return this.chatService.historico(user.companyId, limit ? parseInt(limit) : 60);
  }

  @Delete('chat/sessao')
  chatLimpar(@CurrentUser() user: { id: string; companyId: string }) {
    return this.chatService.limparSessao(user.companyId);
  }
}
