import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/modules/core/auth/guards/jwt-auth.guard';
import { IcmsInterestadualService } from './icms-interestadual.service';

@Controller('ref-tables/icms-interestadual')
@UseGuards(JwtAuthGuard)
export class IcmsInterestadualController {
  constructor(private readonly service: IcmsInterestadualService) {}

  @Get('consultar')
  consultar(
    @Query('ufOrigem') ufOrigem: string,
    @Query('ufDestino') ufDestino: string,
    @Query('tipo') tipo?: string,
  ) {
    return this.service.findRate(ufOrigem, ufDestino, tipo || 'NORMAL');
  }

  @Get()
  findAll(@Query() query: any) { return this.service.findAll(query); }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Post()
  create(@Body() body: any) { return this.service.create(body); }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any) { return this.service.update(id, body); }
}
