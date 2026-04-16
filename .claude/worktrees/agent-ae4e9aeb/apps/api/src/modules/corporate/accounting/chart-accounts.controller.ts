import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '@/modules/core/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/modules/core/auth/decorators/current-user.decorator';
import { ChartAccountsService } from './chart-accounts.service';
import { CreateChartAccountDto } from './dto/create-chart-account.dto';
import { UpdateChartAccountDto } from './dto/update-chart-account.dto';

@Controller('accounting/chart')
@UseGuards(JwtAuthGuard)
export class ChartAccountsController {
  constructor(private readonly chartAccountsService: ChartAccountsService) {}

  @Get()
  findAll(
    @CurrentUser() user: { id: string; companyId: string },
    @Query('type') type?: string,
    @Query('nature') nature?: string,
    @Query('level') level?: string,
    @Query('active') active?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.chartAccountsService.findAll(user.companyId, {
      type,
      nature,
      level,
      active,
      search,
      page,
      limit,
    });
  }

  @Get('tree')
  findTree(@CurrentUser() user: { id: string; companyId: string }) {
    return this.chartAccountsService.findTree(user.companyId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.chartAccountsService.findOne(id);
  }

  @Post()
  create(
    @CurrentUser() user: { id: string; companyId: string },
    @Body() createChartAccountDto: CreateChartAccountDto,
  ) {
    return this.chartAccountsService.create(
      user.companyId,
      createChartAccountDto,
    );
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateChartAccountDto: UpdateChartAccountDto,
  ) {
    return this.chartAccountsService.update(id, updateChartAccountDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.chartAccountsService.remove(id);
  }
}
