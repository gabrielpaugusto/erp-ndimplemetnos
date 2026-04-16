import { Module } from '@nestjs/common';
import { ApprovalModule } from '@/modules/corporate/approvals/approval.module';
import { BankAccountsService } from './bank-accounts.service';
import { BankAccountsController } from './bank-accounts.controller';
import { FinancialMovementsService } from './financial-movements.service';
import { FinancialMovementsController } from './financial-movements.controller';
import { BankTransactionsService } from './bank-transactions.service';
import { BankTransactionsController } from './bank-transactions.controller';
import { CashFlowService } from './cash-flow.service';
import { CashFlowController } from './cash-flow.controller';
import { AdiantamentosService } from './adiantamentos.service';
import { AdiantamentosController } from './adiantamentos.controller';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';

@Module({
  imports: [ApprovalModule],
  controllers: [
    BankAccountsController,
    FinancialMovementsController,
    BankTransactionsController,
    CashFlowController,
    AdiantamentosController,
    DashboardController,   // Sprint 4.1
  ],
  providers: [
    BankAccountsService,
    FinancialMovementsService,
    BankTransactionsService,
    CashFlowService,
    AdiantamentosService,
    DashboardService,      // Sprint 4.1
  ],
})
export class FinancialModule {}
