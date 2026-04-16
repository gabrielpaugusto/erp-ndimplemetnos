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
import { PayrollService } from './payroll.service';
import { CreatePayrollDto } from './dto/create-payroll.dto';
import { UpdatePayrollDto } from './dto/update-payroll.dto';

@Controller('hr/payroll')
@UseGuards(JwtAuthGuard)
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  @Get()
  findAll(
    @CurrentUser() user: { id: string; companyId: string },
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.payrollService.findAll(user.companyId, {
      status,
      type,
      search,
      page,
      limit,
    });
  }

  @Get('stats')
  getStats(@CurrentUser() user: { id: string; companyId: string }) {
    return this.payrollService.getStats(user.companyId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.payrollService.findOne(id);
  }

  @Post()
  create(
    @CurrentUser() user: { id: string; companyId: string },
    @Body() dto: CreatePayrollDto,
  ) {
    return this.payrollService.create(user.companyId, dto);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePayrollDto,
  ) {
    return this.payrollService.update(id, dto);
  }

  @Post(':id/calculate')
  calculate(@Param('id') id: string) {
    return this.payrollService.calculate(id);
  }

  @Post(':id/approve')
  approve(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; companyId: string },
  ) {
    return this.payrollService.approve(id, user.id, user.companyId);
  }

  @Post(':id/pay')
  pay(@Param('id') id: string) {
    return this.payrollService.pay(id);
  }
}
