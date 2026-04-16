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
import { LeadsService } from './leads.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { CreateActivityDto } from './dto/create-activity.dto';

@Controller('crm/leads')
@UseGuards(JwtAuthGuard)
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Get()
  findAll(
    @CurrentUser() user: { id: string; companyId: string },
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('vendedorId') vendedorId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.leadsService.findAll(user.companyId, {
      search,
      status,
      vendedorId,
      page,
      limit,
    });
  }

  @Get('pipeline')
  getPipelineStats(
    @CurrentUser() user: { id: string; companyId: string },
  ) {
    return this.leadsService.getPipelineStats(user.companyId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.leadsService.findOne(id);
  }

  @Post()
  create(
    @CurrentUser() user: { id: string; companyId: string },
    @Body() createLeadDto: CreateLeadDto,
  ) {
    return this.leadsService.create(user.companyId, user.id, createLeadDto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateLeadDto: UpdateLeadDto) {
    return this.leadsService.update(id, updateLeadDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.leadsService.remove(id);
  }

  @Post(':id/activities')
  addActivity(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; companyId: string },
    @Body() createActivityDto: CreateActivityDto,
  ) {
    return this.leadsService.addActivity(id, user.id, createActivityDto);
  }

  @Get(':id/activities')
  getActivities(@Param('id') id: string) {
    return this.leadsService.getActivities(id);
  }
}
