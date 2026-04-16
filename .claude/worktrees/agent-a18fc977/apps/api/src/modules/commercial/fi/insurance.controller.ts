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
import { InsuranceService } from './insurance.service';
import { CreateInsuranceDto } from './dto/create-insurance.dto';
import { UpdateInsuranceDto } from './dto/update-insurance.dto';

@Controller('fi/insurance')
@UseGuards(JwtAuthGuard)
export class InsuranceController {
  constructor(private readonly insuranceService: InsuranceService) {}

  @Get()
  findAll(
    @CurrentUser() user: { id: string; companyId: string },
    @Query('search') search?: string,
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.insuranceService.findAll(user.companyId, {
      search,
      type,
      status,
      page,
      limit,
    });
  }

  @Get('stats')
  getStats(@CurrentUser() user: { id: string; companyId: string }) {
    return this.insuranceService.getStats(user.companyId);
  }

  @Get('expiring')
  getExpiringPolicies(
    @CurrentUser() user: { id: string; companyId: string },
    @Query('days') days?: string,
  ) {
    return this.insuranceService.getExpiringPolicies(
      user.companyId,
      parseInt(days || '30', 10),
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.insuranceService.findOne(id);
  }

  @Post()
  create(
    @CurrentUser() user: { id: string; companyId: string },
    @Body() createInsuranceDto: CreateInsuranceDto,
  ) {
    return this.insuranceService.create(user.companyId, createInsuranceDto);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateInsuranceDto: UpdateInsuranceDto,
  ) {
    return this.insuranceService.update(id, updateInsuranceDto);
  }
}
