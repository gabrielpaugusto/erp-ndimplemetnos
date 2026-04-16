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
import { NfeInboxService } from './nfe-inbox.service';
import { CreateNfeInboxDto } from './dto/create-nfe-inbox.dto';
import { ManifestNfeDto } from './dto/manifest-nfe.dto';
import { LinkNfeItemDto, CreateAndLinkDto } from './dto/link-nfe-item.dto';
import { PostNfeEntryDto } from './dto/post-nfe-entry.dto';
import { RecepcionarNfeDto } from './dto/recepcionar-nfe.dto';
import { LancarFinanceiroNfeDto } from './dto/lancar-financeiro-nfe.dto';
import { EscriturarNfeDto } from './dto/escriturar-nfe.dto';

@Controller('purchasing/nfe-inbox')
@UseGuards(JwtAuthGuard)
export class NfeInboxController {
  constructor(private readonly nfeInboxService: NfeInboxService) {}

  @Get()
  findAll(
    @CurrentUser() user: { id: string; companyId: string },
    @Query('status') status?: string,
    @Query('emitenteCnpj') emitenteCnpj?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.nfeInboxService.findAll(user.companyId, {
      status,
      emitenteCnpj,
      startDate,
      endDate,
      search,
      page,
      limit,
    });
  }

  @Get('stats')
  getStats(@CurrentUser() user: { id: string; companyId: string }) {
    return this.nfeInboxService.getStats(user.companyId);
  }

  @Get('sync-status')
  getSyncStatus(@CurrentUser() user: { id: string; companyId: string }) {
    return this.nfeInboxService.getSyncStatus(user.companyId);
  }

  @Get('eventos')
  getAllEventos(
    @CurrentUser() user: { id: string; companyId: string },
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.nfeInboxService.getAllEventos(user.companyId, { page, limit, search });
  }

  @Post('sync')
  syncFromSefaz(@CurrentUser() user: { id: string; companyId: string }) {
    return this.nfeInboxService.syncFromSefaz(user.companyId);
  }

  @Get('ncm-auditorias')
  listNcmAuditorias(
    @CurrentUser() user: { id: string; companyId: string },
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.nfeInboxService.listNcmAuditorias(user.companyId, { status, page, limit });
  }

  @Patch('ncm-auditorias/:auditId')
  resolveNcmAuditoria(
    @CurrentUser() user: { id: string; companyId: string },
    @Param('auditId') auditId: string,
    @Body() dto: { status: string; observacoes?: string },
  ) {
    return this.nfeInboxService.resolveNcmAuditoria(auditId, user.companyId, { ...dto, resolvidoPorId: user.id });
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: { id: string; companyId: string },
    @Param('id') id: string,
  ) {
    return this.nfeInboxService.findOne(id, user.companyId);
  }

  @Post()
  create(
    @CurrentUser() user: { id: string; companyId: string },
    @Body() dto: CreateNfeInboxDto,
  ) {
    return this.nfeInboxService.create(user.companyId, dto);
  }

  @Post(':id/manifest')
  manifest(
    @CurrentUser() user: { id: string; companyId: string },
    @Param('id') id: string,
    @Body() dto: ManifestNfeDto,
  ) {
    return this.nfeInboxService.manifest(id, user.companyId, dto);
  }

  @Post(':id/auto-map')
  autoMap(
    @CurrentUser() user: { id: string; companyId: string },
    @Param('id') id: string,
  ) {
    return this.nfeInboxService.autoMap(id, user.companyId);
  }

  @Post(':id/link-item')
  linkItem(
    @CurrentUser() user: { id: string; companyId: string },
    @Param('id') id: string,
    @Body() dto: LinkNfeItemDto,
  ) {
    return this.nfeInboxService.linkItem(id, user.companyId, dto);
  }

  @Post(':id/create-and-link')
  createAndLink(
    @CurrentUser() user: { id: string; companyId: string },
    @Param('id') id: string,
    @Body() dto: CreateAndLinkDto,
  ) {
    return this.nfeInboxService.createAndLink(id, user.companyId, dto);
  }

  @Post(':id/download-xml')
  downloadFullXml(
    @CurrentUser() user: { id: string; companyId: string },
    @Param('id') id: string,
  ) {
    return this.nfeInboxService.downloadFullXml(id, user.companyId);
  }

