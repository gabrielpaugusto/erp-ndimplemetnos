import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '@/modules/core/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/modules/core/auth/decorators/current-user.decorator';
import { NfeService } from './nfe.service';
import { DanfeService } from './danfe.service';
import { DifalService } from './difal.service';
import { CreateNfeDto } from './dto/create-nfe.dto';
import { UpdateNfeDto, CancelNfeDto } from './dto/update-nfe.dto';

@Controller('fiscal/nfe')
@UseGuards(JwtAuthGuard)
export class NfeController {
  constructor(
    private readonly nfeService: NfeService,
    private readonly danfeService: DanfeService,
    private readonly difalService: DifalService,
  ) {}

  /**
   * Retorna alíquotas internas de ICMS por UF para uso no frontend.
   * DEVE ficar antes de @Get(':id') para não ser capturado como id.
   */
  @Get('aliquotas-uf')
  async getAliquotasUf() {
    return this.difalService['prisma'].aliquotaIcmsUf.findMany({
      where: { active: true },
      orderBy: { uf: 'asc' },
      select: { uf: true, nome: true, aliquotaPadrao: true, aliquotaFcp: true, regiao: true },
    });
  }

  @Get('stats')
  getStats(
    @CurrentUser() user: { companyId: string; id: string },
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.nfeService.getStats(user.companyId, { startDate, endDate });
  }

  @Get()
  findAll(
    @CurrentUser() user: { companyId: string; id: string },
    @Query('search') search?: string,
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('operation') operation?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.nfeService.findAll(user.companyId, {
      search,
      type,
      status,
      operation,
      startDate,
      endDate,
      page,
      limit,
    });
  }

  // DANFE deve vir antes de :id para não ser capturado como id
  @Get(':id/danfe')
  async getDanfe(@Param('id') id: string, @Res() res: Response) {
    const pdfBuffer = await this.danfeService.generateDanfe(id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="DANFE-${id}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });
    res.end(pdfBuffer);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.nfeService.findOne(id);
  }

  @Post()
  create(
    @CurrentUser() user: { companyId: string; id: string },
    @Body() createNfeDto: CreateNfeDto,
  ) {
    return this.nfeService.create(user.companyId, createNfeDto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateNfeDto: UpdateNfeDto) {
    return this.nfeService.update(id, updateNfeDto);
  }

  @Post(':id/calculate-taxes')
  calculateTaxes(@Param('id') id: string) {
    return this.nfeService.calculateTaxes(id);
  }

  @Post(':id/validate')
  validate(@Param('id') id: string) {
    return this.nfeService.validate(id);
  }

  @Post(':id/authorize')
  authorize(@Param('id') id: string) {
    return this.nfeService.transmit(id);
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string, @Body() cancelDto: CancelNfeDto) {
    return this.nfeService.cancel(id, cancelDto.motivo);
  }

  /**
   * Calcular DIFAL para uma operação interestadual.
   * DEVE ficar antes de @Post(':id/...') — sem prefixo :id, sem conflito.
   * Body: { valorBc, aliqInterestadual, ufOrigem, ufDestino }
   */
  @Post('difal/calcular')
  calcularDifal(
    @Body()
    body: {
      valorBc: number;
      aliqInterestadual: number;
      ufOrigem: string;
      ufDestino: string;
    },
  ) {
    return this.difalService.calcularDifal({
      valorBc: body.valorBc,
      aliqInterestadual: body.aliqInterestadual,
      ufOrigem: body.ufOrigem,
      ufDestino: body.ufDestino,
      dataOperacao: new Date(),
    });
  }

  /**
   * Emitir Carta de Correção Eletrônica (CC-e).
   * Body: { descricaoCorrecao }
   */
  @Post(':id/cce')
  emitirCce(
    @Param('id') id: string,
    @Body() body: { descricaoCorrecao: string },
  ) {
    return this.nfeService.emitirCce(id, body.descricaoCorrecao);
  }
}
