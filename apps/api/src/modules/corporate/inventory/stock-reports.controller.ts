import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/modules/core/auth/guards/jwt-auth.guard';
import { StockReportsService } from './stock-reports.service';

@Controller('inventory/reports')
@UseGuards(JwtAuthGuard)
export class StockReportsController {
  constructor(private readonly reportsService: StockReportsService) {}

  @Get('abc-estoque')
  abcEstoque(@Request() req: any, @Query('locationId') locationId?: string) {
    return this.reportsService.curvABCEstoque(req.user.companyId, locationId);
  }

  @Get('abc-consumo')
  abcConsumo(
    @Request() req: any,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    const start = startDate
      ? new Date(startDate)
      : new Date(new Date().setMonth(new Date().getMonth() - 3));
    const end = endDate ? new Date(endDate) : new Date();
    return this.reportsService.curvABCConsumo(req.user.companyId, start, end);
  }

  @Get('ggf-mensal')
  ggfMensal(
    @Request() req: any,
    @Query('ano') ano: string,
    @Query('mes') mes: string,
  ) {
    const agora = new Date();
    return this.reportsService.relatorioGGFMensal(
      req.user.companyId,
      parseInt(ano || agora.getFullYear().toString()),
      parseInt(mes || (agora.getMonth() + 1).toString()),
    );
  }

  @Get('sem-movimentacao')
  semMovimentacao(@Request() req: any, @Query('dias') dias: string) {
    return this.reportsService.itensSemMovimentacao(
      req.user.companyId,
      parseInt(dias || '90'),
    );
  }
}
