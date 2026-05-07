import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/modules/core/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/modules/core/auth/decorators/current-user.decorator';
import { DeclaracaoArt264Service } from './declaracao-art264.service';

/**
 * Controller — Declarações Art. 264, I, RICMS-SP
 *
 * Rotas:
 *  POST  /fiscal/declaracao-art264/gerar/:nfeId           — gera declaração para uma NF-e
 *  GET   /fiscal/declaracao-art264                        — lista declarações (com filtros)
 *  GET   /fiscal/declaracao-art264/nfe/:nfeId             — busca por NF-e
 *  GET   /fiscal/declaracao-art264/:id                    — detalhe de uma declaração
 *  PATCH /fiscal/declaracao-art264/:id/receber            — marca como recebida
 *  PATCH /fiscal/declaracao-art264/:id/arquivar           — arquiva (com ou sem anexo)
 *  PATCH /fiscal/declaracao-art264/:id/cancelar           — cancela
 */
@Controller('fiscal/declaracao-art264')
@UseGuards(JwtAuthGuard)
export class DeclaracaoArt264Controller {
  constructor(private readonly service: DeclaracaoArt264Service) {}

  // ── Geração ───────────────────────────────────────────────────────────────

  /**
   * Gera a declaração Art. 264 I para uma NF-e de saída.
   * Idempotente: retorna existente se já gerada.
   * Também atualiza o campo informacoesComplementares da NF-e.
   */
  @Post('gerar/:nfeId')
  gerarDeclaracao(
    @Param('nfeId') nfeId: string,
    @CurrentUser() user: any,
  ) {
    return this.service.gerarDeclaracao(nfeId, user.companyId, false);
  }

  // ── Listagem ──────────────────────────────────────────────────────────────

  /**
   * Lista declarações da empresa com filtros.
   * Query params: status, search (razão social / CNPJ), page, limit
   */
  @Get()
  listar(
    @Query('status')  status?: string,
    @Query('search')  search?: string,
    @Query('page')    page?: string,
    @Query('limit')   limit?: string,
    @CurrentUser() user?: any,
  ) {
    return this.service.listar(user.companyId, { status, search, page, limit });
  }

  /**
   * Busca declaração vinculada a uma NF-e específica.
   */
  @Get('nfe/:nfeId')
  buscarPorNfe(
    @Param('nfeId') nfeId: string,
    @CurrentUser() user: any,
  ) {
    return this.service.buscarPorNfe(nfeId, user.companyId);
  }

  /**
   * Retorna os detalhes completos de uma declaração (inclui conteudo para impressão).
   */
  @Get(':id')
  buscarPorId(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.service.buscarPorId(id, user.companyId);
  }

  // ── Ciclo de vida ─────────────────────────────────────────────────────────

  /**
   * Marca declaração como RECEBIDA (declaração física assinada recebida pelo emitente).
   * Body: { observacoes?: string }
   */
  @Patch(':id/receber')
  marcarRecebida(
    @Param('id') id: string,
    @Body() body: { observacoes?: string },
    @CurrentUser() user: any,
  ) {
    return this.service.marcarRecebida(id, user.companyId, body.observacoes);
  }

  /**
   * Arquiva a declaração — cumpre obrigação de conservação por 5 anos (Art. 202 RICMS-SP).
   * Body: { anexoUrl?: string; observacoes?: string }
   * Opcional: uploadar PDF escaneado via URL (S3 / storage externo).
   */
  @Patch(':id/arquivar')
  arquivar(
    @Param('id') id: string,
    @Body() body: { anexoUrl?: string; observacoes?: string },
    @CurrentUser() user: any,
  ) {
    return this.service.arquivar(id, user.companyId, body.anexoUrl, body.observacoes);
  }

  /**
   * Cancela a declaração (ex.: operação cancelada ou cliente mudou destinação).
   * Body: { motivo: string }
   */
  @Patch(':id/cancelar')
  cancelar(
    @Param('id') id: string,
    @Body() body: { motivo: string },
    @CurrentUser() user: any,
  ) {
    return this.service.cancelar(id, user.companyId, body.motivo);
  }
}
