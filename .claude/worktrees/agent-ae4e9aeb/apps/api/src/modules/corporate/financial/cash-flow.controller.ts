import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '@/modules/core/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/modules/core/auth/decorators/current-user.decorator';
import { CashFlowService } from './cash-flow.service';
import { CreateCashFlowDto } from './dto/create-cash-flow.dto';

@Controller('financial/cash-flow')
@UseGuards(JwtAuthGuard)
export class CashFlowController {
  constructor(private readonly cashFlowService: CashFlowService) {}

  @Get()
  findAll(
    @CurrentUser() user: { id: string; companyId: string },
    @Query('type') type?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.cashFlowService.findAll(user.companyId, {
      type,
      dateFrom,
      dateTo,
      page,
      limit,
    });
  }

  @Get('projection')
  getProjection(
    @CurrentUser() user: { id: string; companyId: string },
    @Query('months') months?: string,
  ) {
    return this.cashFlowService.getProjection(user.companyId, { months });
  }

  @Post()
  create(
    @CurrentUser() user: { id: string; companyId: string },
    @Body() dto: CreateCashFlowDto,
  ) {
    return this.cashFlowService.create(user.companyId, dto);
  }

  @Post('generate')
  generateFromMovements(
    @CurrentUser() user: { id: string; companyId: string },
  ) {
    return this.cashFlowService.generateFromMovements(user.companyId);
  }
}
