import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';
import { ConfigService } from '@nestjs/config';
import { GovernmentTransmissionService } from '../government-transmission.service';
import { ReinfClientService } from './reinf-client.service';
import { REINF_EVENTS } from './reinf.config';

export interface ReinfEventData {
  tipo: string;
  dados: Record<string, any>;
}

/**
 * A14 — REINF Event Generator
 *
 * Reads real data from NFeInbox (for R-2010 retentions) and FinancialMovements
 * (for R-4020 PJ payments with IR withheld), generates REINF event payloads,
 * and sends them via the existing ReinfClientService.
 *
 * Events:
 *  R-1000 — Informações do Contribuinte
 *  R-2010 — Retenção Contribuição Previdenciária — Serviços Tomados (INSS retido em NF-e)
 *  R-4020 — Pagamentos/Créditos a Beneficiário PJ (IR retido na fonte)
 *  R-2099 — Fechamento dos Eventos Periódicos série R-2000
 *  R-4099 — Fechamento dos Eventos Periódicos série R-4000
 */
@Injectable()
export class ReinfEventsService extends GovernmentTransmissionService {
  constructor(
    protected readonly prisma: PrismaService,
    protected readonly configService: ConfigService,
    private readonly reinfClient: ReinfClientService,
  ) {
    super(prisma, configService);
  }

  // ── R-1000 — Informações do Contribuinte ────────────────────────────────

  async gerarR1000(companyId: string): Promise<ReinfEventData> {
    const company = await this.prisma.company.findUniqueOrThrow({ where: { id: companyId } });
    return {
      tipo: REINF_EVENTS.R_1000,
      dados: {
        cnpj: (company.cnpj ?? '').replace(/\D/g, ''),
        nomeEmpresarial: company.razaoSocial,
        cnae: (company as any).cnae || '0000-0/00',
        classificacaoTrib: '01', // 01=empresa do Lucro Real
        indEscrituracao: 'C',
        indDesoneracao: 'N',
        indAcordoIsenMulta: 'N',
        dtTrans11: company.createdAt?.toISOString().substring(0, 10) ?? '2024-01-01',
        indSitPJ: 'N',
        contato: company.email ?? '',
        telefone: (company.telefone ?? '').replace(/\D/g, ''),
      },
    };
  }

  // ── R-2010 — Retenção INSS em serviços tomados ──────────────────────────

  async gerarR2010Batch(companyId: string, periodo: string): Promise<ReinfEventData[]> {
    const [ano, mes] = periodo.split('-').map(Number);
    const dtIni = new Date(ano, mes - 1, 1);
    const dtFim = new Date(ano, mes, 0);

    // NF-e de entrada com INSS retido (serviços)
    const nfeEntradas = await this.prisma.nFeInbox.findMany({
      where: {
        companyId,
        dataEmissao: { gte: dtIni, lte: dtFim },
        status: { in: ['ESCRITURACAO', 'FINALIZADA', 'LANCADA'] as any[] },
      },
      include: {
        emitentePessoa: { select: { cpfCnpj: true, razaoSocial: true } },
      },
    });

    // Filtrar apenas NF-e de serviços com INSS retido
    const events: ReinfEventData[] = [];
    for (const nfe of nfeEntradas) {
      const inssRetido = Number((nfe as any).valorInssRetido ?? 0);
      if (inssRetido <= 0) continue;

      const prestador = (nfe as any).emitentePessoa;
      const cnpjPrestador = prestador?.cpfCnpj?.replace(/\D/g, '') ?? (nfe as any).emitenteCnpj ?? '';

      events.push({
        tipo: REINF_EVENTS.R_2010,
        dados: {
          nrInscPrestador: cnpjPrestador,
          tpInscPrestador: cnpjPrestador.length === 14 ? '1' : '2', // 1=CNPJ, 2=CPF
          nomePrestador: prestador?.razaoSocial ?? (nfe as any).emitenteNome ?? '',
          nrInscTomador: (companyId).substring(0, 14),
          competencia: periodo,
          cnpjEmitente: cnpjPrestador,
          nrDocto: String((nfe as any).numero ?? ''),
          dtEmissaoNF: new Date((nfe as any).dataEmissao).toISOString().substring(0, 10),
          vlBruto: Number((nfe as any).valorTotal ?? 0).toFixed(2),
          vlBaseRetencao: Number((nfe as any).valorTotal ?? 0).toFixed(2),
          vlRetencao: inssRetido.toFixed(2),
          vlRetSusp: '0.00',
          indSusp: 'N',
          cnaeServico: '7490-1/04', // default — would need classification per NF-e
        },
      });
    }

    return events;
  }

