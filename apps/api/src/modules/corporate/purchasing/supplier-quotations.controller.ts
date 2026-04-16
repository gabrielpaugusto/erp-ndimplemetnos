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
import { SupplierQuotationsService } from './supplier-quotations.service';
import { CreateSupplierQuotationDto } from './dto/create-supplier-quotation.dto';
import { UpdateSupplierQuotationDto } from './dto/update-supplier-quotation.dto';

@Controller('purchasing/quotations')
@UseGuards(JwtAuthGuard)
export class SupplierQuotationsController {
  constructor(private readonly quotationsService: SupplierQuotationsService) {}

  @Get()
  findAll(
    @CurrentUser() user: { id: string; companyId: string },
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('purchaseRequestId') purchaseRequestId?: string,
    @Query('supplierId') supplierId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.quotationsService.findAll(user.companyId, {
      search,
      status,
      purchaseRequestId,
      supplierId,
      page,
      limit,
    });
  }

  @Get('compare/:purchaseRequestId')
  compare(@Param('purchaseRequestId') purchaseRequestId: string) {
    return this.quotationsService.compare(purchaseRequestId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.quotationsService.findOne(id);
  }

  @Post()
  create(
    @CurrentUser() user: { id: string; companyId: string },
    @Body() dto: CreateSupplierQuotationDto,
  ) {
    return this.quotationsService.create(user.companyId, dto);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateSupplierQuotationDto,
  ) {
    return this.quotationsService.update(id, dto);
  }

  @Post(':id/respond')
  respond(@Param('id') id: string) {
    return this.quotationsService.respond(id);
  }

  @Post(':id/approve')
  approve(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; companyId: string },
  ) {
    return this.quotationsService.approve(id, user.companyId);
  }

  @Post(':id/reject')
  reject(@Param('id') id: string) {
    return this.quotationsService.reject(id);
  }
}
