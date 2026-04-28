import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/modules/core/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/modules/core/auth/decorators/current-user.decorator';
import { TarefasCatalogoService } from './tarefas-catalogo.service';

@Controller('workshop/tarefas-catalogo')
@UseGuards(JwtAuthGuard)
export class TarefasCatalogoController {
  constructor(private readonly service: TarefasCatalogoService) {}

  @Get()
  findAll(@CurrentUser() user: any, @Query() query: any) {
    return this.service.findAll(user.companyId, query);
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

  // ── Subtarefas ────────────────────────────────────────────────────────────

  @Post(':id/subtarefas')
  createSubtarefa(@Param('id') id: string, @Body() body: any) {
    return this.service.createSubtarefa(id, body);
  }

  @Patch('subtarefas/:id')
  updateSubtarefa(@Param('id') id: string, @Body() body: any) {
    return this.service.updateSubtarefa(id, body);
  }

  @Delete('subtarefas/:id')
  deleteSubtarefa(@Param('id') id: string) {
    return this.service.deleteSubtarefa(id);
  }

  // ── Adicionar em OS / OP ──────────────────────────────────────────────────

  @Post('adicionar-na-os')
  adicionarNaOS(@Body() body: { serviceOrderId: string; tarefaCatalogoId: string }) {
    return this.service.adicionarNaOS(body.serviceOrderId, body.tarefaCatalogoId);
  }

  @Post('adicionar-na-op')
  adicionarNaOP(@Body() body: { productionOrderId: string; tarefaCatalogoId: string }) {
    return this.service.adicionarNaOP(body.productionOrderId, body.tarefaCatalogoId);
  }
}
