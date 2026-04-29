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
import { CalderariaService } from './calderaria.service';
import { CreateCalderariaOrderDto } from './dto/create-calderaria-order.dto';
import { UpdateCalderariaOrderDto } from './dto/update-calderaria-order.dto';

@Controller('calderaria')
@UseGuards(JwtAuthGuard)
export class CalderariaController {
  constructor(private readonly calderariaService: CalderariaService) {}

  @Get()
  findAll(
    @CurrentUser() user: { id: string; companyId: string },
    @Query('search')      search?: string,
    @Query('status')      status?: string,
    @Query('serviceType') serviceType?: string,
    @Query('modo')        modo?: string,
    @Query('page')        page?: string,
    @Query('limit')       limit?: string,
  ) {
    return this.calderariaService.findAll(user.companyId, { search, status, serviceType, modo, page, limit });
  }

  @Get('stats')
  getStats(@CurrentUser() user: { id: string; companyId: string }) {
    return this.calderariaService.getStats(user.companyId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.calderariaService.findOne(id);
  }

  @Post()
  create(
    @CurrentUser() user: { id: string; companyId: string },
    @Body() dto: CreateCalderariaOrderDto,
  ) {
    return this.calderariaService.create(user.companyId, dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCalderariaOrderDto) {
    return this.calderariaService.update(id, dto);
  }

  // ── Desenho Excalidraw ────────────────────────────────────────────────────

  @Patch(':id/desenho')
  saveDesenho(
    @Param('id') id: string,
    @Body() body: { desenhoData: any; desenhoPng?: string },
  ) {
    return this.calderariaService.saveDesenho(id, body.desenhoData, body.desenhoPng ?? null);
  }

  // ── Status ────────────────────────────────────────────────────────────────

  @Post(':id/start')
  start(@Param('id') id: string) {
    return this.calderariaService.start(id);
  }

  @Post(':id/complete')
  complete(@Param('id') id: string) {
    return this.calderariaService.complete(id);
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string) {
    return this.calderariaService.cancel(id);
  }
}
