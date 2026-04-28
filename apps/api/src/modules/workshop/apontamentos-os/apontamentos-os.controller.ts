import { Controller, Get, Post, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/modules/core/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/modules/core/auth/decorators/current-user.decorator';
import { ApontamentosOsService } from './apontamentos-os.service';

@Controller('workshop/apontamentos')
@UseGuards(JwtAuthGuard)
export class ApontamentosOsController {
  constructor(private readonly service: ApontamentosOsService) {}

  // ── START / PAUSE / STOP ──────────────────────────────────────────────────

  @Post('subtarefas/:id/start')
  start(
    @Param('id') osSubtarefaId: string,
    @CurrentUser() user: any,
  ) {
    return this.service.start(osSubtarefaId, user.employeeId ?? user.id, user.companyId);
  }

  @Post('subtarefas/:id/pause')
  pause(
    @Param('id') osSubtarefaId: string,
    @CurrentUser() user: any,
  ) {
    return this.service.pause(osSubtarefaId, user.employeeId ?? user.id);
  }

  @Post('subtarefas/:id/stop')
  stop(
    @Param('id') osSubtarefaId: string,
    @CurrentUser() user: any,
  ) {
    return this.service.stop(osSubtarefaId, user.employeeId ?? user.id);
  }

  // ── Painel Ao Vivo ────────────────────────────────────────────────────────

  @Get('ao-vivo')
  getPainelAoVivo(@CurrentUser() user: any) {
    return this.service.getPainelAoVivo(user.companyId);
  }

  @Get('sinaleira')
  getSinaleira(@CurrentUser() user: any) {
    return this.service.getSinaleira(user.companyId);
  }

  // ── Histórico e Eficiência por OS ─────────────────────────────────────────

  @Get('os/:serviceOrderId/historico')
  getHistoricoOS(@Param('serviceOrderId') serviceOrderId: string) {
    return this.service.getHistoricoOS(serviceOrderId);
  }

  @Get('os/:serviceOrderId/eficiencia')
  getEficienciaOS(@Param('serviceOrderId') serviceOrderId: string) {
    return this.service.getEficienciaOS(serviceOrderId);
  }

  // ── Relatórios ────────────────────────────────────────────────────────────

  @Get('relatorios/mecanicos')
  getRelatorioMecanicos(
    @CurrentUser() user: any,
    @Query('dataInicio') dataInicio?: string,
    @Query('dataFim') dataFim?: string,
    @Query('employeeId') employeeId?: string,
  ) {
    return this.service.getRelatorioMecanicos(user.companyId, {
      dataInicio,
      dataFim,
      employeeId,
    });
  }
}
