import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';
import { CreateFiscalEntryDto } from './dto/create-fiscal-entry.dto';
import { CreateApuracaoDto } from './dto/create-apuracao.dto';

@Injectable()
export class FiscalBooksService {
  constructor(private readonly prisma: PrismaService) {}

  async createEntry(companyId: string, data: CreateFiscalEntryDto) {
    return this.prisma.fiscalEntry.create({
      data: {
        companyId,
        nfeId: data.nfeId || null,
        type: data.type as any,
        bookType: data.bookType as any,
        dataLancamento: new Date(data.dataLancamento),
        periodoReferencia: data.periodoReferencia,
        cfopCode: data.cfopCode,
        naturezaOperacao: data.naturezaOperacao || null,
        valorContabil: data.valorContabil,
        baseCalculo: data.baseCalculo,
        aliquota: data.aliquota,
        valorImposto: data.valorImposto,
        taxType: data.taxType,
        observations: data.observations || null,
      },
    });
  }

  async getEntries(
    companyId: string,
    query: {
      periodoReferencia?: string;
      bookType?: string;
      taxType?: string;
      type?: string;
      page?: string;
      limit?: string;
    },
  ) {
    const page = parseInt(query.page || '1', 10);
    const limit = parseInt(query.limit || '20', 10);
    const skip = (page - 1) * limit;

    const where: any = { companyId };

    if (query.periodoReferencia) {
      where.periodoReferencia = query.periodoReferencia;
    }

    if (query.bookType) {
      where.bookType = query.bookType;
    }

    if (query.taxType) {
      where.taxType = query.taxType;
    }

    if (query.type) {
      where.type = query.type;
    }

    const [data, total] = await Promise.all([
      this.prisma.fiscalEntry.findMany({
        where,
        skip,
        take: limit,
        orderBy: { dataLancamento: 'desc' },
        include: {
          nfe: {
            select: {
              id: true,
              numero: true,
              serie: true,
              naturezaOperacao: true,
            },
          },
        },
      }),
      this.prisma.fiscalEntry.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getApuracao(companyId: string, periodoReferencia: string, taxType: string) {
    const apuracao = await this.prisma.fiscalApuracao.findUnique({
      where: {
        companyId_periodoReferencia_taxType: {
          companyId,
          periodoReferencia,
          taxType,
        },
      },
    });

    if (!apuracao) {
      throw new NotFoundException(
        `Apuracao not found for period ${periodoReferencia} and tax ${taxType}`,
      );
    }

    return apuracao;
  }

  async calculateApuracao(companyId: string, data: CreateApuracaoDto) {
    const { periodoReferencia, taxType } = data;

    // Sum debits
    const debitos = await this.prisma.fiscalEntry.aggregate({
      where: {
        companyId,
        periodoReferencia,
        taxType,
        type: 'DEBITO',
      },
      _sum: { valorImposto: true },
    });

    // Sum credits
    const creditos = await this.prisma.fiscalEntry.aggregate({
      where: {
        companyId,
        periodoReferencia,
        taxType,
        type: 'CREDITO',
      },
      _sum: { valorImposto: true },
    });

    const totalDebitos = debitos._sum.valorImposto || 0;
    const totalCreditos = creditos._sum.valorImposto || 0;
    const saldoAnterior = data.saldoAnterior || 0;
    const deducoesLegais = data.deducoesLegais || 0;
    const ajustesDebito = data.ajustesDebito || 0;
    const ajustesCredito = data.ajustesCredito || 0;

    const saldo =
      totalDebitos +
      ajustesDebito -
      totalCreditos -
      ajustesCredito -
      saldoAnterior -
      deducoesLegais;

    const impostoAPagar = saldo > 0 ? this.round(saldo) : 0;
    const saldoCredor = saldo < 0 ? this.round(Math.abs(saldo)) : 0;

    const apuracao = await this.prisma.fiscalApuracao.upsert({
      where: {
        companyId_periodoReferencia_taxType: {
          companyId,
          periodoReferencia,
          taxType,
        },
      },
      create: {
        companyId,
        periodoReferencia,
        taxType,
        totalDebitos: this.round(totalDebitos),
        totalCreditos: this.round(totalCreditos),
        saldoAnterior,
        deducoesLegais,
        ajustesDebito,
        ajustesCredito,
        impostoAPagar,
        saldoCredor,
        status: 'ABERTA',
      },
      update: {
        totalDebitos: this.round(totalDebitos),
        totalCreditos: this.round(totalCreditos),
        saldoAnterior,
        deducoesLegais,
        ajustesDebito,
        ajustesCredito,
        impostoAPagar,
        saldoCredor,
      },
    });

    return apuracao;
  }

  async closeApuracao(companyId: string, periodoReferencia: string, taxType: string) {
    const apuracao = await this.prisma.fiscalApuracao.findUnique({
      where: {
        companyId_periodoReferencia_taxType: {
          companyId,
          periodoReferencia,
          taxType,
        },
      },
    });

    if (!apuracao) {
      throw new NotFoundException(
        `Apuracao not found for period ${periodoReferencia} and tax ${taxType}`,
      );
    }

    if (apuracao.status === 'FECHADA') {
      throw new BadRequestException(
        `Apuracao for period ${periodoReferencia} / ${taxType} is already closed.`,
      );
    }

    return this.prisma.fiscalApuracao.update({
      where: { id: apuracao.id },
      data: {
        status: 'FECHADA',
        dataFechamento: new Date(),
      },
    });
  }

  async getApuracaoPisCofins(companyId: string, periodoReferencia: string) {
    const where: any = { companyId, periodoReferencia, taxType: { in: ['PIS', 'COFINS'] } };

    const entries = await this.prisma.fiscalEntry.findMany({
      where,
      select: { taxType: true, type: true, valorContabil: true, baseCalculo: true, aliquota: true, valorImposto: true, cfopCode: true },
    });

    const agg = (taxType: string, entryType: string) =>
      entries
        .filter(e => e.taxType === taxType && e.type === entryType)
        .reduce((acc, e) => ({
          base: this.round(acc.base + Number(e.baseCalculo ?? 0)),
          imposto: this.round(acc.imposto + Number(e.valorImposto ?? 0)),
          count: acc.count + 1,
        }), { base: 0, imposto: 0, count: 0 });

    const pisDebito     = agg('PIS',    'DEBITO');
    const pisCredito    = agg('PIS',    'CREDITO');
    const cofinsDebito  = agg('COFINS', 'DEBITO');
    const cofinsCredito = agg('COFINS', 'CREDITO');

    const pisSaldo    = this.round(pisDebito.imposto    - pisCredito.imposto);
    const cofinsSaldo = this.round(cofinsDebito.imposto - cofinsCredito.imposto);
    const totalAPagar = this.round(
      (pisSaldo > 0 ? pisSaldo : 0) + (cofinsSaldo > 0 ? cofinsSaldo : 0),
    );

    const [pisApuracao, cofinsApuracao] = await Promise.all([
      this.prisma.fiscalApuracao.findUnique({
        where: { companyId_periodoReferencia_taxType: { companyId, periodoReferencia, taxType: 'PIS' } },
      }),
      this.prisma.fiscalApuracao.findUnique({
        where: { companyId_periodoReferencia_taxType: { companyId, periodoReferencia, taxType: 'COFINS' } },
      }),
    ]);

    return {
      periodoReferencia,
      pis: {
        debitos: pisDebito, creditos: pisCredito,
        saldo: pisSaldo,
        impostoAPagar: pisSaldo > 0 ? pisSaldo : 0,
        saldoCredor: pisSaldo < 0 ? Math.abs(pisSaldo) : 0,
        status: pisApuracao?.status ?? 'PENDENTE',
      },
      cofins: {
        debitos: cofinsDebito, creditos: cofinsCredito,
        saldo: cofinsSaldo,
        impostoAPagar: cofinsSaldo > 0 ? cofinsSaldo : 0,
        saldoCredor: cofinsSaldo < 0 ? Math.abs(cofinsSaldo) : 0,
        status: cofinsApuracao?.status ?? 'PENDENTE',
      },
      totalAPagar,
      totalLancamentos: entries.length,
    };
  }

  async getMapaCfop(
    companyId: string,
    query: {
      periodoReferencia?: string;
      bookType?: string;
      startDate?: string;
      endDate?: string;
    },
  ) {
    const where: any = { companyId };

    if (query.periodoReferencia) where.periodoReferencia = query.periodoReferencia;
    if (query.bookType) where.bookType = query.bookType;

    if (query.startDate || query.endDate) {
      where.dataLancamento = {};
      if (query.startDate) where.dataLancamento.gte = new Date(query.startDate);
      if (query.endDate)   where.dataLancamento.lte = new Date(query.endDate);
    }

    const entries = await this.prisma.fiscalEntry.findMany({
      where,
      select: {
        cfopCode: true,
        naturezaOperacao: true,
        bookType: true,
        type: true,
        valorContabil: true,
        baseCalculo: true,
        valorImposto: true,
        taxType: true,
      },
    });

    // Group by CFOP
    const map = new Map<string, {
      cfop: string;
      naturezaOperacao: string | null;
      bookType: string;
      entradas: number;
      saidas: number;
      totalValorContabil: number;
      totalBaseCalculo: number;
      totalImposto: number;
      byTax: Record<string, number>;
    }>();

    for (const e of entries) {
      const key = `${e.cfopCode}|${e.bookType}`;
      if (!map.has(key)) {
        map.set(key, {
          cfop: e.cfopCode,
          naturezaOperacao: e.naturezaOperacao,
          bookType: e.bookType,
          entradas: 0,
          saidas: 0,
          totalValorContabil: 0,
          totalBaseCalculo: 0,
          totalImposto: 0,
          byTax: {},
        });
      }
      const row = map.get(key)!;
      if (e.type === 'CREDITO' || (e.bookType as string) === 'ENTRADA') row.entradas += 1;
      else row.saidas += 1;
      row.totalValorContabil += Number(e.valorContabil ?? 0);
      row.totalBaseCalculo  += Number(e.baseCalculo  ?? 0);
      row.totalImposto      += Number(e.valorImposto ?? 0);
      if (e.taxType) {
        row.byTax[e.taxType] = (row.byTax[e.taxType] ?? 0) + Number(e.valorImposto ?? 0);
      }
    }

    const data = Array.from(map.values())
      .map(r => ({
        ...r,
        totalValorContabil: this.round(r.totalValorContabil),
        totalBaseCalculo:   this.round(r.totalBaseCalculo),
        totalImposto:       this.round(r.totalImposto),
        byTax: Object.fromEntries(
          Object.entries(r.byTax).map(([k, v]) => [k, this.round(v)]),
        ),
        count: r.entradas + r.saidas,
      }))
      .sort((a, b) => a.cfop.localeCompare(b.cfop));

    const totais = {
      totalEntries:     data.reduce((s, r) => s + r.count, 0),
      totalValorContabil: this.round(data.reduce((s, r) => s + r.totalValorContabil, 0)),
      totalBaseCalculo:   this.round(data.reduce((s, r) => s + r.totalBaseCalculo, 0)),
      totalImposto:       this.round(data.reduce((s, r) => s + r.totalImposto, 0)),
    };

    return { data, totais };
  }

  getCalendarioObrigacoes(companyId: string, ano: number) {
    // Fixed federal fiscal obligations for Lucro Real companies
    const obrigacoes = [
      // Monthly
      { codigo: 'DCTF',   nome: 'DCTF Mensal',               tipo: 'FEDERAL', frequencia: 'MENSAL',    diaVencimento: 15 },
      { codigo: 'DARF-PIS',   nome: 'DARF PIS (6912)',       tipo: 'FEDERAL', frequencia: 'MENSAL',    diaVencimento: 25 },
      { codigo: 'DARF-COFINS',nome: 'DARF COFINS (5856)',     tipo: 'FEDERAL', frequencia: 'MENSAL',    diaVencimento: 25 },
      { codigo: 'DARF-CSLL',  nome: 'Estimativa CSLL',        tipo: 'FEDERAL', frequencia: 'MENSAL',    diaVencimento: 30 },
      { codigo: 'DARF-IRPJ',  nome: 'Estimativa IRPJ',        tipo: 'FEDERAL', frequencia: 'MENSAL',    diaVencimento: 30 },
      { codigo: 'EFD-ICMS',   nome: 'EFD ICMS/IPI (SPED)',    tipo: 'ESTADUAL',frequencia: 'MENSAL',    diaVencimento: 15 },
      { codigo: 'EFD-CONTRIB',nome: 'EFD Contribuições (SPED)',tipo: 'FEDERAL', frequencia: 'MENSAL',   diaVencimento: 10 },
      { codigo: 'FGTS',   nome: 'FGTS',                       tipo: 'FEDERAL', frequencia: 'MENSAL',    diaVencimento: 7  },
      { codigo: 'GPS',    nome: 'GPS (INSS Patronal)',         tipo: 'FEDERAL', frequencia: 'MENSAL',    diaVencimento: 20 },
      { codigo: 'GIA',    nome: 'GIA ICMS Estadual',           tipo: 'ESTADUAL',frequencia: 'MENSAL',    diaVencimento: 10 },
      // Quarterly
      { codigo: 'IRPJ-T', nome: 'IRPJ Trimestral',            tipo: 'FEDERAL', frequencia: 'TRIMESTRAL',diaVencimento: 30 },
      { codigo: 'CSLL-T', nome: 'CSLL Trimestral',            tipo: 'FEDERAL', frequencia: 'TRIMESTRAL',diaVencimento: 30 },
      // Annual
      { codigo: 'ECF',    nome: 'ECF — Escrituração Contábil Fiscal', tipo: 'FEDERAL', frequencia: 'ANUAL', mesVencimento: 7, diaVencimento: 31 },
      { codigo: 'ECD',    nome: 'ECD — Escrituração Contábil Digital',tipo: 'FEDERAL', frequencia: 'ANUAL', mesVencimento: 6, diaVencimento: 30 },
      { codigo: 'RAIS',   nome: 'RAIS',                               tipo: 'FEDERAL', frequencia: 'ANUAL', mesVencimento: 3, diaVencimento: 31 },
      { codigo: 'DIRF',   nome: 'DIRF',                               tipo: 'FEDERAL', frequencia: 'ANUAL', mesVencimento: 2, diaVencimento: 28 },
    ];

    const today = new Date();
    const eventos: any[] = [];

    for (const ob of obrigacoes) {
      if (ob.frequencia === 'MENSAL') {
        for (let mes = 1; mes <= 12; mes++) {
          const dia = Math.min(ob.diaVencimento, new Date(ano, mes, 0).getDate());
          const vencimento = new Date(ano, mes - 1, dia);
          const diasRestantes = Math.ceil((vencimento.getTime() - today.getTime()) / 86400000);
          eventos.push({
            ...ob, mes, ano, vencimento: vencimento.toISOString().slice(0, 10),
            diasRestantes,
            atrasado: diasRestantes < 0,
            urgente: diasRestantes >= 0 && diasRestantes <= 10,
          });
        }
      } else if (ob.frequencia === 'TRIMESTRAL') {
        for (const mes of [3, 6, 9, 12]) {
          const dia = Math.min(ob.diaVencimento, new Date(ano, mes, 0).getDate());
          const vencimento = new Date(ano, mes - 1, dia);
          const diasRestantes = Math.ceil((vencimento.getTime() - today.getTime()) / 86400000);
          eventos.push({
            ...ob, mes, ano, vencimento: vencimento.toISOString().slice(0, 10),
            diasRestantes,
            atrasado: diasRestantes < 0,
            urgente: diasRestantes >= 0 && diasRestantes <= 10,
          });
        }
      } else {
        const mes = (ob as any).mesVencimento;
        const dia = Math.min(ob.diaVencimento, new Date(ano, mes, 0).getDate());
        const vencimento = new Date(ano, mes - 1, dia);
        const diasRestantes = Math.ceil((vencimento.getTime() - today.getTime()) / 86400000);
        eventos.push({
          ...ob, mes, ano, vencimento: vencimento.toISOString().slice(0, 10),
          diasRestantes,
          atrasado: diasRestantes < 0,
          urgente: diasRestantes >= 0 && diasRestantes <= 10,
        });
      }
    }

    eventos.sort((a, b) => a.vencimento.localeCompare(b.vencimento));

    const proximas = eventos
      .filter(e => !e.atrasado)
      .slice(0, 10);

    const atrasadas = eventos.filter(e => e.atrasado);
    const urgentes  = eventos.filter(e => e.urgente);

    return { ano, eventos, proximas, urgentes, atrasadas, total: eventos.length };
  }

  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
