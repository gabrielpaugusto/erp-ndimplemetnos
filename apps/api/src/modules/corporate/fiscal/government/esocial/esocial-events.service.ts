import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';
import { ConfigService } from '@nestjs/config';
import { GovernmentTransmissionService } from '../government-transmission.service';
import { EsocialClientService, EsocialEventData } from './esocial-client.service';
import { EsocialEvent } from './esocial-events.enum';

/**
 * A14 — eSocial Event Generator
 *
 * Reads real data from the HR/Payroll models and produces eSocial event
 * payloads following leiaute S-1.2 (2024).
 *
 * Main events:
 *  S-1000 — Informações do Empregador (company setup)
 *  S-2200 — Cadastramento de Vínculo / Admissão
 *  S-2299 — Desligamento
 *  S-1200 — Remuneração do Trabalhador por Competência
 *  S-1210 — Pagamentos Devidos ao Trabalhador
 *  S-1299 — Fechamento dos Eventos Periódicos
 */
@Injectable()
export class EsocialEventsService extends GovernmentTransmissionService {
  constructor(
    protected readonly prisma: PrismaService,
    protected readonly configService: ConfigService,
    private readonly esocialClient: EsocialClientService,
  ) {
    super(prisma, configService);
  }

  // ── S-1000 — Informações do Empregador ───────────────────────────────────

  async gerarS1000(companyId: string): Promise<EsocialEventData> {
    const company = await this.prisma.company.findUniqueOrThrow({ where: { id: companyId } });
    return {
      tipo: EsocialEvent.S_1000,
      dados: {
        nrInsc: (company.cnpj ?? '').replace(/\D/g, ''),
        tpInsc: '1', // 1=CNPJ
        nomeEmp: company.razaoSocial,
        cnae: (company as any).cnae || '0000-0/00',
        natJurid: (company as any).naturezaJuridica || '2062',
        indEntEd: 'N',
        dtTrans10: company.createdAt?.toISOString().substring(0, 10) ?? '2024-01-01',
        indEscrituracao: 'C', // C=ECD
        indDesoneracao: 'N',
        indAcordoIsenMulta: 'N',
        aliqGilrat: '2.00',
        aliqRat: '2.00',
        fatorMet: '1.0000',
        aliqRatAjust: '2.00',
      },
    };
  }

  // ── S-2200 — Admissão ────────────────────────────────────────────────────

  async gerarS2200(companyId: string, employeeId: string): Promise<EsocialEventData> {
    const emp = await this.prisma.employee.findUniqueOrThrow({
      where: { id: employeeId },
      include: {
        person: { select: { razaoSocial: true, cpfCnpj: true } as any },
      },
    });

    return {
      tipo: EsocialEvent.S_2200,
      dados: {
        nrInsc: (emp as any).person?.cpfCnpj?.replace(/\D/g, '') ?? '',
        nomeTrab: (emp as any).person?.razaoSocial ?? '',
        dtNascto: (emp as any).person?.dataNascimento?.toISOString().substring(0, 10) ?? '',
        paisNac: '105', // Brasil
        sexo: 'M',
        racaCor: '1',
        estCiv: '1',
        nisPisPasep: (emp.pis ?? '').replace(/\D/g, ''),
        dtAdm: emp.dataAdmissao.toISOString().substring(0, 10),
        tpAdmissao: '1',
        tpRegJor: '1',
        natAtividade: '1',
        dtBase: (emp.dataAdmissao.getMonth() + 1).toString().padStart(2, '0'),
        cnpjSindCateg: '',
        cargo: emp.cargo ?? '',
        codCargo: '000001',
        vrSalFx: Number(emp.salarioBase ?? 0).toFixed(2),
        undSalFixo: '5', // 5=mensal
        tpContr: '1',
        matricula: emp.matricula,
        nrInscEstab: (companyId).substring(0, 14),
      },
    };
  }

  // ── S-2299 — Desligamento ────────────────────────────────────────────────

