import { Module } from '@nestjs/common';
import { ChartAccountsService } from './chart-accounts.service';
import { ChartAccountsController } from './chart-accounts.controller';
import { JournalEntriesService } from './journal-entries.service';
import { JournalEntriesController } from './journal-entries.controller';
import { DreService } from './dre.service';
import { DreController } from './dre.controller';

@Module({
  controllers: [ChartAccountsController, JournalEntriesController, DreController],
  providers: [ChartAccountsService, JournalEntriesService, DreService],
  exports: [ChartAccountsService, JournalEntriesService, DreService],
})
export class AccountingModule {}
