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
import { ProductSuppliersService } from './product-suppliers.service';
import { CreateProductSupplierDto } from './dto/create-product-supplier.dto';
import { UpdateProductSupplierDto } from './dto/update-product-supplier.dto';

@Controller('purchasing/product-suppliers')
@UseGuards(JwtAuthGuard)
export class ProductSuppliersController {
  constructor(private readonly productSuppliersService: ProductSuppliersService) {}

  @Get()
  findAll(
    @CurrentUser() user: { id: string; companyId: string },
    @Query('productId') productId?: string,
    @Query('personId') personId?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.productSuppliersService.findAll(user.companyId, {
      productId,
      personId,
      search,
      page,
      limit,
    });
  }

  @Get('lookup')
  lookup(
    @CurrentUser() user: { id: string; companyId: string },
    @Query('personId') personId: string,
    @Query('code') code: string,
  ) {
    return this.productSuppliersService.findBySupplierCode(
      user.companyId,
      personId,
      code,
    );
  }

  @Get('by-product/:productId')
  findByProduct(
    @CurrentUser() user: { id: string; companyId: string },
    @Param('productId') productId: string,
  ) {
    return this.productSuppliersService.findByProduct(user.companyId, productId);
  }

  @Get('by-supplier/:personId')
  findBySupplier(
    @CurrentUser() user: { id: string; companyId: string },
    @Param('personId') personId: string,
  ) {
    return this.productSuppliersService.findAll(user.companyId, { personId });
  }

  @Post()
  create(
    @CurrentUser() user: { id: string; companyId: string },
    @Body() dto: CreateProductSupplierDto,
  ) {
    return this.productSuppliersService.create(user.companyId, dto);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProductSupplierDto,
  ) {
    return this.productSuppliersService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.productSuppliersService.remove(id);
  }
}
