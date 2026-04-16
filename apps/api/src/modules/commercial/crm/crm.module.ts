import { Module } from '@nestjs/common';
import { CrmService } from './crm.service';
import { CrmController } from './crm.controller';
import { PersonsController } from './persons.controller';
import { PersonsService } from './persons.service';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';

@Module({
  controllers: [CrmController, PersonsController, LeadsController],
  providers: [CrmService, PersonsService, LeadsService],
  exports: [PersonsService, LeadsService],
})
export class CrmModule {}
