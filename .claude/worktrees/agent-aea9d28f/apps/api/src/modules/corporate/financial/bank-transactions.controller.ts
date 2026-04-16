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
import { BankTransactionsService } from './bank-transactions.service';
import { CreateBankTransactionDto } from './dto/create-bank-transaction.dto';

@Controller('financial/transactions')
@UseGuards(JwtAuthGuard)
export class BankTransactionsController {
  constructor(
    private readonly transactionsService: BankTransactionsService,
  ) {}

  @Get()
  findAll(
    @CurrentUser() user: { id: string; companyId: string },
    @Query('bankAccountId') bankAccountId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.transactionsService.findAll(user.companyId, {
      bankAccountId,
      dateFrom,
      dateTo,
      search,
      page,
      limit,
    });
  }

  @Get('statement')
  getStatement(
    @CurrentUser() user: { id: string; companyId: string },
    @Query('bankAccountId') bankAccountId: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.transactionsService.getStatement(user.companyId, {
      bankAccountId,
      dateFrom,
      dateTo,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.transactionsService.findOne(id);
  }

  @Post()
  create(
    @CurrentUser() user: { id: string; companyId: string },
    @Body() dto: CreateBankTransactionDto,
  ) {
    return this.transactionsService.create(user.companyId, dto);
  }

  @Patch(':id/reconcile')
  reconcile(@Param('id') id: string) {
    return this.transactionsService.reconcile(id);
  }
}
