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
import { TaxRulesService } from './tax-rules.service';
import { CreateTaxRuleDto } from './dto/create-tax-rule.dto';
import { UpdateTaxRuleDto } from './dto/update-tax-rule.dto';

@Controller('fiscal/tax-rules')
@UseGuards(JwtAuthGuard)
export class TaxRulesController {
  constructor(private readonly taxRulesService: TaxRulesService) {}

  @Get()
  findAll(
    @CurrentUser() user: { companyId: string; id: string },
    @Query('search') search?: string,
    @Query('ncmCode') ncmCode?: string,
    @Query('cfopCode') cfopCode?: string,
    @Query('operation') operation?: string,
    @Query('active') active?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.taxRulesService.findAll(user.companyId, {
      search,
      ncmCode,
      cfopCode,
      operation,
      active,
      page,
      limit,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.taxRulesService.findOne(id);
  }

  @Post()
  create(
    @CurrentUser() user: { companyId: string; id: string },
    @Body() createDto: CreateTaxRuleDto,
  ) {
    return this.taxRulesService.create(user.companyId, createDto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateDto: UpdateTaxRuleDto) {
    return this.taxRulesService.update(id, updateDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.taxRulesService.remove(id);
  }
}
