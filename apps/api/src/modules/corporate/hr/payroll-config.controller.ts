import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '@/modules/core/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/modules/core/auth/decorators/current-user.decorator';
import {
  PayrollConfigService,
  InssFaixaDto,
  IrrfFaixaDto,
  PayrollConfigDto,
} from './payroll-config.service';

@Controller('hr/payroll-config')
@UseGuards(JwtAuthGuard)
export class PayrollConfigController {
  constructor(private readonly payrollConfigService: PayrollConfigService) {}

  // GET /api/hr/payroll-config — busca configuração atual (FGTS, INSS patronal)
  @Get()
  getConfig(@CurrentUser() user: { id: string; companyId: string }) {
    return this.payrollConfigService.getConfig(user.companyId);
  }

  // PATCH /api/hr/payroll-config — atualiza FGTS e INSS patronal
  @Patch()
  updateConfig(
    @CurrentUser() user: { id: string; companyId: string },
    @Body() dto: PayrollConfigDto,
  ) {
    return this.payrollConfigService.updateConfig(user.companyId, dto);
  }

  // GET /api/hr/payroll-config/faixas/:ano — busca faixas de um ano específico
  @Get('faixas/:ano')
  getFaixasPorAno(
    @CurrentUser() user: { id: string; companyId: string },
    @Param('ano', ParseIntPipe) ano: number,
  ) {
    return this.payrollConfigService.getFaixasPorAno(user.companyId, ano);
  }

  // POST /api/hr/payroll-config/inss-faixas — salva faixas INSS para um ano
  @Post('inss-faixas')
  saveInssFaixas(
    @CurrentUser() user: { id: string; companyId: string },
    @Body() body: { ano: number; faixas: InssFaixaDto[] },
  ) {
    return this.payrollConfigService.saveInssFaixas(
      user.companyId,
      body.ano,
      body.faixas,
    );
  }

  // POST /api/hr/payroll-config/irrf-faixas — salva faixas IRRF para um ano
  @Post('irrf-faixas')
  saveIrrfFaixas(
    @CurrentUser() user: { id: string; companyId: string },
    @Body() body: { ano: number; faixas: IrrfFaixaDto[] },
  ) {
    return this.payrollConfigService.saveIrrfFaixas(
      user.companyId,
      body.ano,
      body.faixas,
    );
  }

  // POST /api/hr/payroll-config/import-defaults-2025 — preenche com valores padrão 2025
  @Post('import-defaults-2025')
  importDefaults2025(@CurrentUser() user: { id: string; companyId: string }) {
    return this.payrollConfigService.importDefaults2025(user.companyId);
  }
}
