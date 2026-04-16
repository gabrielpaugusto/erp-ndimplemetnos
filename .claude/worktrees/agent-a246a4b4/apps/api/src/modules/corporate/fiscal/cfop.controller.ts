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
import { CfopService } from './cfop.service';
import { CreateCfopDto } from './dto/create-cfop.dto';
import { UpdateCfopDto } from './dto/update-cfop.dto';

@Controller('fiscal/cfop')
@UseGuards(JwtAuthGuard)
export class CfopController {
  constructor(private readonly cfopService: CfopService) {}

  @Get()
  findAll(
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.cfopService.findAll({ search, page, limit });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.cfopService.findOne(id);
  }

  @Post()
  create(@Body() createCfopDto: CreateCfopDto) {
    return this.cfopService.create(createCfopDto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateCfopDto: UpdateCfopDto) {
    return this.cfopService.update(id, updateCfopDto);
  }
}
