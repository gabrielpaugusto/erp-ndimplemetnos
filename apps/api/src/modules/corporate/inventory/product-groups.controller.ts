import { Controller, Get, Post, Patch, Delete, Param, Body, Request, UseGuards, Query } from '@nestjs/common';
import { JwtAuthGuard } from '@/modules/core/auth/guards/jwt-auth.guard';
import { ProductGroupsService } from './product-groups.service';

@Controller('inventory/product-groups')
@UseGuards(JwtAuthGuard)
export class ProductGroupsController {
  constructor(private readonly service: ProductGroupsService) {}

  @Get()
  findAll(@Request() req: any) {
    return this.service.findAllGroups(req.user.companyId);
  }

  @Get('generate-code')
  generateCode(@Query('subgroupId') subgroupId: string, @Request() req: any) {
    return this.service.generateProductCode(subgroupId, req.user.companyId);
  }

  @Get(':groupId/subgroups')
  findSubgroups(@Param('groupId') groupId: string, @Request() req: any) {
    return this.service.findSubgroupsByGroup(groupId, req.user.companyId);
  }

  @Post()
  createGroup(@Request() req: any, @Body() body: any) {
    return this.service.createGroup(req.user.companyId, body);
  }

  @Post('subgroups')
  createSubgroup(@Request() req: any, @Body() body: any) {
    return this.service.createSubgroup(req.user.companyId, body);
  }

  @Patch(':id')
  updateGroup(@Param('id') id: string, @Body() body: any) {
    return this.service.updateGroup(id, body);
  }

  @Patch('subgroups/:id')
  updateSubgroup(@Param('id') id: string, @Body() body: any) {
    return this.service.updateSubgroup(id, body);
  }

  @Delete(':id')
  deleteGroup(@Param('id') id: string, @Request() req: any) {
    return this.service.deleteGroup(id, req.user.companyId);
  }

  @Delete('subgroups/:id')
  deleteSubgroup(@Param('id') id: string, @Request() req: any) {
    return this.service.deleteSubgroup(id, req.user.companyId);
  }

  @Post('seed')
  seed(@Request() req: any) {
    return this.service.seedForCompany(req.user.companyId);
  }

  @Post('seed-generic-products')
  seedGenericProducts(@Request() req: any) {
    return this.service.seedGenericProducts(req.user.companyId);
  }
}
