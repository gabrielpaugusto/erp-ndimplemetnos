import { Controller, Get, Post, Query, UseGuards, Request, BadRequestException } from '@nestjs/common';
import { JwtAuthGuard } from '@/modules/core/auth/guards/jwt-auth.guard';
import { ReinfEventsService } from './reinf-events.service';
import { ReinfClientService } from './reinf-client.service';

@Controller('reinf')
@UseGuards(JwtAuthGuard)
export class ReinfController {
  constructor(
    private readonly events: ReinfEventsService,
    private readonly client: ReinfClientService,
  ) {}

  private periodoAtual(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  @Get('dashboard')
  async dashboard(@Request() req: any, @Query('periodo') periodo?: string) {
    return this.events.resumoPeriodo(req.user.companyId, periodo || this.periodoAtual());
  }

  @Post('enviar')
  async enviar(@Request() req: any, @Query('periodo') periodo?: string) {
    return this.events.enviarPeriodo(req.user.companyId, periodo || this.periodoAtual());
  }

  @Post('fechar')
  async fechar(@Request() req: any, @Query('periodo') periodo?: string) {
    if (!periodo) throw new BadRequestException('periodo é obrigatório (YYYY-MM)');
    return this.events.fecharPeriodo(req.user.companyId, periodo);
  }

  @Get('consultar')
  async consultar(@Request() req: any, @Query('protocolo') protocolo: string) {
    if (!protocolo) throw new BadRequestException('protocolo é obrigatório');
    return this.client.consultarLoteEventos(req.user.companyId, protocolo);
  }

  @Get('historico')
  async historico(@Request() req: any, @Query('limit') limit?: string) {
    return this.events.historico(req.user.companyId, parseInt(limit || '20', 10));
  }

  @Get('preview/r2010')
  async previewR2010(@Request() req: any, @Query('periodo') periodo?: string) {
    return this.events.gerarR2010Batch(req.user.companyId, periodo || this.periodoAtual());
  }

  @Get('preview/r4020')
  async previewR4020(@Request() req: any, @Query('periodo') periodo?: string) {
    return this.events.gerarR4020Batch(req.user.companyId, periodo || this.periodoAtual());
  }
}