  // ── R-4020 — Pagamentos/Créditos a PJ com IR retido ─────────────────────

  async gerarR4020Batch(companyId: string, periodo: string): Promise<ReinfEventData[]> {
    const [ano, mes] = periodo.split('-').map(Number);
    const dtIni = new Date(ano, mes - 1, 1);
    const dtFim = new Date(ano, mes, 0);

    // Movimentos financeiros do tipo DESPESA com IR retido no período
    const movements = await this.prisma.financialMovement.findMany({
      where: {
        companyId,
        type: 'DESPESA' as any,
        dataVencimento: { gte: dtIni, lte: dtFim },
        status: { in: ['PAGO'] as any[] },
      },
      include: {
        person: { select: { cpfCnpj: true, razaoSocial: true, rgIe: true } },
      },
    });

    const events: ReinfEventData[] = [];
    for (const mov of movements) {
      const irRetido = Number((mov as any).valorIrRetido ?? 0);
      if (irRetido <= 0) continue;

      const person = (mov as any).person;
      const cnpj = person?.cpfCnpj?.replace(/\D/g, '') ?? '';
      if (cnpj.length !== 14) continue; // R-4020 = apenas PJ

      events.push({
        tipo: REINF_EVENTS.R_4020,
        dados: {
          cnpjBeneficiario: cnpj,
          nomeBeneficiario: person?.razaoSocial ?? '',
          naturezaRendimento: '11065', // Serviços em geral
          competencia: periodo,
          dtFatoGerador: (mov as any).paymentDate?.toISOString().substring(0, 10)
            ?? (mov as any).dueDate?.toISOString().substring(0, 10)
            ?? `${periodo}-01`,
          vlBruto: Number((mov as any).amount ?? 0).toFixed(2),
          vlBaseIR: Number((mov as any).valorBaseIr ?? (mov as any).amount ?? 0).toFixed(2),
          aliqIR: Number((mov as any).aliqIr ?? 1.5).toFixed(2),
          vlIR: irRetido.toFixed(2),
          indFciScp: 'N',
          indJud: 'N',
          indDeducaoCustas: 'N',
        },
      });
    }

    return events;
  }

  // ── Envio em lote por período ────────────────────────────────────────────

  async enviarPeriodo(companyId: string, periodo: string): Promise<{
    r2010: any;
    r4020: any;
    totalEventos: number;
  }> {
    const [r2010Eventos, r4020Eventos] = await Promise.all([
      this.gerarR2010Batch(companyId, periodo),
      this.gerarR4020Batch(companyId, periodo),
    ]);

    const resultR2010 = r2010Eventos.length > 0
      ? await this.reinfClient.enviarLoteEventos(companyId, r2010Eventos)
      : { success: true, status: 'SEM_DADOS', mensagem: 'Sem retenções INSS no período' };

    const resultR4020 = r4020Eventos.length > 0
      ? await this.reinfClient.enviarLoteEventos(companyId, r4020Eventos)
      : { success: true, status: 'SEM_DADOS', mensagem: 'Sem pagamentos PJ com IR no período' };

    return {
      r2010: resultR2010,
      r4020: resultR4020,
      totalEventos: r2010Eventos.length + r4020Eventos.length,
    };
  }

  async fecharPeriodo(companyId: string, periodo: string) {
    return this.reinfClient.fecharPeriodo(companyId, periodo);
  }

  async historico(companyId: string, limit = 20) {
    return this.prisma.governmentTransmissionLog.findMany({
      where: { companyId, type: 'REINF' },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async resumoPeriodo(companyId: string, periodo: string) {
    const [r2010Eventos, r4020Eventos, transmissoes] = await Promise.all([
      this.gerarR2010Batch(companyId, periodo),
      this.gerarR4020Batch(companyId, periodo),
      this.prisma.governmentTransmissionLog.count({
        where: {
          companyId, type: 'REINF',
          createdAt: { gte: new Date(periodo + '-01') },
        },
      }),
    ]);

    const totalInssRetido = r2010Eventos.reduce((s, e) => s + parseFloat(e.dados.vlRetencao ?? '0'), 0);
    const totalIrRetido = r4020Eventos.reduce((s, e) => s + parseFloat(e.dados.vlIR ?? '0'), 0);

    return {
      periodo,
      retencoesPJ: r2010Eventos.length,
      totalInssRetido,
      pagamentosPjComIr: r4020Eventos.length,
      totalIrRetido,
      transmissoesRealizadas: transmissoes,
    };
  }
}
