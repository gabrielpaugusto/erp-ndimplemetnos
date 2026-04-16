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
import { ProductionOrdersService } from './production-orders.service';
import { CreateProductionOrderDto } from './dto/create-production-order.dto';
import { UpdateProductionOrderDto } from './dto/update-production-order.dto';

@Controller('production/orders')
@UseGuards(JwtAuthGuard)
export class ProductionOrdersController {
  constructor(
    private readonly productionOrdersService: ProductionOrdersService,
  ) {}

  @Get()
  findAll(
    @CurrentUser() user: { id: string; companyId: string },
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('strategy') strategy?: string,
    @Query('type') type?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.productionOrdersService.findAll(user.companyId, {
      search,
      status,
      strategy,
      type,
      startDate,
      endDate,
      page,
      limit,
    });
  }

  @Get('stats')
  getStats(@CurrentUser() user: { id: string; companyId: string }) {
    return this.productionOrdersService.getStats(user.companyId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productionOrdersService.findOne(id);
  }

  @Post()
  create(
    @CurrentUser() user: { id: string; companyId: string },
    @Body() createProductionOrderDto: CreateProductionOrderDto,
  ) {
    return this.productionOrdersService.create(
      user.companyId,
      createProductionOrderDto,
    );
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateProductionOrderDto: UpdateProductionOrderDto,
  ) {
    return this.productionOrdersService.update(id, updateProductionOrderDto);
  }

  @Post(':id/release')
  release(@Param('id') id: string) {
    return this.productionOrdersService.release(id);
  }

  @Post(':id/start')
  start(@Param('id') id: string) {
    return this.productionOrdersService.start(id);
  }

  @Post(':id/complete')
  complete(@Param('id') id: string) {
    return this.productionOrdersService.complete(id);
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string) {
    return this.productionOrdersService.cancel(id);
  }
}
