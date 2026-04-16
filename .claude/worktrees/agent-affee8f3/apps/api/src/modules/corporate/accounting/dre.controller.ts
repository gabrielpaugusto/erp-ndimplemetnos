import {
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '@/modules/core/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/modules/core/auth/decorators/current-user.decorator';
import { DreService } from './dre.service';

interface JwtPayload {
  sub: string;
  companyId: string;
  email: string;
}

@Controller('accounting/dre')
@UseGuards(JwtAuthGuard)
export class DreController {
  constructor(private readonly dreService: DreService) {}

  /**
   * GET /accounting/dre?periodo=2025-03
   * Returns DRE for the given period (from snapshot or recalculated live).
   */
  @Get()
  find(
    @CurrentUser() user: JwtPayload,
    @Query('periodo') periodo?: string,
  ) {
    const p = periodo || currentPeriodo();
    return this.dreService.findOrCalc(user.companyId, p);
  }

  /**
   * GET /accounting/dre/historico?meses=12
   * Returns last N months DRE as an array.
   */
  @Get('historico')
  historico(
    @CurrentUser() user: JwtPayload,
    @Query('meses') meses?: string,
  ) {
    return this.dreService.historico(user.companyId, meses ? parseInt(meses, 10) : 12);
  }

  /**
   * GET /accounting/dre/comparativo?periodos=2025-01,2025-02,2025-03
   * Returns DRE for a list of periods side by side.
   */
  @Get('comparativo')
  comparativo(
    @CurrentUser() user: JwtPayload,
    @Query('periodos') periodos?: string,
  ) {
    const list = (periodos || '').split(',').filter(Boolean);
    if (list.length === 0) list.push(currentPeriodo());
    return this.dreService.comparativo(user.companyId, list);
  }

  /**
   * POST /accounting/dre/snapshot?periodo=2025-03
   * Calculates and persists a snapshot for the given period.
   */
  @Post('snapshot')
  @HttpCode(HttpStatus.OK)
  snapshot(
    @CurrentUser() user: JwtPayload,
    @Query('periodo') periodo?: string,
  ) {
    const p = periodo || currentPeriodo();
    return this.dreService.salvarSnapshot(user.companyId, p);
  }
}

function currentPeriodo(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}
