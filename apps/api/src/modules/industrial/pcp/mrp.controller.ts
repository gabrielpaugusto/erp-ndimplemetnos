import {
  Controller, Get, Post, Patch, Param, Query, Body, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '@/modules/core/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/modules/core/auth/decorators/current-user.decorator';
import { MrpService } from './mrp.service';

/**
 * Sprint 4.2 — MRP Básico
 */
@UseGuards(JwtAuthGuard)
@Controller('mrp')
export class MrpController {
  constructor(private readonly svc: MrpService) {}

  /**
   * POST /mrp/run
   * Executa o MRP completo → calcula necessidades e persiste sugestões.
   */
  @Post('run')
  run(@CurrentUser() user: { companyId: string; id: string }) {
    return this.svc.run(user.companyId, user.id);
  }

  /**
   * GET /mrp/preview
   * Calcula sem persistir sugestões — útil para simular antes de confirmar.
   */
  @Get('preview')
  preview(@CurrentUser() user: { companyId: string }) {
    return this.svc.preview(user.companyId);
  }

  /**
   * GET /mrp/sugestoes?status=PENDENTE
   * Lista sugestões de compra geradas pelo MRP.
   */
  @Get('sugestoes')
  list(
    @CurrentUser() user: { companyId: string },
    @Query('status') status?: string,
  ) {
    return this.svc.listSuggestions(user.companyId, status);
  }

  /**
   * POST /mrp/sugestoes/:id/aceitar
   * Aceita uma sugestão → gera rascunho de Pedido de Compra.
   */
  @Post('sugestoes/:id/aceitar')
  accept(
    @Param('id') id: string,
    @CurrentUser() user: { companyId: string; id: string },
  ) {
    return this.svc.acceptSuggestion(id, user.companyId, user.id);
  }

  /**
   * PATCH /mrp/sugestoes/:id/rejeitar
   * Rejeita uma sugestão (sem criar PO).
   */
  @Patch('sugestoes/:id/rejeitar')
  reject(
    @Param('id') id: string,
    @CurrentUser() user: { companyId: string },
    @Body() body: { motivo?: string },
  ) {
    return this.svc.rejectSuggestion(id, user.companyId, body?.motivo);
  }
}
