import {
  Controller, Get, Post, Query, Param,
  UseGuards, Request, BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '@/modules/core/auth/guards/jwt-auth.guard';
import { EsocialEventsService } from './esocial-events.service';
import { EsocialClientService } from './esocial-client.service';

@Controller('esocial')
@UseGuards(JwtAuthGuard)
export class EsocialController {
  constructor(
    private readonly events: EsocialEventsService,
    private readonly client: EsocialClientService,
  ) {}

  /** GET /esocial/dashboard?periodo=2025-04 */
  @Get('dashboard')
  async dashboard(@Request() req: any, @Query('periodo') periodo?: string) {
    const ref = periodo || this.periodoAtual();
    return this.events.resumoPeriodo(req.user.companyId, ref);
  }

  /** POST /esocial/enviar?periodo=2025-04 — envia S-1200, S-1210 e S-1299 */
  @Post('enviar')
  async enviar(@Request() req: any, @Query('periodo') periodo?: string) {
    const ref = periodo || this.periodoAtual();
    return this.events.enviarPeriodo(req.user.companyId, ref);
  }

  /** POST /esocial/admissao/:employeeId — envia S-2200 */
  @Post('admissao/:employeeId')
  async enviarAdmissao(@Request() req: any, @Param('employeeId') employeeId: string) {
    const evento = await this.events.gerarS2200(req.user.companyId, employeeId);
    return this.client.enviarLoteEventos(req.user.companyId, [evento]);
  }

  /** POST /esocial/desligamento/:employeeId — envia S-2299 */
  @Post('desligamento/:employeeId')
  async enviarDesligamento(@Request() req: any, @Param('employeeId') employeeId: string) {
    const evento = await this.events.gerarS2299(req.user.companyId, employeeId);
    return this.client.enviarLoteEventos(req.user.companyId, [evento]);
  }

  /** GET /esocial/consultar?protocolo=... */
  @Get('consultar')
  async consultar(@Request() req: any, @Query('protocolo') protocolo: string) {
    if (!protocolo) throw new BadRequestException('protocolo é obrigatório');
    return this.client.consultarLoteEventos(req.user.companyId, protocolo);
  }

  /** GET /esocial/historico?limit=20 */
  @Get('historico')
  async historico(@Request() req: any, @Query('limit') limit?: string) {
    return this.events.historico(req.user.companyId, parseInt(limit || '20', 10));
  }

  /** GET /esocial/preview/s1200?periodo=2025-04 — preview sem enviar */
  @Get('preview/s1200')
  async previewS1200(@Request() req: any, @Query('periodo') periodo?: string) {
    return this.events.gerarS1200Batch(req.user.companyId, periodo || this.periodoAtual());
  }

  private periodoAtual(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }
}
