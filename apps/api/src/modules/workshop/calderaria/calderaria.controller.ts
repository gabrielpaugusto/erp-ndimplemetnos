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
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('serviceType') serviceType?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.calderariaService.findAll(user.companyId, {
      search,
      status,
      serviceType,
      page,
      limit,
    });
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
    @Body() createCalderariaOrderDto: CreateCalderariaOrderDto,
  ) {
    return this.calderariaService.create(
      user.companyId,
      createCalderariaOrderDto,
    );
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateCalderariaOrderDto: UpdateCalderariaOrderDto,
  ) {
    return this.calderariaService.update(id, updateCalderariaOrderDto);
  }

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
