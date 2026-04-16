import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/modules/core/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/modules/core/auth/decorators/current-user.decorator';
import { DashboardService } from './dashboard.service';

/**
 * Sprint 4.1 — Endpoints para os 4 Dashboards Operacionais
 *
 * Todos os dashboards usam o companyId do JWT — sem parâmetro extra.
 */
@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly svc: DashboardService) {}

  /** Dashboard Chão de Fábrica — OPs ativas, progresso, atrasos, centros */
  @Get('chao-fabrica')
  getChaoFabrica(@CurrentUser() user: { companyId: string }) {
    return this.svc.getChaoFabrica(user.companyId);
  }

  /** Dashboard Comercial — funil de vendas, ticket médio, top clientes */
  @Get('comercial')
  getComercial(@CurrentUser() user: { companyId: string }) {
    return this.svc.getComercial(user.companyId);
  }

  /** Dashboard Financeiro Executivo — fluxo de caixa, inadimplência, DRE */
  @Get('financeiro')
  getFinanceiro(@CurrentUser() user: { companyId: string }) {
    return this.svc.getFinanceiro(user.companyId);
  }

  /** Dashboard Compras/Estoque — itens críticos, giro, OCs abertas */
  @Get('compras-estoque')
  getComprasEstoque(@CurrentUser() user: { companyId: string }) {
    return this.svc.getComprasEstoque(user.companyId);
  }
}
