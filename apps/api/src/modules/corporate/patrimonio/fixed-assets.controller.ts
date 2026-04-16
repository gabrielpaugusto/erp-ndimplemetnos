import { Controller, Get, Post, Patch, Param, Body, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/modules/core/auth/guards/jwt-auth.guard';
import { FixedAssetsService } from './fixed-assets.service';

@Controller('patrimonio')
@UseGuards(JwtAuthGuard)
export class FixedAssetsController {
  constructor(private readonly service: FixedAssetsService) {}

  @Get()
  findAll(@Request() req: any, @Query() query: any) {
    return this.service.findAll(req.user.companyId, query);
  }

  @Get('stats')
  getStats(@Request() req: any) {
    return this.service.getStats(req.user.companyId);
  }

  @Get('relatorio-depreciacao')
  relatorioDepreciacao(
    @Request() req: any,
    @Query('ano') ano: string,
    @Query('mes') mes: string,
  ) {
    const agora = new Date();
    return this.service.relatorioDepreciacao(
      req.user.companyId,
      parseInt(ano || agora.getFullYear().toString()),
      parseInt(mes || (agora.getMonth() + 1).toString()),
    );
  }

  @Post('processar-depreciacao')
  processarDepreciacao(
    @Request() req: any,
    @Body() body: { ano?: number; mes?: number },
  ) {
    const agora = new Date();
    return this.service.processarDepreciacaoMensal(
      req.user.companyId,
      body.ano || agora.getFullYear(),
      body.mes || agora.getMonth() + 1,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Request() req: any, @Body() body: any) {
    return this.service.create(req.user.companyId, body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.service.update(id, body);
  }

  @Post(':id/baixar')
  baixar(@Param('id') id: string, @Body() body: any) {
    return this.service.baixar(id, body);
  }

  @Post(':id/depreciar')
  depreciarAtivo(
    @Param('id') id: string,
    @Body() body: { ano?: number; mes?: number },
  ) {
    const agora = new Date();
    return this.service.depreciarAtivo(
      id,
      body.ano || agora.getFullYear(),
      body.mes || agora.getMonth() + 1,
    );
  }

  // ── CIAP — A10 ───────────────────────────────────────────────────────────

  /** GET /patrimonio/:id/ciap — saldo CIAP de um ativo */
  @Get(':id/ciap')
  getCiapSaldo(@Param('id') id: string) {
    return this.service.getCiapSaldo(id);
  }

  /** POST /patrimonio/ciap/processar — processa crédito CIAP do mês */
  @Post('ciap/processar')
  processarCiap(
    @Request() req: any,
    @Body() body: { ano?: number; mes?: number },
  ) {
    const agora = new Date();
    return this.service.processarCiapMensal(
      req.user.companyId,
      body.ano || agora.getFullYear(),
      body.mes || agora.getMonth() + 1,
    );
  }

  /** GET /patrimonio/ciap/relatorio — relatório CIAP de todos os ativos */
  @Get('ciap/relatorio')
  relatorioCiap(@Request() req: any) {
    return this.service.relatorioCiap(req.user.companyId);
  }
}
