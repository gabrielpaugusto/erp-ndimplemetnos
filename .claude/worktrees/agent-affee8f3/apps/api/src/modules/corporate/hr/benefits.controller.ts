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
import { BenefitsService } from './benefits.service';
import { CreateBenefitDto } from './dto/create-benefit.dto';
import { UpdateBenefitDto } from './dto/update-benefit.dto';

@Controller('hr/benefits')
@UseGuards(JwtAuthGuard)
export class BenefitsController {
  constructor(private readonly benefitsService: BenefitsService) {}

  @Get()
  findAll(
    @CurrentUser() user: { id: string; companyId: string },
    @Query('type') type?: string,
    @Query('active') active?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.benefitsService.findAll(user.companyId, {
      type,
      active,
      search,
      page,
      limit,
    });
  }

  @Get('summary')
  getSummary(@CurrentUser() user: { id: string; companyId: string }) {
    return this.benefitsService.getSummary(user.companyId);
  }

  @Get('employee/:employeeId')
  getByEmployee(@Param('employeeId') employeeId: string) {
    return this.benefitsService.getByEmployee(employeeId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.benefitsService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateBenefitDto) {
    return this.benefitsService.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateBenefitDto,
  ) {
    return this.benefitsService.update(id, dto);
  }
}
