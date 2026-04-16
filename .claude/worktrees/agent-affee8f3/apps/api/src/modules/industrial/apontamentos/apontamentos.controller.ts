import {
  Controller, Get, Post, Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '@/modules/core/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/modules/core/auth/decorators/current-user.decorator';
import { ApontamentosService } from './apontamentos.service';
import { IniciarApontamentoDto } from './dto/iniciar-apontamento.dto';
import { PararApontamentoDto } from './dto/parar-apontamento.dto';

@Controller('apontamentos')
@UseGuards(JwtAuthGuard)
export class ApontamentosController {
  constructor(private readonly apontamentosService: ApontamentosService) {}

  // ── Consultas ──────────────────────────────────────────────────────────────

  @Get('ordens-disponiveis')
  ordensDisponiveis(@CurrentUser() user: any) {
    return this.apontamentosService.ordensDisponiveis(user.companyId);
  }

  @Get('etapas/:tipo/:orderId')
  etapas(@CurrentUser() user: any, @Param('tipo') tipo: string, @Param('orderId') orderId: string) {
    return this.apontamentosService.etapasDaOrdem(user.companyId, tipo, orderId);
  }

  @Get('meu-ativo')
  meuAtivo(@CurrentUser() user: any) {
    return this.apontamentosService.meuAtivo(user.companyId, user.id);
  }

  @Get('ativos')
  ativos(@CurrentUser() user: any) {
    return this.apontamentosService.ativos(user.companyId);
  }

  @Get('historico')
  historico(@CurrentUser() user: any, @Query('mes') mes?: string) {
    return this.apontamentosService.historico(user.companyId, mes);
  }

  @Get('produtividade')
  produtividade(@CurrentUser() user: any, @Query('mes') mes?: string) {
    return this.apontamentosService.produtividade(user.companyId, mes);
  }

  // ── Controle ───────────────────────────────────────────────────────────────

  @Post('iniciar')
  iniciar(@CurrentUser() user: any, @Body() dto: IniciarApontamentoDto) {
    return this.apontamentosService.iniciar(user.companyId, user.id, dto);
  }

  @Post('pausar')
  pausar(@CurrentUser() user: any) {
    return this.apontamentosService.pausar(user.companyId, user.id);
  }

  @Post('retomar')
  retomar(@CurrentUser() user: any) {
    return this.apontamentosService.retomar(user.companyId, user.id);
  }

  @Post('parar')
  parar(@CurrentUser() user: any, @Body() dto: PararApontamentoDto) {
    return this.apontamentosService.parar(user.companyId, user.id, dto);
  }

  // ── Etapas (criação inline) ────────────────────────────────────────────────

  @Post('etapas/os/:serviceOrderId')
  criarEtapaOS(
    @CurrentUser() user: any,
    @Param('serviceOrderId') serviceOrderId: string,
    @Body() dto: { descricao: string; sequencia: number; tempoEstimadoH?: number },
  ) {
    return this.apontamentosService.criarEtapaOS(user.companyId, serviceOrderId, dto);
  }

  @Post('etapas/calderaria/:calderariaOrderId')
  criarEtapaCalderaria(
    @CurrentUser() user: any,
    @Param('calderariaOrderId') calderariaOrderId: string,
    @Body() dto: { descricao: string; sequencia: number; tempoEstimadoH?: number },
  ) {
    return this.apontamentosService.criarEtapaCalderaria(user.companyId, calderariaOrderId, dto);
  }
}
