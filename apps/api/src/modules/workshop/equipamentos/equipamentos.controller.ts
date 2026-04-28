import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/modules/core/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/modules/core/auth/decorators/current-user.decorator';
import { EquipamentosService } from './equipamentos.service';

@Controller('workshop/equipamentos')
@UseGuards(JwtAuthGuard)
export class EquipamentosController {
  constructor(private readonly service: EquipamentosService) {}

  @Get()
  findAll(@CurrentUser() user: any, @Query() query: any) {
    return this.service.findAll(user.companyId, query);
  }

  @Get('tipos-carroceria')
  findTiposCarroceria() {
    return this.service.findTiposCarroceria();
  }

  @Get('modelos-carroceria')
  findModelosCarroceria(@Query('tipoCarroceriaId') tipoCarroceriaId?: string) {
    return this.service.findModelosCarroceria(tipoCarroceriaId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@CurrentUser() user: any, @Body() body: any) {
    return this.service.create(user.companyId, body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.service.update(id, body);
  }

  // ── Vínculos ──────────────────────────────────────────────────────────────

  @Post('vinculos')
  vincular(@Body() body: { carroceriaId: string; veiculoId: string; observations?: string }) {
    return this.service.vincular(body.carroceriaId, body.veiculoId, body.observations);
  }

  @Patch('vinculos/:id/desvincular')
  desvincular(@Param('id') id: string) {
    return this.service.desvincular(id);
  }

  // ── Tipos e Modelos de Carroceria ─────────────────────────────────────────

  @Post('tipos-carroceria')
  createTipo(@Body() body: any) {
    return this.service.createTipoCarroceria(body);
  }

  @Patch('tipos-carroceria/:id')
  updateTipo(@Param('id') id: string, @Body() body: any) {
    return this.service.updateTipoCarroceria(id, body);
  }

  @Post('modelos-carroceria')
  createModelo(@Body() body: any) {
    return this.service.createModeloCarroceria(body);
  }

  @Patch('modelos-carroceria/:id')
  updateModelo(@Param('id') id: string, @Body() body: any) {
    return this.service.updateModeloCarroceria(id, body);
  }
}
