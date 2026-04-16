import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '@/modules/core/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/modules/core/auth/decorators/current-user.decorator';
import { EcoService } from './eco.service';
import { CreateEcoDto, UpdateEcoStatusDto } from './dto/create-eco.dto';

@Controller('engineering/ecos')
@UseGuards(JwtAuthGuard)
export class EcoController {
  constructor(private readonly ecoService: EcoService) {}

  @Get()
  findAll(
    @CurrentUser() user: { id: string; companyId: string },
    @Query('status') status?: string,
    @Query('tipo') tipo?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.ecoService.findAll(user.companyId, { status, tipo, page, limit });
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: { id: string; companyId: string },
    @Param('id') id: string,
  ) {
    return this.ecoService.findOne(id, user.companyId);
  }

  @Post()
  create(
    @CurrentUser() user: { id: string; companyId: string },
    @Body() dto: CreateEcoDto,
  ) {
    return this.ecoService.create(user.companyId, user.id, dto);
  }

  @Patch(':id/status')
  updateStatus(
    @CurrentUser() user: { id: string; companyId: string },
    @Param('id') id: string,
    @Body() dto: UpdateEcoStatusDto,
  ) {
    return this.ecoService.updateStatus(id, user.companyId, user.id, dto);
  }
}
