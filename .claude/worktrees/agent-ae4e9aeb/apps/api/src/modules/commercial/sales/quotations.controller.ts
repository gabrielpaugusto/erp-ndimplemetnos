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
} from '@nestjs/common';
import { JwtAuthGuard } from '@/modules/core/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/modules/core/auth/decorators/current-user.decorator';
import { QuotationsService } from './quotations.service';
import { CreateQuotationDto } from './dto/create-quotation.dto';
import { UpdateQuotationDto } from './dto/update-quotation.dto';
import { CreateQuotationItemDto } from './dto/create-quotation-item.dto';

@Controller('sales/quotations')
@UseGuards(JwtAuthGuard)
export class QuotationsController {
  constructor(private readonly quotationsService: QuotationsService) {}

  @Get()
  findAll(
    @CurrentUser() user: { id: string; companyId: string },
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('saleType') saleType?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.quotationsService.findAll(user.companyId, {
      search,
      status,
      saleType,
      page,
      limit,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.quotationsService.findOne(id);
  }

  @Post()
  create(
    @CurrentUser() user: { id: string; companyId: string },
    @Body() createQuotationDto: CreateQuotationDto,
  ) {
    return this.quotationsService.create(user.companyId, createQuotationDto);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateQuotationDto: UpdateQuotationDto,
  ) {
    return this.quotationsService.update(id, updateQuotationDto);
  }

  @Post(':id/items')
  addItem(
    @Param('id') id: string,
    @Body() createItemDto: CreateQuotationItemDto,
  ) {
    return this.quotationsService.addItem(id, createItemDto);
  }

  @Delete(':id/items/:itemId')
  removeItem(@Param('itemId') itemId: string) {
    return this.quotationsService.removeItem(itemId);
  }

  @Post(':id/convert')
  convertToSaleOrder(@Param('id') id: string) {
    return this.quotationsService.convertToSaleOrder(id);
  }
}
