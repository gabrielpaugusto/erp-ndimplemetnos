import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '@/modules/core/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/modules/core/auth/decorators/current-user.decorator';
import { StockBalancesService } from './stock-balances.service';

@Controller('inventory/balances')
@UseGuards(JwtAuthGuard)
export class StockBalancesController {
  constructor(private readonly stockBalancesService: StockBalancesService) {}

  @Get()
  findAll(
    @CurrentUser() user: { id: string; companyId: string },
    @Query('locationId') locationId?: string,
    @Query('belowMinStock') belowMinStock?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.stockBalancesService.findAll(user.companyId, {
      locationId,
      belowMinStock,
      search,
      page,
      limit,
    });
  }

  @Get('alerts')
  getAlerts(@CurrentUser() user: { id: string; companyId: string }) {
    return this.stockBalancesService.getAlerts(user.companyId);
  }

  @Get('product/:productId')
  getByProduct(
    @Param('productId') productId: string,
    @CurrentUser() user: { id: string; companyId: string },
  ) {
    return this.stockBalancesService.getByProduct(productId, user.companyId);
  }

  @Post('recalculate')
  recalculate(@CurrentUser() user: { id: string; companyId: string }) {
    return this.stockBalancesService.recalculate(user.companyId);
  }
}
