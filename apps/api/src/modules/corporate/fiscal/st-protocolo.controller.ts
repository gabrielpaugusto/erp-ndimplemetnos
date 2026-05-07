import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/modules/core/auth/guards/jwt-auth.guard';
import { StProtocoloService } from './st-protocolo.service';
import { STDetectorService, STDetectorInput } from './st-detector.service';

@Controller('fiscal/st-protocolo')
@UseGuards(JwtAuthGuard)
export class StProtocoloController {
  constructor(
    private readonly service: StProtocoloService,
    private readonly detector: STDetectorService,
  ) {}

  @Get()
  findAll(
    @Query('ufOrigem') ufOrigem?: string,
    @Query('ufDestino') ufDestino?: string,
    @Query('ncm') ncm?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.findAll({ ufOrigem, ufDestino, ncm, search, page, limit });
  }

  @Get('buscar-mva')
  buscarMva(
    @Query('ufOrigem') ufOrigem: string,
    @Query('ufDestino') ufDestino: string,
    @Query('ncm') ncm: string,
  ) {
    return this.service.buscarMva(ufOrigem, ufDestino, ncm);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  // ── Detector de ST ───────────────────────────────────────────────────────
  // POST /fiscal/st-protocolo/detectar
  // Detecta se uma operação está sujeita à ST e calcula BC-ST, ICMS-ST, MVA.
  // Body: STDetectorInput

  @Post('detectar')
  detectar(@Body() body: STDetectorInput) {
    return this.detector.detectar({
      ...body,
      dataEmissao: body.dataEmissao ? new Date(body.dataEmissao) : new Date(),
    });
  }

  // ── Utilitários de cálculo ────────────────────────────────────────────────

  @Get('mva-ajustado')
  mvaAjustado(
    @Query('mvaOriginal') mvaOriginal: string,
    @Query('aliqInter')   aliqInter: string,
    @Query('aliqIntra')   aliqIntra: string,
  ) {
    const mvaAj = this.detector.calcularMvaAjustado(
      Number(mvaOriginal), Number(aliqInter), Number(aliqIntra),
    );
    return {
      mvaOriginal:  Number(mvaOriginal),
      aliqInter:    Number(aliqInter),
      aliqIntra:    Number(aliqIntra),
      mvaAjustado:  mvaAj,
      formula:      `[(1 + ${mvaOriginal}%) × (1 − ${aliqInter}%) / (1 − ${aliqIntra}%)] − 1`,
    };
  }

  @Get('aliquotas')
  aliquotas(
    @Query('ufDestino') ufDestino: string,
    @Query('importado') importado?: string,
  ) {
    return {
      ufDestino:             ufDestino?.toUpperCase(),
      aliquotaInterestadual: this.detector.aliquotaInterestadual(ufDestino, importado === 'true'),
      aliquotaInternaDestino: this.detector.aliquotaInternaDestino(ufDestino),
    };
  }

  // ── Seed FiscalBrain ──────────────────────────────────────────────────────
  // POST /fiscal/st-protocolo/seed-brain
  // Popula a tabela com os protocolos base (Protocolo 41/2008 + ST interna SP).
  // Idempotente — pode ser chamado múltiplas vezes sem duplicar registros.

  @Post('seed-brain')
  seedProtocolosBase() {
    return this.service.seedProtocolosBase();
  }

  @Post()
  create(@Body() body: any) {
    return this.service.create(body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.service.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
