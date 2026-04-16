import { Controller, Get, Post, Query, UseGuards, Request, BadRequestException } from '@nestjs/common';
import { JwtAuthGuard } from '@/modules/core/auth/guards/jwt-auth.guard';
import { DctfwebClientService } from './dctfweb-client.service';
import { PrismaService } from '@/modules/core/database/prisma.service';

/**
 * A14 — DCTF-Web Controller
 *
 * DCTF-Web is generated automatically from eSocial + REINF totals by the RFB system.
 * These endpoints allow generating a local declaration, consulting existing ones,
 * and transmitting to the RFB webservice.
 */
@Controller('dctfweb')
@UseGuards(JwtAuthGuard)
export class DctfwebController {
  constructor(
    private readonly dctfweb: DctfwebClientService,
    private readonly prisma: PrismaService,
  ) {}

  private periodoAtual(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  /** GET /dctfweb/dashboard?periodo=2025-04 — aggregate values for the period */
  @Get('dashboard')
  async dashboard(@Request() req: any, @Query('periodo') periodo?: string) {
    const ref = periodo || this.periodoAtual();
    const companyId = req.user.companyId as string;
    const [ano, mes] = ref.split('-').map(Number);
    const dtIni = new Date(ano, mes - 1, 1);
    const dtFim = new Date(ano, mes, 0);

    // Aggregate from payroll
    const payroll = await this.prisma.payroll.findFirst({
      where: { companyId, periodoReferencia: ref, type: 'MENSAL' as any },
      include: { items: true },
    });

    const totalFGTS = payroll?.items.reduce((s, i) => s + Number(i.fgts ?? 0), 0) ?? 0;
    const totalINSS = payroll?.items.reduce((s, i) => s + Number(i.inss ?? 0), 0) ?? 0;
    const totalINSSPatronal = payroll?.items.reduce((s, i) => s + Number(i.inssPatronal ?? 0), 0) ?? 0;
    const totalIRRF = payroll?.items.reduce((s, i) => s + Number(i.irrf ?? 0), 0) ?? 0;

    // INSS retido em NF-e (R-2010)
    const nfeEntradas = await this.prisma.nFeInbox.findMany({
      where: {
        companyId,
        dataEmissao: { gte: dtIni, lte: dtFim },
        status: { in: ['ESCRITURACAO', 'FINALIZADA', 'LANCADA'] as any[] },
      },
      select: { valorInssRetido: true } as any,
    });
    const totalInssRetidoNfe = nfeEntradas.reduce(
      (s: number, n: any) => s + Number(n.valorInssRetido ?? 0), 0,
    );

    // IR retido em pagamentos PJ
    const movements = await this.prisma.financialMovement.findMany({
      where: {
        companyId,
        type: 'DESPESA' as any,
        dataVencimento: { gte: dtIni, lte: dtFim },
        status: { in: ['PAGO'] as any[] },
      },
      select: { valorIrRetido: true } as any,
    });
    const totalIrRetidoPJ = movements.reduce(
      (s: number, m: any) => s + Number(m.valorIrRetido ?? 0), 0,
    );

    const transmissoes = await this.prisma.governmentTransmissionLog.findMany({
      where: { companyId, type: 'DCTFWEB', createdAt: { gte: dtIni } },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    return {
      periodo: ref,
      tributos: {
        fgts: { descricao: 'FGTS (8%)', valor: totalFGTS },
        inssEmpregado: { descricao: 'INSS Empregado (desconto em folha)', valor: totalINSS },
        inssPatronal: { descricao: 'INSS Patronal (20% + RAT)', valor: totalINSSPatronal },
        irrf: { descricao: 'IRRF Folha de Pagamento', valor: totalIRRF },
        inssRetidoNfe: { descricao: 'INSS Retido em NF-e (R-2010)', valor: totalInssRetidoNfe },
        irRetidoPJ: { descricao: 'IR Retido na Fonte — PJ (R-4020)', valor: totalIrRetidoPJ },
      },
      totalDebitos: totalFGTS + totalINSS + totalINSSPatronal + totalIRRF + totalInssRetidoNfe + totalIrRetidoPJ,
      statusFolha: payroll?.status ?? 'SEM_FOLHA',
      ultimasTransmissoes: transmissoes,
    };
  }

  /** POST /dctfweb/gerar?periodo=2025-04 — gera declaração local */
  @Post('gerar')
  async gerar(@Request() req: any, @Query('periodo') periodo?: string) {
    const ref = periodo || this.periodoAtual();
    return this.dctfweb.gerarDeclaracao(req.user.companyId, ref);
  }

  /** GET /dctfweb/consultar?periodo=2025-04 — consulta declaração existente */
  @Get('consultar')
  async consultar(@Request() req: any, @Query('periodo') periodo?: string) {
    const ref = periodo || this.periodoAtual();
    return this.dctfweb.consultarDeclaracao(req.user.companyId, ref);
  }

  /** POST /dctfweb/transmitir?declaracaoId=... — transmite ao RFB */
  @Post('transmitir')
  async transmitir(@Request() req: any, @Query('declaracaoId') declaracaoId: string) {
    if (!declaracaoId) throw new BadRequestException('declaracaoId é obrigatório');
    return this.dctfweb.transmitirDeclaracao(req.user.companyId, declaracaoId);
  }

  /** GET /dctfweb/historico */
  @Get('historico')
  async historico(@Request() req: any, @Query('limit') limit?: string) {
    return this.prisma.governmentTransmissionLog.findMany({
      where: { companyId: req.user.companyId, type: 'DCTFWEB' },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit || '20', 10),
    });
  }
}
