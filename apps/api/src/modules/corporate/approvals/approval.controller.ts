import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '@/modules/core/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/modules/core/auth/decorators/current-user.decorator';
import { ApprovalConfigService } from './approval-config.service';
import { ApprovalEngineService } from './approval-engine.service';

@Controller('approvals')
@UseGuards(JwtAuthGuard)
export class ApprovalController {
  constructor(
    private readonly approvalConfigService: ApprovalConfigService,
    private readonly approvalEngineService: ApprovalEngineService,
  ) {}

  // ── Config ────────────────────────────────────────────────────────────────

  @Get('config')
  async listConfig(@CurrentUser() user: any) {
    return this.approvalConfigService.listPolicies(user.companyId);
  }

  @Post('config')
  async upsertConfig(@CurrentUser() user: any, @Body() body: any) {
    return this.approvalConfigService.upsertPolicy(user.companyId, body);
  }

  @Delete('config/:id')
  async deleteConfig(@CurrentUser() user: any, @Param('id') id: string) {
    return this.approvalConfigService.deletePolicy(user.companyId, id);
  }

  // ── Pending approvals ─────────────────────────────────────────────────────

  @Get('pending')
  async getPending(@CurrentUser() user: any) {
    return this.approvalEngineService.getMyPendingApprovals(user.id, user.companyId);
  }

  @Get('document/:documentId')
  async getDocumentStatus(
    @Param('documentId') documentId: string,
    @CurrentUser() user: any,
  ) {
    return this.approvalEngineService.getDocumentApprovalStatus(documentId, user.companyId);
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  @Post(':id/approve')
  async approve(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() body: { roleId: string; comentario?: string },
  ) {
    return this.approvalEngineService.approve(id, user.id, body.roleId, body.comentario);
  }

  @Post(':id/reject')
  async reject(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() body: { roleId: string; comentario: string },
  ) {
    return this.approvalEngineService.reject(id, user.id, body.roleId, body.comentario);
  }
}
