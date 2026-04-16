import { Module } from '@nestjs/common';
import { BankAccountsService } from './bank-accounts.service';
import { BankAccountsController } from './bank-accounts.controller';
import { FinancialMovementsService } from './financial-movements.service';
import { FinancialMovementsController } from './financial-movements.controller';
import { BankTransactionsService } from './bank-transactions.service';
import { BankTransactionsController } from './bank-transactions.controller';
import { CashFlowService } from './cash-flow.service';
import { CashFlowController } from './cash-flow.controller';

@Module({
  controllers: [
    BankAccountsController,
    FinancialMovementsController,
    BankTransactionsController,
    CashFlowController,
  ],
  providers: [
    BankAccountsService,
    FinancialMovementsService,
    BankTransactionsService,
    CashFlowService,
  ],
})
export class FinancialModule {}
