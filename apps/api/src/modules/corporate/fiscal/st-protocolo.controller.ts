import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/modules/core/auth/guards/jwt-auth.guard';
import { StProtocoloService } from './st-protocolo.service';

@Controller('fiscal/st-protocolo')
@UseGuards(JwtAuthGuard)
export class StProtocoloController {
  constructor(private readonly service: StProtocoloService) {}

  @Get()
  findAll(
    @Query('ufOrigem') ufOrigem?: string,
    @Query('ufDestino') ufDestino?: string,
    @Query('ncm') ncm?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.findAll({ ufOrigem, ufDestino, ncm, search, page, limit });
  }

  @Get('buscar-mva')
  buscarMva(
    @Query('ufOrigem') ufOrigem: string,
    @Query('ufDestino') ufDestino: string,
    @Query('ncm') ncm: string,
  ) {
    return this.service.buscarMva(ufOrigem, ufDestino, ncm);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() body: any) {
    return this.service.create(body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.service.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
