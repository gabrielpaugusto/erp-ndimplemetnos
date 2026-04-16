import { Module } from '@nestjs/common';
import { FiService } from './fi.service';
import { FiController } from './fi.controller';
import { FinancingController } from './financing.controller';
import { FinancingService } from './financing.service';
import { ConsortiumController } from './consortium.controller';
import { ConsortiumService } from './consortium.service';
import { InsuranceController } from './insurance.controller';
import { InsuranceService } from './insurance.service';

@Module({
  controllers: [FiController, FinancingController, ConsortiumController, InsuranceController],
  providers: [FiService, FinancingService, ConsortiumService, InsuranceService],
  exports: [FinancingService, ConsortiumService, InsuranceService],
})
export class FiModule {}
