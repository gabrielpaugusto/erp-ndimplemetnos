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

  // ── Sprint 3.3 — Versões de Orçamento ──────────────────────────────────

  /**
   * POST /sales/quotations/:id/nova-versao
   * Cria uma nova versão do orçamento (cópia de todos os itens) com novo numero e versão++.
   */
  @Post(':id/nova-versao')
  novaVersao(
    @CurrentUser() user: { id: string; companyId: string },
    @Param('id') id: string,
  ) {
    return this.quotationsService.novaVersao(id, user.companyId, user.id);
  }

  /**
   * GET /sales/quotations/diff?a=:idA&b=:idB
   * Retorna o diff de itens e valores entre dois orçamentos.
   */
  @Get('diff')
  getDiff(
    @CurrentUser() user: { id: string; companyId: string },
    @Query('a') idA: string,
    @Query('b') idB: string,
  ) {
    return this.quotationsService.getDiff(idA, idB, user.companyId);
  }

  /**
   * GET /sales/quotations/:id/timeline
   */
  @Get(':id/timeline')
  getTimeline(
    @CurrentUser() user: { id: string; companyId: string },
    @Param('id') id: string,
  ) {
    return this.quotationsService.getTimeline(id, user.companyId);
  }
}
