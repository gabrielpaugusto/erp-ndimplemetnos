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
import { ServiceOrderService } from './service-order.service';
import { CreateServiceOrderDto } from './dto/create-service-order.dto';
import { UpdateServiceOrderDto } from './dto/update-service-order.dto';

@Controller('service-orders')
@UseGuards(JwtAuthGuard)
export class ServiceOrderController {
  constructor(private readonly serviceOrderService: ServiceOrderService) {}

  @Get()
  findAll(
    @CurrentUser() user: { id: string; companyId: string },
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('priority') priority?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.serviceOrderService.findAll(user.companyId, {
      search,
      status,
      type,
      priority,
      startDate,
      endDate,
      page,
      limit,
    });
  }

  @Get('stats')
  getStats(@CurrentUser() user: { id: string; companyId: string }) {
    return this.serviceOrderService.getStats(user.companyId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.serviceOrderService.findOne(id);
  }

  @Post()
  create(
    @CurrentUser() user: { id: string; companyId: string },
    @Body() createServiceOrderDto: CreateServiceOrderDto,
  ) {
    return this.serviceOrderService.create(
      user.companyId,
      createServiceOrderDto,
    );
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateServiceOrderDto: UpdateServiceOrderDto,
  ) {
    return this.serviceOrderService.update(id, updateServiceOrderDto);
  }

  @Post(':id/start')
  start(@Param('id') id: string) {
    return this.serviceOrderService.start(id);
  }

  @Post(':id/wait-parts')
  waitParts(@Param('id') id: string) {
    return this.serviceOrderService.waitParts(id);
  }

  @Post(':id/complete')
  complete(@Param('id') id: string) {
    return this.serviceOrderService.complete(id);
  }

  @Post(':id/deliver')
  deliver(@Param('id') id: string) {
    return this.serviceOrderService.deliver(id);
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string) {
    return this.serviceOrderService.cancel(id);
  }

  // ── Sprint 2.3 — Timeline ────────────────────────────────────────────────

  @Get(':id/timeline')
  getTimeline(
    @CurrentUser() user: { id: string; companyId: string },
    @Param('id') id: string,
  ) {
    return this.serviceOrderService.getTimeline(id, user.companyId);
  }

  // ── Sprint 2.4 — Reservas de Estoque ────────────────────────────────────

  @Get(':id/reservas')
  getReservas(
    @CurrentUser() user: { id: string; companyId: string },
    @Param('id') id: string,
  ) {
    return this.serviceOrderService.getReservas(id, user.companyId);
  }
}
