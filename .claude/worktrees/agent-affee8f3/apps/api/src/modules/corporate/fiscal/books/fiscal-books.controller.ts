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
import { FiscalBooksService } from './fiscal-books.service';
import { CreateFiscalEntryDto } from './dto/create-fiscal-entry.dto';
import { CreateApuracaoDto, CloseApuracaoDto } from './dto/create-apuracao.dto';

@Controller('fiscal/books')
@UseGuards(JwtAuthGuard)
export class FiscalBooksController {
  constructor(private readonly fiscalBooksService: FiscalBooksService) {}

  @Get('entries')
  getEntries(
    @CurrentUser() user: { companyId: string; id: string },
    @Query('periodoReferencia') periodoReferencia?: string,
    @Query('bookType') bookType?: string,
    @Query('taxType') taxType?: string,
    @Query('type') type?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.fiscalBooksService.getEntries(user.companyId, {
      periodoReferencia,
      bookType,
      taxType,
      type,
      page,
      limit,
    });
  }

  @Post('entries')
  createEntry(
    @CurrentUser() user: { companyId: string; id: string },
    @Body() dto: CreateFiscalEntryDto,
  ) {
    return this.fiscalBooksService.createEntry(user.companyId, dto);
  }

  @Get('apuracao')
  getApuracao(
    @CurrentUser() user: { companyId: string; id: string },
    @Query('periodoReferencia') periodoReferencia: string,
    @Query('taxType') taxType: string,
  ) {
    return this.fiscalBooksService.getApuracao(
      user.companyId,
      periodoReferencia,
      taxType,
    );
  }

  @Post('apuracao/calculate')
  calculateApuracao(
    @CurrentUser() user: { companyId: string; id: string },
    @Body() dto: CreateApuracaoDto,
  ) {
    return this.fiscalBooksService.calculateApuracao(user.companyId, dto);
  }

  @Get('calendario-obrigacoes')
  getCalendarioObrigacoes(
    @CurrentUser() user: { companyId: string; id: string },
    @Query('ano') ano?: string,
  ) {
    return this.fiscalBooksService.getCalendarioObrigacoes(
      user.companyId,
      ano ? parseInt(ano, 10) : new Date().getFullYear(),
    );
  }

  @Get('apuracao-pis-cofins')
  getApuracaoPisCofins(
    @CurrentUser() user: { companyId: string; id: string },
    @Query('periodoReferencia') periodoReferencia: string,
  ) {
    return this.fiscalBooksService.getApuracaoPisCofins(
      user.companyId,
      periodoReferencia ?? new Date().toISOString().slice(0, 7),
    );
  }

  @Get('mapa-cfop')
  getMapaCfop(
    @CurrentUser() user: { companyId: string; id: string },
    @Query('periodoReferencia') periodoReferencia?: string,
    @Query('bookType') bookType?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.fiscalBooksService.getMapaCfop(user.companyId, {
      periodoReferencia,
      bookType,
      startDate,
      endDate,
    });
  }

  @Post('apuracao/close')
  closeApuracao(
    @CurrentUser() user: { companyId: string; id: string },
    @Body() dto: CloseApuracaoDto,
  ) {
    return this.fiscalBooksService.closeApuracao(
      user.companyId,
      dto.periodoReferencia,
      dto.taxType,
    );
  }
}
