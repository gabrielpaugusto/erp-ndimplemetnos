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
import { FinancingService } from './financing.service';
import { CreateFinancingDto } from './dto/create-financing.dto';
import { UpdateFinancingDto } from './dto/update-financing.dto';

@Controller('fi/financing')
@UseGuards(JwtAuthGuard)
export class FinancingController {
  constructor(private readonly financingService: FinancingService) {}

  @Get()
  findAll(
    @CurrentUser() user: { id: string; companyId: string },
    @Query('search') search?: string,
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.financingService.findAll(user.companyId, {
      search,
      type,
      status,
      page,
      limit,
    });
  }

  @Get('stats')
  getStats(@CurrentUser() user: { id: string; companyId: string }) {
    return this.financingService.getStats(user.companyId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.financingService.findOne(id);
  }

  @Post()
  create(
    @CurrentUser() user: { id: string; companyId: string },
    @Body() createFinancingDto: CreateFinancingDto,
  ) {
    return this.financingService.create(user.companyId, createFinancingDto);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateFinancingDto: UpdateFinancingDto,
  ) {
    return this.financingService.update(id, updateFinancingDto);
  }
}
