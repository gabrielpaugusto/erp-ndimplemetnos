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
import { CurrentUser } from '@/modules/core/auth/decorators/current-user.decorator';
import { CteService } from './cte.service';
import { CreateCteDto } from './dto/create-cte.dto';

@Controller('purchasing/cte')
@UseGuards(JwtAuthGuard)
export class CteController {
  constructor(private readonly cteService: CteService) {}

  @Get('stats')
  getStats(
    @CurrentUser() user: { companyId: string; id: string },
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.cteService.getStats(user.companyId, { startDate, endDate });
  }

  @Get()
  findAll(
    @CurrentUser() user: { companyId: string; id: string },
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.cteService.findAll(user.companyId, { search, status, startDate, endDate, page, limit });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.cteService.findOne(id);
  }

  @Post()
  create(
    @CurrentUser() user: { companyId: string; id: string },
    @Body() dto: CreateCteDto,
  ) {
    return this.cteService.create(user.companyId, dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: Partial<CreateCteDto>) {
    return this.cteService.update(id, dto);
  }

  /** Manifestação do destinatário (ciência, confirmação, etc.) */
  @Post(':id/manifestar')
  manifestar(
    @Param('id') id: string,
    @Body() body: { tipo: 'CIENCIA' | 'CONFIRMACAO' | 'DESCONHECIMENTO' | 'NAO_REALIZADO' },
  ) {
    return this.cteService.manifestar(id, body.tipo);
  }

  /**
   * Escriturar o CT-e: dispara todas as integrações
   *  - Crédito ICMS no livro fiscal
   *  - Título no Contas a Pagar
   *  - Rateio do custo nos itens da NF-e vinculada
   *  - Lançamento contábil
   */
  @Post(':id/escriturar')
  escriturar(
    @Param('id') id: string,
    @CurrentUser() user: { companyId: string; id: string },
  ) {
    return this.cteService.escriturar(id, user.id);
  }

  /** Cancelar CT-e com motivo */
  @Post(':id/cancelar')
  cancelar(
    @Param('id') id: string,
    @Body() body: { motivo: string },
  ) {
    return this.cteService.cancelar(id, body.motivo);
  }
}
