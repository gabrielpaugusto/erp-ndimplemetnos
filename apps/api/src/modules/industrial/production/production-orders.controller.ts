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
import { ProductionOrdersService } from './production-orders.service';
import { CreateProductionOrderDto } from './dto/create-production-order.dto';
import { UpdateProductionOrderDto } from './dto/update-production-order.dto';
import { ApontarConsumoDto } from './dto/apontar-consumo.dto';

@Controller('production/orders')
@UseGuards(JwtAuthGuard)
export class ProductionOrdersController {
  constructor(
    private readonly productionOrdersService: ProductionOrdersService,
  ) {}

  @Get()
  findAll(
    @CurrentUser() user: { id: string; companyId: string },
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('strategy') strategy?: string,
    @Query('type') type?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.productionOrdersService.findAll(user.companyId, {
      search,
      status,
      strategy,
      type,
      startDate,
      endDate,
      page,
      limit,
    });
  }

  @Get('stats')
  getStats(@CurrentUser() user: { id: string; companyId: string }) {
    return this.productionOrdersService.getStats(user.companyId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productionOrdersService.findOne(id);
  }

  @Get(':id/necessidades')
  getNecessidades(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; companyId: string },
  ) {
    return this.productionOrdersService.getNecessidades(id, user.companyId);
  }

  @Post()
  create(
    @CurrentUser() user: { id: string; companyId: string },
    @Body() createProductionOrderDto: CreateProductionOrderDto,
  ) {
    return this.productionOrdersService.create(
      user.companyId,
      createProductionOrderDto,
    );
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateProductionOrderDto: UpdateProductionOrderDto,
  ) {
    return this.productionOrdersService.update(id, updateProductionOrderDto);
  }

  @Post(':id/release')
  release(
    @CurrentUser() user: { id: string; companyId: string },
    @Param('id') id: string,
  ) {
    return this.productionOrdersService.release(id, user.id);
  }

  @Post(':id/start')
  start(@Param('id') id: string) {
    return this.productionOrdersService.start(id);
  }

  @Post(':id/complete')
  complete(@Param('id') id: string) {
    return this.productionOrdersService.complete(id);
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string) {
    return this.productionOrdersService.cancel(id);
  }

  /** A9 — POST /production/orders/:id/apontar-consumo */
  @Post(':id/apontar-consumo')
  apontarConsumo(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; companyId: string },
    @Body() dto: ApontarConsumoDto,
  ) {
    return this.productionOrdersService.apontarConsumoReal(id, user.companyId, user.id, dto);
  }

  /** A9 — GET /production/orders/:id/consumo */
  @Get(':id/consumo')
  getConsumo(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; companyId: string },
  ) {
    return this.productionOrdersService.getConsumo(id, user.companyId);
  }

  // ── Sprint 2.3 — Timeline ────────────────────────────────────────────────

  /** GET /production/orders/:id/timeline */
  @Get(':id/timeline')
  getTimeline(
    @CurrentUser() user: { id: string; companyId: string },
    @Param('id') id: string,
  ) {
    return this.productionOrdersService.getTimeline(id, user.companyId);
  }

  // ── Sprint 2.4 — Reservas de Estoque ────────────────────────────────────

  /** GET /production/orders/:id/reservas */
  @Get(':id/reservas')
  getReservas(
    @CurrentUser() user: { id: string; companyId: string },
    @Param('id') id: string,
  ) {
    return this.productionOrdersService.getReservas(id, user.companyId);
  }

  // ── Sprint 3.1 — BOM Customizada ─────────────────────────────────────────

  /** GET /production/orders/:id/bom — BOM efetiva (override se existir) */
  @Get(':id/bom')
  getBom(
    @CurrentUser() user: { id: string; companyId: string },
    @Param('id') id: string,
  ) {
    return this.productionOrdersService.getBomEfetiva(id, user.companyId);
  }

  /** GET /production/orders/:id/bom/diff — diff da BOM customizada vs padrão */
  @Get(':id/bom/diff')
  getBomDiff(
    @CurrentUser() user: { id: string; companyId: string },
    @Param('id') id: string,
  ) {
    return this.productionOrdersService.getBomDiff(id, user.companyId);
  }

  /** POST /production/orders/:id/bom/override — cria/atualiza customização */
  @Post(':id/bom/override')
  upsertBomOverride(
    @CurrentUser() user: { id: string; companyId: string },
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.productionOrdersService.upsertBomOverride(id, user.companyId, user.id, body);
  }
}
