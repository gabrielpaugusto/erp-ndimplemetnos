import { Module } from '@nestjs/common';
import { ApprovalModule } from '@/modules/corporate/approvals/approval.module';
import { EmployeesService } from './employees.service';
import { EmployeesController } from './employees.controller';
import { PayrollService } from './payroll.service';
import { PayrollController } from './payroll.controller';
import { PayrollConfigService } from './payroll-config.service';
import { PayrollConfigController } from './payroll-config.controller';
import { BenefitsService } from './benefits.service';
import { BenefitsController } from './benefits.controller';
import { JornadaService } from './jornada.service';
import { JornadaController } from './jornada.controller';

@Module({
  imports: [ApprovalModule],
  controllers: [
    EmployeesController,
    PayrollController,
    PayrollConfigController,
    BenefitsController,
    JornadaController,
  ],
  providers: [
    EmployeesService,
    PayrollService,
    PayrollConfigService,
    BenefitsService,
    JornadaService,
  ],
})
export class HrModule {}