  async gerarS2299(companyId: string, employeeId: string): Promise<EsocialEventData> {
    const emp = await this.prisma.employee.findUniqueOrThrow({
      where: { id: employeeId },
      include: { person: { select: { cpfCnpj: true } } },
    });

    return {
      tipo: EsocialEvent.S_2299,
      dados: {
        nrInsc: (emp as any).person?.cpfCnpj?.replace(/\D/g, '') ?? '',
        matricula: emp.matricula,
        dtDeslig: emp.dataDemissao?.toISOString().substring(0, 10) ?? new Date().toISOString().substring(0, 10),
        mtvDeslig: '11', // 11=rescisão por iniciativa do empregador sem justa causa
        pensAlim: 'N',
        dtProjFimContrato: '',
        observacao: '',
      },
    };
  }

  // ── S-1200 — Remuneração por Competência ────────────────────────────────

  async gerarS1200Batch(companyId: string, periodo: string): Promise<EsocialEventData[]> {
    // Find the payroll for this period
    const payroll = await this.prisma.payroll.findFirst({
      where: { companyId, periodoReferencia: periodo, type: 'MENSAL' as any },
      include: {
        items: {
          include: {
            employee: {
              include: { person: { select: { cpfCnpj: true } } },
            },
          },
        },
      },
    });

    if (!payroll) return [];

    return payroll.items.map((item): EsocialEventData => ({
      tipo: EsocialEvent.S_1200,
      dados: {
        cpfTrab: ((item.employee as any).person?.cpfCnpj ?? '').replace(/\D/g, ''),
        matricula: (item.employee as any).matricula ?? '',
        indSimples: '0',
        periodoApur: periodo,
        // Proventos
        vrSalFx: Number(item.salarioBase ?? 0).toFixed(2),
        vrHorasExtras: Number(item.horasExtras ?? 0).toFixed(2),
        vrHorasExtrasValor: Number(item.valorHorasExtras ?? 0).toFixed(2),
        vrAdicionalNoturno: Number(item.adicionalNoturno ?? 0).toFixed(2),
        vrOutrosProventos: Number(item.outrosProventos ?? 0).toFixed(2),
        totalBruto: Number(item.totalBruto ?? 0).toFixed(2),
        // Descontos
        vrInss: Number(item.inss ?? 0).toFixed(2),
        vrIrrf: Number(item.irrf ?? 0).toFixed(2),
        vrValeTransporte: Number(item.valeTransporte ?? 0).toFixed(2),
        vrOutrosDescontos: Number(item.outrosDescontos ?? 0).toFixed(2),
        totalDescontos: Number(item.totalDescontos ?? 0).toFixed(2),
        // Líquido
        totalLiquido: Number(item.totalLiquido ?? 0).toFixed(2),
        // Encargos patronais
        vrFgts: Number(item.fgts ?? 0).toFixed(2),
        vrInssPatronal: Number(item.inssPatronal ?? 0).toFixed(2),
      },
    }));
  }

  // ── S-1210 — Pagamentos ──────────────────────────────────────────────────

  async gerarS1210Batch(companyId: string, periodo: string): Promise<EsocialEventData[]> {
    const payroll = await this.prisma.payroll.findFirst({
      where: { companyId, periodoReferencia: periodo, type: 'MENSAL' as any },
      include: {
        items: {
          include: {
            employee: {
              include: { person: { select: { cpfCnpj: true } } },
            },
          },
        },
      },
    });

    if (!payroll) return [];

    return payroll.items.map((item): EsocialEventData => ({
      tipo: EsocialEvent.S_1210,
      dados: {
        cpfTrab: ((item.employee as any).person?.cpfCnpj ?? '').replace(/\D/g, ''),
        matricula: (item.employee as any).matricula ?? '',
        periodoApur: periodo,
        dtPgto: payroll.dataPagamento?.toISOString().substring(0, 10) ?? periodo + '-05',
        totalPago: Number(item.totalLiquido ?? 0).toFixed(2),
        vrInss: Number(item.inss ?? 0).toFixed(2),
        vrIrrf: Number(item.irrf ?? 0).toFixed(2),
      },
    }));
  }

