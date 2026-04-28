import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/modules/core/auth/guards/jwt-auth.guard';
import { NaturezaJuridicaService } from './natureza-juridica.service';

@Controller('ref-tables/naturezas-juridicas')
@UseGuards(JwtAuthGuard)
export class NaturezaJuridicaController {
  constructor(private readonly service: NaturezaJuridicaService) {}

  @Get()
  findAll(@Query('ativo') ativo?: string) {
    return this.service.findAll({ ativo });
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
}
