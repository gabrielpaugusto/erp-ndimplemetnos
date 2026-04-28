import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
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
  findAll(@CurrentUser() user: any, @Query() query: any) {
    return this.serviceOrderService.findAll(user.companyId, query);
  }

  @Get('stats')
  getStats(@CurrentUser() user: any) {
    return this.serviceOrderService.getStats(user.companyId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.serviceOrderService.findOne(id);
  }

  @Post()
  create(@CurrentUser() user: any, @Body() dto: CreateServiceOrderDto) {
    return this.serviceOrderService.create(user.companyId, dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateServiceOrderDto) {
    return this.serviceOrderService.update(id, dto);
  }

  // ── Fluxo de Status ───────────────────────────────────────────────────────

  @Post(':id/enviar-aprovacao')
  enviarParaAprovacao(@Param('id') id: string) {
    return this.serviceOrderService.enviarParaAprovacao(id);
  }

  @Post(':id/aprovar')
  aprovar(@Param('id') id: string) {
    return this.serviceOrderService.aprovar(id);
  }

  @Post(':id/iniciar')
  iniciar(@Param('id') id: string) {
    return this.serviceOrderService.iniciar(id);
  }

  @Post(':id/aguardar-pecas')
  aguardarPecas(@Param('id') id: string) {
    return this.serviceOrderService.aguardarPecas(id);
  }

  @Post(':id/retornar-execucao')
  retornarExecucao(@Param('id') id: string) {
    return this.serviceOrderService.retornarExecucao(id);
  }

  @Post(':id/concluir')
  concluir(@Param('id') id: string) {
    return this.serviceOrderService.concluir(id);
  }

  @Post(':id/faturar')
  faturar(@Param('id') id: string) {
    return this.serviceOrderService.faturar(id);
  }

  @Post(':id/venda-perdida')
  vendaPerdida(@Param('id') id: string, @Body('motivo') motivo: string) {
    return this.serviceOrderService.vendaPerdida(id, motivo);
  }

  @Post(':id/cancelar')
  cancelar(@Param('id') id: string) {
    return this.serviceOrderService.cancelar(id);
  }

  // ── Timeline e Reservas ───────────────────────────────────────────────────

  @Get(':id/timeline')
  getTimeline(@CurrentUser() user: any, @Param('id') id: string) {
    return this.serviceOrderService.getTimeline(id, user.companyId);
  }

  @Get(':id/reservas')
  getReservas(@CurrentUser() user: any, @Param('id') id: string) {
    return this.serviceOrderService.getReservas(id, user.companyId);
  }
}
