import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '@/modules/core/auth/guards/jwt-auth.guard';
import { CbenefService, CreateCbenefDto } from './cbenef.service';

@UseGuards(JwtAuthGuard)
@Controller('fiscal/cbenef')
export class CbenefController {
  constructor(private readonly svc: CbenefService) {}

  @Get()
  findAll(
    @Query('uf') uf?: string,
    @Query('tipo') tipo?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.findAll({ uf, tipo, search, page, limit });
  }

  @Get('sugerir')
  sugerir(@Query('uf') uf: string, @Query('ncm') ncm: string) {
    return this.svc.sugerirParaNcm(uf, ncm);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateCbenefDto) {
    return this.svc.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: Partial<CreateCbenefDto>) {
    return this.svc.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }
}
