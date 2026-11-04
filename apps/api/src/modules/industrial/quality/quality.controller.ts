import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/modules/core/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/modules/core/auth/decorators/current-user.decorator';
import { QualityService } from './quality.service';

@UseGuards(JwtAuthGuard)
@Controller('quality/inspections')
export class QualityController {
  constructor(private readonly service: QualityService) {}

  @Get('stats')
  stats(@CurrentUser() user: any) { return this.service.stats(user.companyId); }

  @Get()
  findAll(@CurrentUser() user: any, @Query() query: any) { return this.service.findAll(user.companyId, query); }

  @Get(':id')
  findOne(@CurrentUser() user: any, @Param('id') id: string) { return this.service.findOne(id, user.companyId); }

  @Post()
  create(@CurrentUser() user: any, @Body() body: any) { return this.service.create(user.companyId, user.id, body); }

  @Patch(':id')
  update(@CurrentUser() user: any, @Param('id') id: string, @Body() body: any) { return this.service.update(id, user.companyId, body); }

  @Delete(':id')
  remove(@CurrentUser() user: any, @Param('id') id: string) { return this.service.remove(id, user.companyId); }
}
