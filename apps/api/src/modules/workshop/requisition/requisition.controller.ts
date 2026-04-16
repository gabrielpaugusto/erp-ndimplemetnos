import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '@/modules/core/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/modules/core/auth/decorators/current-user.decorator';
import { RequisitionService } from './requisition.service';
import { CreateRequisitionDto } from './dto/create-requisition.dto';
import { UpdateRequisitionDto } from './dto/update-requisition.dto';
import { ApproveRequisitionDto } from './dto/approve-requisition.dto';
import { DeliverRequisitionDto } from './dto/deliver-requisition.dto';
import { ApproveRequisitionSingleItemDto } from './dto/approve-item.dto';

@Controller('requisitions')
@UseGuards(JwtAuthGuard)
export class RequisitionController {
  constructor(private readonly requisitionService: RequisitionService) {}

  @Get()
  findAll(
    @CurrentUser() user: { id: string; companyId: string },
    @Query('search') search?: string,
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.requisitionService.findAll(user.companyId, {
      search,
      type,
      status,
      page,
      limit,
    });
  }

  @Get('stats')
  getStats(@CurrentUser() user: { id: string; companyId: string }) {
    return this.requisitionService.getStats(user.companyId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.requisitionService.findOne(id);
  }

  @Post()
  create(
    @CurrentUser() user: { id: string; companyId: string },
    @Body() createRequisitionDto: CreateRequisitionDto,
  ) {
    return this.requisitionService.create(
      user.companyId,
      user.id,
      createRequisitionDto,
    );
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateRequisitionDto: UpdateRequisitionDto,
  ) {
    return this.requisitionService.update(id, updateRequisitionDto);
  }

  @Post(':id/submit')
  submit(@Param('id') id: string) {
    return this.requisitionService.submit(id);
  }

  @Post(':id/approve')
  approve(
    @CurrentUser() user: { id: string; companyId: string },
    @Param('id') id: string,
    @Body() approveRequisitionDto: ApproveRequisitionDto,
  ) {
    return this.requisitionService.approve(id, user.id, approveRequisitionDto, user.companyId);
  }

  @Post(':id/separate')
  separate(@Param('id') id: string) {
    return this.requisitionService.separate(id);
  }

  @Post(':id/deliver')
  deliver(
    @Param('id') id: string,
    @Body() deliverRequisitionDto: DeliverRequisitionDto,
  ) {
    return this.requisitionService.deliver(id, deliverRequisitionDto);
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string) {
    return this.requisitionService.cancel(id);
  }

  // ── Sprint 2.2 — Aprovação Parcial por Item ─────────────────────────────

  /**
   * PATCH /requisitions/:id/items/:itemId/approve
   * Aprova ou rejeita um item individual sem precisar processar a requisição inteira.
   */
  @Patch(':id/items/:itemId/approve')
  approveItem(
    @CurrentUser() user: { id: string; companyId: string },
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: ApproveRequisitionSingleItemDto,
  ) {
    return this.requisitionService.approveItem(id, itemId, dto, user.id, user.companyId);
  }

  // ── Sprint 2.3 — Timeline ───────────────────────────────────────────────

  /**
   * GET /requisitions/:id/timeline
   * Retorna a linha do tempo do documento.
   */
  @Get(':id/timeline')
  getTimeline(
    @CurrentUser() user: { id: string; companyId: string },
    @Param('id') id: string,
  ) {
    return this.requisitionService.getTimeline(id, user.companyId);
  }
}
