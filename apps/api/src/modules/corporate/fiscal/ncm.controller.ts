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
import { NcmService } from './ncm.service';
import { CreateNcmDto } from './dto/create-ncm.dto';
import { UpdateNcmDto } from './dto/update-ncm.dto';

@Controller('fiscal/ncm')
@UseGuards(JwtAuthGuard)
export class NcmController {
  constructor(private readonly ncmService: NcmService) {}

  @Get()
  findAll(
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.ncmService.findAll({ search, page, limit });
  }

  @Get('produtos-sem-cest')
  produtosSemCest() {
    return this.ncmService.produtosSemCest();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ncmService.findOne(id);
  }

  @Post()
  create(@Body() createNcmDto: CreateNcmDto) {
    return this.ncmService.create(createNcmDto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateNcmDto: UpdateNcmDto) {
    return this.ncmService.update(id, updateNcmDto);
  }
}
