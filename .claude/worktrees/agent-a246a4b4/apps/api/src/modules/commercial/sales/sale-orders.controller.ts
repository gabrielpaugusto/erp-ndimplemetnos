import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '@/modules/core/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/modules/core/auth/decorators/current-user.decorator';
import { SaleOrdersService } from './sale-orders.service';
import { CreateSaleOrderDto } from './dto/create-sale-order.dto';
import { UpdateSaleOrderDto } from './dto/update-sale-order.dto';
import { CreateSaleOrderItemDto } from './dto/create-sale-order-item.dto';

@Controller('sales/orders')
@UseGuards(JwtAuthGuard)
export class SaleOrdersController {
  constructor(private readonly saleOrdersService: SaleOrdersService) {}

  @Get()
  findAll(
    @CurrentUser() user: { id: string; companyId: string },
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('saleType') saleType?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.saleOrdersService.findAll(user.companyId, {
      search,
      status,
      saleType,
      page,
      limit,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.saleOrdersService.findOne(id);
  }

  @Post()
  create(
    @CurrentUser() user: { id: string; companyId: string },
    @Body() createSaleOrderDto: CreateSaleOrderDto,
  ) {
    return this.saleOrdersService.create(user.companyId, createSaleOrderDto);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateSaleOrderDto: UpdateSaleOrderDto,
  ) {
    return this.saleOrdersService.update(id, updateSaleOrderDto);
  }

  @Post(':id/approve')
  approve(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; companyId: string },
  ) {
    return this.saleOrdersService.approve(id, user.id);
  }

  @Post(':id/cancel')
  cancel(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; companyId: string },
  ) {
    return this.saleOrdersService.cancel(id, user.id);
  }

  @Post(':id/items')
  addItem(
    @Param('id') id: string,
    @Body() createItemDto: CreateSaleOrderItemDto,
  ) {
    return this.saleOrdersService.addItem(id, createItemDto);
  }

  @Delete(':id/items/:itemId')
  removeItem(@Param('itemId') itemId: string) {
    return this.saleOrdersService.removeItem(itemId);
  }

  /**
   * POST /sales/orders/:id/faturar
   * Body: { nfeId: string }
   * Marks the order as FATURADO and triggers automated integrations.
   */
  @Post(':id/faturar')
  @HttpCode(HttpStatus.OK)
  faturar(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; companyId: string },
    @Body() body: { nfeId: string },
  ) {
    return this.saleOrdersService.faturar(user.companyId, id, body.nfeId, user.id);
  }
}
