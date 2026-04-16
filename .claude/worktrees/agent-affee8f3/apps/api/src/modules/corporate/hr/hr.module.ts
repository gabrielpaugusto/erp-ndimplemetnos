import { Module } from '@nestjs/common';
import { EmployeesService } from './employees.service';
import { EmployeesController } from './employees.controller';
import { PayrollService } from './payroll.service';
import { PayrollController } from './payroll.controller';
import { BenefitsService } from './benefits.service';
import { BenefitsController } from './benefits.controller';
import { JornadaService } from './jornada.service';
import { JornadaController } from './jornada.controller';

@Module({
  controllers: [
    EmployeesController,
    PayrollController,
    BenefitsController,
    JornadaController,
  ],
  providers: [
    EmployeesService,
    PayrollService,
    BenefitsService,
    JornadaService,
  ],
})
export class HrModule {}