  // ── S-1299 — Fechamento dos Periódicos ───────────────────────────────────

  async gerarS1299(companyId: string, periodo: string): Promise<EsocialEventData> {
    const company = await this.prisma.company.findUniqueOrThrow({ where: { id: companyId } });
    return {
      tipo: EsocialEvent.S_1299,
      dados: {
        nrInsc: (company.cnpj ?? '').replace(/\D/g, ''),
        periodoApuracao: periodo,
        evtRemun: 'S',
        evtPgtos: 'S',
        evtAqProd: 'N',
        evtComProd: 'N',
        evtContratAvNP: 'N',
        evtInfoComplPer: 'N',
      },
    };
  }

  // ── Envio em lote por período ────────────────────────────────────────────

  async enviarPeriodo(companyId: string, periodo: string): Promise<{
    s1200: any;
    s1210: any;
    s1299: any;
    totalEventos: number;
  }> {
    const [s1200Eventos, s1210Eventos, s1299Evento] = await Promise.all([
      this.gerarS1200Batch(companyId, periodo),
      this.gerarS1210Batch(companyId, periodo),
      this.gerarS1299(companyId, periodo),
    ]);

    const resultS1200 = s1200Eventos.length > 0
      ? await this.esocialClient.enviarLoteEventos(companyId, s1200Eventos)
      : { success: true, status: 'SEM_DADOS', mensagem: 'Sem remunerações no período' };

    const resultS1210 = s1210Eventos.length > 0
      ? await this.esocialClient.enviarLoteEventos(companyId, s1210Eventos)
      : { success: true, status: 'SEM_DADOS', mensagem: 'Sem pagamentos no período' };

    const resultS1299 = await this.esocialClient.enviarLoteEventos(companyId, [s1299Evento]);

    return {
      s1200: resultS1200,
      s1210: resultS1210,
      s1299: resultS1299,
      totalEventos: s1200Eventos.length + s1210Eventos.length + 1,
    };
  }

  // ── Histórico de transmissões eSocial ────────────────────────────────────

  async historico(companyId: string, limit = 20) {
    return this.prisma.governmentTransmissionLog.findMany({
      where: { companyId, type: 'ESOCIAL' },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  // ── Resumo do período para o dashboard ──────────────────────────────────

  async resumoPeriodo(companyId: string, periodo: string) {
    const payroll = await this.prisma.payroll.findFirst({
      where: { companyId, periodoReferencia: periodo, type: 'MENSAL' as any },
      include: { items: true },
    });

    const employees = await this.prisma.employee.count({
      where: { companyId, status: 'ATIVO' as any },
    });

    const demitidos = await this.prisma.employee.count({
      where: {
        companyId,
        status: 'DEMITIDO' as any,
        dataDemissao: {
          gte: new Date(periodo + '-01'),
          lte: new Date(periodo + '-31'),
        },
      },
    });

    const transmissoes = await this.prisma.governmentTransmissionLog.count({
      where: {
        companyId,
        type: 'ESOCIAL',
        createdAt: { gte: new Date(periodo + '-01') },
      },
    });

    return {
      periodo,
      empregadosAtivos: employees,
      demitidosNoPeriodo: demitidos,
      totalFolhaBruta: payroll ? Number(payroll.totalBruto ?? 0) : 0,
      totalFolhaLiquida: payroll ? Number(payroll.totalLiquido ?? 0) : 0,
      totalFGTS: payroll?.items.reduce((s, i) => s + Number(i.fgts ?? 0), 0) ?? 0,
      totalINSSPatronal: payroll?.items.reduce((s, i) => s + Number(i.inssPatronal ?? 0), 0) ?? 0,
      transmissoesRealizadas: transmissoes,
      statusFolha: payroll?.status ?? 'SEM_FOLHA',
    };
  }
}
