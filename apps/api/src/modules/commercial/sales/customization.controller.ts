import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '@/modules/core/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/modules/core/auth/decorators/current-user.decorator';
import { CustomizationService, CreateTemplateDto, UpsertCustomizationDto } from './customization.service';

/**
 * Sprint 3.4 — Endpoints de templates e customizações de Pedidos de Venda
 */
@Controller('sales/customization')
@UseGuards(JwtAuthGuard)
export class CustomizationController {
  constructor(private readonly customizationService: CustomizationService) {}

  // ── Templates ─────────────────────────────────────────────────────────────

  @Get('templates')
  findAllTemplates(@CurrentUser() user: { id: string; companyId: string }) {
    return this.customizationService.findAllTemplates(user.companyId);
  }

  @Get('templates/:id')
  findTemplate(
    @CurrentUser() user: { id: string; companyId: string },
    @Param('id') id: string,
  ) {
    return this.customizationService.findTemplate(id, user.companyId);
  }

  @Get('templates/:id/form')
  getTemplateForm(
    @CurrentUser() user: { id: string; companyId: string },
    @Param('id') id: string,
  ) {
    return this.customizationService.getTemplateForm(id, user.companyId);
  }

  @Post('templates')
  createTemplate(
    @CurrentUser() user: { id: string; companyId: string },
    @Body() dto: CreateTemplateDto,
  ) {
    return this.customizationService.createTemplate(user.companyId, dto);
  }

  @Patch('templates/:id')
  updateTemplate(
    @CurrentUser() user: { id: string; companyId: string },
    @Param('id') id: string,
    @Body() dto: Partial<CreateTemplateDto>,
  ) {
    return this.customizationService.updateTemplate(id, user.companyId, dto);
  }

  /**
   * POST /sales/customization/seed-templates
   * Cria templates padrão para fabricantes de implementos (semirreboque, tanque, plataforma).
   */
  @Post('seed-templates')
  seedDefaultTemplates(@CurrentUser() user: { id: string; companyId: string }) {
    return this.customizationService.seedDefaultTemplates(user.companyId);
  }
}