  @Get(':id/events')
  getEventos(
    @CurrentUser() user: { id: string; companyId: string },
    @Param('id') id: string,
  ) {
    return this.nfeInboxService.getEventos(id, user.companyId);
  }

  @Get(':id/danfe')
  async getDanfe(
    @CurrentUser() user: { id: string; companyId: string },
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const buffer = await this.nfeInboxService.generateDanfe(id, user.companyId);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="danfe-${id}.pdf"`,
      'Content-Length': String(buffer.length),
    });
    res.end(buffer);
  }

  @Post('fix-numbers')
  fixNumbers(@CurrentUser() user: { id: string; companyId: string }) {
    return this.nfeInboxService.fixNumbers(user.companyId);
  }

  @Post('fix-manifested')
  fixManifested(@CurrentUser() user: { id: string; companyId: string }) {
    return this.nfeInboxService.fixManifested(user.companyId);
  }

  @Post('fix-cancelled')
  fixCancelled(@CurrentUser() user: { id: string; companyId: string }) {
    return this.nfeInboxService.fixCancelled(user.companyId);
  }

  @Post('fix-cte-links')
  fixCteLinks(@CurrentUser() user: { id: string; companyId: string }) {
    return this.nfeInboxService.fixCteLinks(user.companyId);
  }

  @Post('fix-ciencia')
  fixCiencia(@CurrentUser() user: { id: string; companyId: string }) {
    return this.nfeInboxService.fixCiencia(user.companyId);
  }

  @Post('fix-resnfe')
  fixResNFe(@CurrentUser() user: { id: string; companyId: string }) {
    return this.nfeInboxService.fixResNFe(user.companyId);
  }

  @Post('fix-emitente-links')
  fixEmitenteLinks(@CurrentUser() user: { id: string; companyId: string }) {
    return this.nfeInboxService.fixEmitenteLinks(user.companyId);
  }

  @Post(':id/recepcionar')
  recepcionar(
    @CurrentUser() user: { id: string; companyId: string },
    @Param('id') id: string,
    @Body() dto: RecepcionarNfeDto,
  ) {
    return this.nfeInboxService.recepcionar(id, user.companyId, user.id, dto);
  }

  @Post(':id/lancar-financeiro')
  lancarFinanceiro(
    @CurrentUser() user: { id: string; companyId: string },
    @Param('id') id: string,
    @Body() dto: LancarFinanceiroNfeDto,
  ) {
    return this.nfeInboxService.lancarFinanceiro(id, user.companyId, user.id, dto);
  }

  @Post(':id/escriturar')
  escriturar(
    @CurrentUser() user: { id: string; companyId: string },
    @Param('id') id: string,
    @Body() dto: EscriturarNfeDto,
  ) {
    return this.nfeInboxService.escriturar(id, user.companyId, user.id, dto);
  }

  @Post(':id/post-entry')
  postEntry(
    @CurrentUser() user: { id: string; companyId: string },
    @Param('id') id: string,
    @Body() dto: PostNfeEntryDto,
  ) {
    // Override inboxId from URL param to ensure consistency
    return this.nfeInboxService.postEntry(user.companyId, user.id, {
      ...dto,
      inboxId: id,
    });
  }

  // ── IA Fiscal ─────────────────────────────────────────────────────────────

  /**
   * POST /purchasing/nfe-inbox/:id/ia-classificar
   * Dispara (ou re-dispara) manualmente o pipeline IA para a NF-e.
   * Útil para retry ou quando a manifestação ocorreu antes do pipeline existir.
   */
  @Post(':id/ia-classificar')
  iaClassificar(
    @CurrentUser() user: { id: string; companyId: string },
    @Param('id') id: string,
  ) {
    return this.nfeInboxService.iaClassificar(id, user.companyId);
  }

  /**
   * GET /purchasing/nfe-inbox/:id/ia-status
   * Retorna o status da classificação IA por item:
   * CFOP sugerido, CST, alíquotas, confiança, alertas e se está pronto para lançar.
   */
  @Get(':id/ia-status')
  iaStatus(
    @CurrentUser() user: { id: string; companyId: string },
    @Param('id') id: string,
  ) {
    return this.nfeInboxService.iaStatus(id, user.companyId);
  }
}
