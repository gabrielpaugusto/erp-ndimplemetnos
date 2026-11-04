import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '@/modules/core/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/modules/core/auth/decorators/current-user.decorator';
import { FinancialMovementsService } from './financial-movements.service';
import { CreateFinancialMovementDto } from './dto/create-financial-movement.dto';
import { UpdateFinancialMovementDto } from './dto/update-financial-movement.dto';
import { PayMovementDto } from './dto/pay-movement.dto';

@Controller('financial/movements')
@UseGuards(JwtAuthGuard)
export class FinancialMovementsController {
  constructor(
    private readonly movementsService: FinancialMovementsService,
  ) {}

  @Get()
  findAll(
    @CurrentUser() user: { id: string; companyId: string },
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('personId') personId?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.movementsService.findAll(user.companyId, {
      type,
      status,
      dateFrom,
      dateTo,
      personId,
      search,
      page,
      limit,
    });
  }

  // export/csv deve vir antes de :id para não ser capturado como id
  @Get('export/csv')
  async exportCsv(
    @CurrentUser() user: { id: string; companyId: string },
    @Query() query: any,
    @Res() res: Response,
  ) {
    const csv = await this.movementsService.exportCsv(user.companyId, query);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="movimentos-financeiros.csv"');
    res.send('﻿' + csv);
  }

  @Get('overdue')
  getOverdue(@CurrentUser() user: { id: string; companyId: string }) {
    return this.movementsService.getOverdue(user.companyId);
  }

  @Get('stats')
  getStats(@CurrentUser() user: { id: string; companyId: string }) {
    return this.movementsService.getStats(user.companyId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: { id: string; companyId: string }) {
    return this.movementsService.findOne(id, user.companyId);
  }

  @Post()
  create(
    @CurrentUser() user: { id: string; companyId: string },
    @Body() dto: CreateFinancialMovementDto,
  ) {
    return this.movementsService.create(user.companyId, dto);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateFinancialMovementDto,
  ) {
    return this.movementsService.update(id, dto);
  }

  @Post(':id/pay')
  pay(
    @Param('id') id: string,
    @Body() dto: PayMovementDto,
    @CurrentUser() user: { id: string; companyId: string },
  ) {
    return this.movementsService.pay(id, dto, user.id, user.companyId);
  }

  @Post('installments')
  generateInstallments(
    @CurrentUser() user: { id: string; companyId: string },
    @Body() dto: CreateFinancialMovementDto & { installments: number },
  ) {
    return this.movementsService.generateInstallments(user.companyId, dto);
  }
}
