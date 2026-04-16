import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { NbsService } from './nbs.service';
import { JwtAuthGuard } from '@/modules/core/auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('nbs')
export class NbsController {
  constructor(private readonly nbsService: NbsService) {}

  @Get()
  findAll(@Query('search') search?: string) {
    return this.nbsService.findAll(search);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.nbsService.findOne(id);
  }

  @Post()
  create(
    @Body()
    data: {
      codigo: string;
      descricao: string;
      unidade?: string;
      aliquotaIss?: number;
    },
  ) {
    return this.nbsService.create(data);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body()
    data: Partial<{
      codigo: string;
      descricao: string;
      unidade: string;
      aliquotaIss: number;
      ativo: boolean;
    }>,
  ) {
    return this.nbsService.update(id, data);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.nbsService.remove(id);
  }

  @Post('seed')
  seed() {
    return this.nbsService.seed();
  }
}
