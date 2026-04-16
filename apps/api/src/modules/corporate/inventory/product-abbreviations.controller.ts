import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '@/modules/core/auth/guards/jwt-auth.guard';
import { ProductAbbreviationsService } from './product-abbreviations.service';

@Controller('inventory/abbreviations')
@UseGuards(JwtAuthGuard)
export class ProductAbbreviationsController {
  constructor(private readonly service: ProductAbbreviationsService) {}

  @Get()
  findAll(@Request() req: any, @Query('search') search?: string) {
    return this.service.findAll(req.user.companyId, search);
  }

  @Post()
  create(@Request() req: any, @Body() body: any) {
    return this.service.create(req.user.companyId, body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.service.update(id, body);
  }

  @Post('seed')
  seed(@Request() req: any) {
    return this.service.seedForCompany(req.user.companyId);
  }
}
