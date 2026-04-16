import {
  Controller, Get, Post, Patch, Body, Query, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '@/modules/core/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/modules/core/auth/decorators/current-user.decorator';
import { WorkflowEngineService } from './workflow-engine.service';

/**
 * Sprint 4.4 — Workflow Engine
 * Gerencia configurações de transições automáticas por tipo de documento.
 */
@UseGuards(JwtAuthGuard)
@Controller('workflow')
export class WorkflowEngineController {
  constructor(private readonly svc: WorkflowEngineService) {}

  /** GET /workflow/configs?documentType=SaleOrder */
  @Get('configs')
  list(
    @CurrentUser() user: { companyId: string },
    @Query('documentType') documentType?: string,
  ) {
    return this.svc.listConfigs(user.companyId, documentType);
  }

  /**
   * POST /workflow/configs
   * Cria ou atualiza (upsert) a configuração de um tipo de documento.
   * Body: { documentType, transitions: [{from, to, label?, notify?, webhookUrl?}], notifyOnFields? }
   */
  @Post('configs')
  upsert(
    @CurrentUser() user: { companyId: string },
    @Body() body: {
      documentType:   string;
      transitions:    Array<{ from: string; to: string; label?: string; notify?: string; webhookUrl?: string }>;
      notifyOnFields?: string[];
    },
  ) {
    return this.svc.upsertConfig(user.companyId, body);
  }

  /** PATCH /workflow/configs/toggle */
  @Patch('configs/toggle')
  toggle(
    @CurrentUser() user: { companyId: string },
    @Body() body: { documentType: string; active: boolean },
  ) {
    return this.svc.toggleConfig(user.companyId, body.documentType, body.active);
  }

  /** POST /workflow/seed-defaults */
  @Post('seed-defaults')
  seedDefaults(@CurrentUser() user: { companyId: string }) {
    return this.svc.seedDefaults(user.companyId);
  }
}
