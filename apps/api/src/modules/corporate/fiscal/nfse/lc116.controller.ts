import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/modules/core/auth/guards/jwt-auth.guard';
import { Lc116Service } from './lc116.service';

@Controller('fiscal/lc116')
@UseGuards(JwtAuthGuard)
export class Lc116Controller {
  constructor(private readonly lc116Service: Lc116Service) {}

  @Get()
  findAll(@Query('search') search?: string) {
    return this.lc116Service.findAll(search);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.lc116Service.findOne(id);
  }
}
