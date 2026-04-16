import {
  Controller,
  Get,
  Post,
  Query,
  Res,
  UseGuards,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '@/modules/core/auth/guards/jwt-auth.guard';
import { SpedFiscalService } from './sped-fiscal.service';
import { SpedContribuicoesService } from './sped-contribuicoes.service';
import { EcdService } from './ecd.service';
import { EcfService } from './ecf.service';

/**
 * Endpoints para geração e download dos arquivos SPED:
 *  A11 — EFD ICMS/IPI       GET /sped/fiscal
 *  A11 — EFD PIS/COFINS     GET /sped/contribuicoes
 *  A13 — ECD (SPED Contábil) GET /sped/ecd
 *  A13 — ECF                GET /sped/ecf
 */
@Controller('sped')
@UseGuards(JwtAuthGuard)
export class SpedController {
  constructor(
    private readonly spedFiscal: SpedFiscalService,
    private readonly spedContrib: SpedContribuicoesService,
    private readonly ecd: EcdService,
    private readonly ecf: EcfService,
  ) {}

  // ── helpers ────────────────────────────────────────────────────────────────

  private parsePeriodo(
    periodoInicio?: string,
    periodoFim?: string,
  ): { inicio: Date; fim: Date } {
    const hoje = new Date();
    const anoMes = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;

    const inicioStr = periodoInicio || `${anoMes}-01`;
    const fimStr = periodoFim || `${anoMes}-${new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate()}`;

    const inicio = new Date(inicioStr + 'T00:00:00.000Z');
    const fim = new Date(fimStr + 'T23:59:59.999Z');

    if (isNaN(inicio.getTime()) || isNaN(fim.getTime())) {
      throw new BadRequestException('Datas inválidas. Use formato YYYY-MM-DD.');
    }
    if (inicio > fim) {
      throw new BadRequestException('periodoInicio deve ser anterior a periodoFim.');
    }

    return { inicio, fim };
  }

  // ── EFD ICMS/IPI ───────────────────────────────────────────────────────────

  /**
   * GET /sped/fiscal?periodoInicio=2026-01-01&periodoFim=2026-01-31
   * Retorna o arquivo EFD ICMS/IPI como download .txt
   */
  @Get('fiscal')
  async downloadFiscal(
    @Request() req: any,
    @Query('periodoInicio') periodoInicio?: string,
    @Query('periodoFim') periodoFim?: string,
    @Res() res?: Response,
  ) {
    const { inicio, fim } = this.parsePeriodo(periodoInicio, periodoFim);
    const companyId: string = req.user.companyId;

    const content = await this.spedFiscal.generateFile(companyId, inicio, fim);

    const anoMes = `${inicio.getFullYear()}${String(inicio.getMonth() + 1).padStart(2, '0')}`;
    const filename = `EFD_ICMS_IPI_${anoMes}.txt`;

    res!.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res!.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res!.setHeader('Content-Length', Buffer.byteLength(content, 'utf8'));
    res!.send(content);
  }

  /**
   * GET /sped/fiscal/preview?periodoInicio=...&periodoFim=...
   * Retorna preview dos primeiros 100 registros + estatísticas
   */
  @Get('fiscal/preview')
  async previewFiscal(
    @Request() req: any,
    @Query('periodoInicio') periodoInicio?: string,
    @Query('periodoFim') periodoFim?: string,
  ) {
    const { inicio, fim } = this.parsePeriodo(periodoInicio, periodoFim);
    const content = await this.spedFiscal.generateFile(req.user.companyId, inicio, fim);

    const lines = content.split('\r\n');
    const registros: Record<string, number> = {};
    for (const line of lines) {
      const parts = line.split('|');
      if (parts.length >= 2) {
        const reg = parts[1];
        registros[reg] = (registros[reg] ?? 0) + 1;
      }
    }

    return {
      totalLinhas: lines.length,
      tamanhoBytes: Buffer.byteLength(content, 'utf8'),
      periodo: { inicio: inicio.toISOString().substring(0, 10), fim: fim.toISOString().substring(0, 10) },
      registros,
      primeiros100: lines.slice(0, 100),
    };
  }

  // ── EFD PIS/COFINS ─────────────────────────────────────────────────────────

  /**
   * GET /sped/contribuicoes?periodoInicio=2026-01-01&periodoFim=2026-01-31
   * Retorna o arquivo EFD PIS/COFINS como download .txt
   */
  @Get('contribuicoes')
  async downloadContribuicoes(
    @Request() req: any,
    @Query('periodoInicio') periodoInicio?: string,
    @Query('periodoFim') periodoFim?: string,
    @Res() res?: Response,
  ) {
    const { inicio, fim } = this.parsePeriodo(periodoInicio, periodoFim);
    const companyId: string = req.user.companyId;

    const content = await this.spedContrib.generateFile(companyId, inicio, fim);

    const anoMes = `${inicio.getFullYear()}${String(inicio.getMonth() + 1).padStart(2, '0')}`;
    const filename = `EFD_CONTRIBUICOES_${anoMes}.txt`;

    res!.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res!.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res!.setHeader('Content-Length', Buffer.byteLength(content, 'utf8'));
    res!.send(content);
  }

  /**
   * GET /sped/contribuicoes/preview
   */
  @Get('contribuicoes/preview')
  async previewContribuicoes(
    @Request() req: any,
    @Query('periodoInicio') periodoInicio?: string,
    @Query('periodoFim') periodoFim?: string,
  ) {
    const { inicio, fim } = this.parsePeriodo(periodoInicio, periodoFim);
    const content = await this.spedContrib.generateFile(req.user.companyId, inicio, fim);

    const lines = content.split('\r\n');
    const registros: Record<string, number> = {};
    for (const line of lines) {
      const parts = line.split('|');
      if (parts.length >= 2) {
        const reg = parts[1];
        registros[reg] = (registros[reg] ?? 0) + 1;
      }
    }

    return {
      totalLinhas: lines.length,
      tamanhoBytes: Buffer.byteLength(content, 'utf8'),
      periodo: { inicio: inicio.toISOString().substring(0, 10), fim: fim.toISOString().substring(0, 10) },
      registros,
      primeiros100: lines.slice(0, 100),
    };
  }

  // ── ECD (SPED Contábil) ────────────────────────────────────────────────────

  /** Helper: parse ano query param (defaults to current year) */
  private parseAno(ano?: string): number {
    const parsed = parseInt(ano || String(new Date().getFullYear()), 10);
    if (isNaN(parsed) || parsed < 2000 || parsed > 2099) {
      throw new BadRequestException('Parâmetro "ano" inválido. Use formato YYYY (ex: 2025).');
    }
    return parsed;
  }

  /**
   * GET /sped/ecd?ano=2025
   * Retorna o arquivo ECD (SPED Contábil) como download .txt
   */
  @Get('ecd')
  async downloadEcd(
    @Request() req: any,
    @Query('ano') ano?: string,
    @Res() res?: Response,
  ) {
    const anoRef = this.parseAno(ano);
    const companyId: string = req.user.companyId;

    const content = await this.ecd.generateFile(companyId, anoRef);

    const filename = `ECD_${anoRef}.txt`;
    res!.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res!.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res!.setHeader('Content-Length', Buffer.byteLength(content, 'utf8'));
    res!.send(content);
  }

  /**
   * GET /sped/ecd/preview?ano=2025
   * Retorna preview do arquivo ECD (primeiros 100 registros + estatísticas)
   */
  @Get('ecd/preview')
  async previewEcd(
    @Request() req: any,
    @Query('ano') ano?: string,
  ) {
    const anoRef = this.parseAno(ano);
    const content = await this.ecd.generateFile(req.user.companyId, anoRef);

    const lines = content.split('\r\n');
    const registros: Record<string, number> = {};
    for (const line of lines) {
      const parts = line.split('|');
      if (parts.length >= 2) {
        const reg = parts[1];
        registros[reg] = (registros[reg] ?? 0) + 1;
      }
    }

    return {
      totalLinhas: lines.length,
      tamanhoBytes: Buffer.byteLength(content, 'utf8'),
      periodo: { inicio: `${anoRef}-01-01`, fim: `${anoRef}-12-31` },
      registros,
      primeiros100: lines.slice(0, 100),
    };
  }

  // ── ECF ────────────────────────────────────────────────────────────────────

  /**
   * GET /sped/ecf?ano=2025
   * Retorna o arquivo ECF como download .txt
   */
  @Get('ecf')
  async downloadEcf(
    @Request() req: any,
    @Query('ano') ano?: string,
    @Res() res?: Response,
  ) {
    const anoRef = this.parseAno(ano);
    const companyId: string = req.user.companyId;

    const content = await this.ecf.generateFile(companyId, anoRef);

    const filename = `ECF_${anoRef}.txt`;
    res!.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res!.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res!.setHeader('Content-Length', Buffer.byteLength(content, 'utf8'));
    res!.send(content);
  }

  /**
   * GET /sped/ecf/preview?ano=2025
   * Retorna preview do arquivo ECF
   */
  @Get('ecf/preview')
  async previewEcf(
    @Request() req: any,
    @Query('ano') ano?: string,
  ) {
    const anoRef = this.parseAno(ano);
    const content = await this.ecf.generateFile(req.user.companyId, anoRef);

    const lines = content.split('\r\n');
    const registros: Record<string, number> = {};
    for (const line of lines) {
      const parts = line.split('|');
      if (parts.length >= 2) {
        const reg = parts[1];
        registros[reg] = (registros[reg] ?? 0) + 1;
      }
    }

    return {
      totalLinhas: lines.length,
      tamanhoBytes: Buffer.byteLength(content, 'utf8'),
      periodo: { inicio: `${anoRef}-01-01`, fim: `${anoRef}-12-31` },
      registros,
      primeiros100: lines.slice(0, 100),
    };
  }

  // ── Status / Histórico ──────────────────────────────────────────────────────

  /**
   * GET /sped/historico — últimas transmissões SPED logadas
   */
  @Get('historico')
  async historico(
    @Request() req: any,
    @Query('limit') limit?: string,
  ) {
    return this.spedFiscal['prisma'].governmentTransmissionLog.findMany({
      where: {
        companyId: req.user.companyId,
        type: { in: ['SPED_FISCAL', 'SPED_CONTRIBUICOES', 'ECD', 'ECF'] },
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit || '20', 10),
    });
  }
}
