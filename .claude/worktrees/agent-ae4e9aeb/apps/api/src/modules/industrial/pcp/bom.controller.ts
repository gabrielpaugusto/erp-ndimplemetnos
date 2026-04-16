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
import { BomService } from './bom.service';
import { CreateBomDto } from './dto/create-bom.dto';
import { UpdateBomDto } from './dto/update-bom.dto';

@Controller('pcp/bom')
@UseGuards(JwtAuthGuard)
export class BomController {
  constructor(private readonly bomService: BomService) {}

  @Get()
  findAll(
    @CurrentUser() user: { id: string; companyId: string },
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.bomService.findAll(user.companyId, {
      search,
      page,
      limit,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.bomService.findOne(id);
  }

  @Get(':id/explode')
  explode(@Param('id') id: string) {
    return this.bomService.explode(id);
  }

  @Post()
  create(
    @CurrentUser() user: { id: string; companyId: string },
    @Body() createBomDto: CreateBomDto,
  ) {
    return this.bomService.create(user.companyId, createBomDto);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateBomDto: UpdateBomDto,
  ) {
    return this.bomService.update(id, updateBomDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.bomService.remove(id);
  }
}
