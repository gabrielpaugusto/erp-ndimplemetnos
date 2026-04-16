import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '@/modules/core/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/modules/core/auth/decorators/current-user.decorator';
import { StockMovementsService } from './stock-movements.service';
import { CreateStockMovementDto } from './dto/create-stock-movement.dto';

@Controller('inventory/movements')
@UseGuards(JwtAuthGuard)
export class StockMovementsController {
  constructor(private readonly stockMovementsService: StockMovementsService) {}

  @Get()
  findAll(
    @CurrentUser() user: { id: string; companyId: string },
    @Query('productId') productId?: string,
    @Query('locationId') locationId?: string,
    @Query('type') type?: string,
    @Query('source') source?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.stockMovementsService.findAll(user.companyId, {
      productId,
      locationId,
      type,
      source,
      startDate,
      endDate,
      page,
      limit,
    });
  }

  @Get('stats')
  getStats(@CurrentUser() user: { id: string; companyId: string }) {
    return this.stockMovementsService.getStats(user.companyId);
  }

  @Get('product/:productId')
  getByProduct(
    @Param('productId') productId: string,
    @CurrentUser() user: { id: string; companyId: string },
  ) {
    return this.stockMovementsService.getByProduct(productId, user.companyId);
  }

  @Post()
  create(
    @CurrentUser() user: { id: string; companyId: string },
    @Body() dto: CreateStockMovementDto,
  ) {
    return this.stockMovementsService.create(user.companyId, user.id, dto);
  }
}
