import {
  Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '@/modules/core/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/modules/core/auth/decorators/current-user.decorator';
import { JornadaService } from './jornada.service';
import { CreateJornadaDto } from './dto/create-jornada.dto';
import { CreateFeriadoDto } from './dto/create-feriado.dto';

@Controller('hr/jornada')
@UseGuards(JwtAuthGuard)
export class JornadaController {
  constructor(private readonly jornadaService: JornadaService) {}

  // ── Jornadas ───────────────────────────────────────────────────────────────

  @Get()
  findAll(@CurrentUser() user: any) {
    return this.jornadaService.findAllJornadas(user.companyId);
  }

  @Post()
  create(@CurrentUser() user: any, @Body() dto: CreateJornadaDto) {
    return this.jornadaService.createJornada(user.companyId, dto);
  }

  @Put(':id')
  update(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: Partial<CreateJornadaDto>) {
    return this.jornadaService.updateJornada(user.companyId, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.jornadaService.removeJornada(user.companyId, id);
  }

  // ── Feriados ───────────────────────────────────────────────────────────────

  @Get('feriados')
  findFeriados(@CurrentUser() user: any, @Query('ano') ano?: string) {
    return this.jornadaService.findFeriados(user.companyId, ano);
  }

  @Post('feriados')
  createFeriado(@CurrentUser() user: any, @Body() dto: CreateFeriadoDto) {
    return this.jornadaService.createFeriado(user.companyId, dto);
  }

  @Delete('feriados/:id')
  removeFeriado(@CurrentUser() user: any, @Param('id') id: string) {
    return this.jornadaService.removeFeriado(user.companyId, id);
  }

  // ── Carga Horária ──────────────────────────────────────────────────────────

  @Get('carga-horaria')
  cargaHoraria(@CurrentUser() user: any, @Query('mes') mes?: string) {
    const mesRef = mes ?? new Date().toISOString().slice(0, 7);
    return this.jornadaService.calcularCargaMensal(user.companyId, mesRef);
  }
}
