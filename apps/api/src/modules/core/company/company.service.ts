import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { FiscalModule } from '@erp/db';
import { PrismaService } from '@/modules/core/database/prisma.service';

export { FiscalModule };

// Campos fiscais monitorados para fins de auditoria
const FISCAL_AUDIT_FIELDS = [
  'taxRegime', 'issRetidoMunicipio', 'mvaPadrao',
  'ambienteNfe', 'ambienteNfse', 'ambienteSped', 'ambienteEsocial',
  'ambienteReinf', 'ambienteDctfweb', 'ambienteDFe',
  'serieNfe', 'proximoNumeroNfe',
  'serieCte', 'proximoNumeroCte',
  'serieMdfe', 'proximoNumeroMdfe',
  'serieNfse', 'proximoNumeroNfse',
  'cfopPadraoNfeSaida', 'cfopPadraoNfeSaidaInter', 'cfopPadraoCteEntrada',
  'cstIcmsPadrao', 'csosnPadrao',
] as const;

export interface UpdateCompanyDto {
  cnpj?: string;
  razaoSocial?: string;
  nomeFantasia?: string;
  inscricaoEstadual?: string;
  inscricaoMunicipal?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  codigoMunicipioIbge?: string;
  municipio?: string;
  uf?: string;
  cep?: string;
  telefone?: string;
  email?: string;
  taxRegime?: string;
  issRetidoMunicipio?: boolean;
  cnaePrincipal?: string;
  mvaPadrao?: number;
  // CFOP e CST/CSOSN padrão
  cfopPadraoNfeSaida?: string;
  cfopPadraoNfeSaidaInter?: string;
  cfopPadraoCteEntrada?: string;
  cstIcmsPadrao?: string;
  csosnPadrao?: string;
  // Ambientes por módulo (1=produção, 2=homologação)
  ambienteSefaz?: number;
  ambienteNfe?: number;
  ambienteNfce?: number;
  ambienteNfse?: number;
  ambienteSped?: number;
  ambienteEsocial?: number;
  ambienteReinf?: number;
  ambienteDctfweb?: number;
  ambienteDFe?: number;
  // NF-e config
  serieNfe?: number;
  serieNfce?: number;
  proximoNumeroNfe?: number;
  proximoNumeroNfce?: number;
  // CT-e config
  serieCte?: string;
  proximoNumeroCte?: number;
  // MDF-e config
  serieMdfe?: string;
  proximoNumeroMdfe?: number;
  // NFS-e config
  serieNfse?: string;
  proximoNumeroNfse?: number;
  // Início de operação
  dataInicioOperacao?: string | null; // ISO 8601 date string ou null para limpar
}

export interface AddCnaeDto {
  cnae: string;           // ex: "2920-4/01"
  descricao: string;      // ex: "Fabricação de implementos e equipamentos para uso agropecuário"
  principal: boolean;
}

@Injectable()
export class CompanyService {
  constructor(private readonly prisma: PrismaService) {}

  // -----------------------------------------------------------------------
  // Company
  // -----------------------------------------------------------------------

  async findOne(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      include: {
        cnaes: {
          orderBy: [{ principal: 'desc' }, { cnae: 'asc' }],
        },
      },
    });
    if (!company) throw new NotFoundException('Empresa não encontrada');
    const { certDigitalSenha: _s, certDigitalConteudo: _c, ultimoNsuNfse, ...safe } = company as any;
    return { ...safe, ultimoNsuNfse: ultimoNsuNfse?.toString() ?? '0' };
  }

  async update(companyId: string, dto: UpdateCompanyDto, userId?: string) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new NotFoundException('Empresa não encontrada');

    // Extrai apenas os campos permitidos — evita erro do Prisma ao receber
    // campos extras (id, cnpj, cnaes, createdAt, etc.) vindos do frontend.
    const {
      cnpj, razaoSocial, nomeFantasia, inscricaoEstadual, inscricaoMunicipal,
      logradouro, numero, complemento, bairro, codigoMunicipioIbge,
      municipio, uf, cep, telefone, email, taxRegime, issRetidoMunicipio, cnaePrincipal,
      mvaPadrao, cfopPadraoNfeSaida, cfopPadraoNfeSaidaInter, cfopPadraoCteEntrada, cstIcmsPadrao, csosnPadrao,
      ambienteSefaz, ambienteNfe, ambienteNfce, ambienteNfse,
      ambienteSped, ambienteEsocial, ambienteReinf, ambienteDctfweb, ambienteDFe,
      serieNfe, serieNfce, proximoNumeroNfe, proximoNumeroNfce,
      serieCte, proximoNumeroCte, serieMdfe, proximoNumeroMdfe, serieNfse, proximoNumeroNfse,
      dataInicioOperacao,
    } = dto as Record<string, unknown>;

    // Normaliza campos com formatacao de mascara antes de salvar
    const cnpjDigits = cnpj     ? String(cnpj).replace(/\D/g, '').slice(0, 14) : cnpj;
    const cepDigits  = cep      ? String(cep).replace(/\D/g, '').slice(0, 8)   : cep;
    const foneDigits = telefone ? String(telefone).replace(/\D/g, '').slice(0, 20) : telefone;

    const safeData = Object.fromEntries(
      Object.entries({
        cnpj: cnpjDigits, razaoSocial, nomeFantasia, inscricaoEstadual, inscricaoMunicipal,
        logradouro, numero, complemento, bairro, codigoMunicipioIbge,
        municipio, uf, cep: cepDigits, telefone: foneDigits, email, taxRegime, issRetidoMunicipio, cnaePrincipal,
        mvaPadrao, cfopPadraoNfeSaida, cfopPadraoNfeSaidaInter, cfopPadraoCteEntrada, cstIcmsPadrao, csosnPadrao,
        ambienteSefaz, ambienteNfe, ambienteNfce, ambienteNfse,
        ambienteSped, ambienteEsocial, ambienteReinf, ambienteDctfweb, ambienteDFe,
        serieNfe, serieNfce, proximoNumeroNfe, proximoNumeroNfce,
        serieCte, proximoNumeroCte, serieMdfe, proximoNumeroMdfe, serieNfse, proximoNumeroNfse,
        // dataInicioOperacao: converte string ISO para Date ou null explícito
        dataInicioOperacao: dataInicioOperacao === null
          ? null
          : dataInicioOperacao
            ? new Date(dataInicioOperacao as string)
            : undefined,
      }).filter(([, v]) => v !== undefined),
    );

    const updated = await this.prisma.company.update({
      where: { id: companyId },
      data: safeData,
      include: {
        cnaes: {
          orderBy: [{ principal: 'desc' }, { cnae: 'asc' }],
        },
      },
    });

    // Auditoria fiscal — registra apenas campos fiscais que mudaram
    try {
      const oldData: Record<string, unknown> = {};
      const newData: Record<string, unknown> = {};
      for (const field of FISCAL_AUDIT_FIELDS) {
        const oldVal = (company as any)[field];
        const newVal = (updated as any)[field];
        if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
          oldData[field] = oldVal;
          newData[field] = newVal;
        }
      }
      if (Object.keys(newData).length > 0) {
        await this.prisma.auditLog.create({
          data: {
            userId: userId ?? null,
            module: 'FISCAL' as any,
            action: 'UPDATE',
            entityType: 'company_fiscal_config',
            entityId: companyId,
            oldData: oldData as any,
            newData: newData as any,
          },
        });
      }
    } catch { /* auditoria não pode bloquear a operação */ }

    const { certDigitalSenha: _s, certDigitalConteudo: _c, ultimoNsuNfse: nsu, ...safe } = updated as any;
    return { ...safe, ultimoNsuNfse: nsu?.toString() ?? '0' };
  }

  // -----------------------------------------------------------------------
  // CNAEs
  // -----------------------------------------------------------------------

  async findCnaes(companyId: string) {
    return this.prisma.companyCnae.findMany({
      where: { companyId },
      orderBy: [{ principal: 'desc' }, { cnae: 'asc' }],
    });
  }

  async addCnae(companyId: string, dto: AddCnaeDto) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new NotFoundException('Empresa não encontrada');

    // Normaliza o código CNAE (remove caracteres especiais para armazenamento)
    const cnaeCode = dto.cnae.trim();
    if (!cnaeCode) throw new BadRequestException('Código CNAE é obrigatório');

    // Verifica duplicata
    const existing = await this.prisma.companyCnae.findUnique({
      where: { companyId_cnae: { companyId, cnae: cnaeCode } },
    });
    if (existing) throw new ConflictException(`CNAE ${cnaeCode} já cadastrado para esta empresa`);

    // Se vai ser principal, desmarca o principal atual
    if (dto.principal) {
      await this.prisma.companyCnae.updateMany({
        where: { companyId, principal: true },
        data: { principal: false },
      });
      // Atualiza também o campo cnaePrincipal na company
      await this.prisma.company.update({
        where: { id: companyId },
        data: { cnaePrincipal: cnaeCode },
      });
    }

    return this.prisma.companyCnae.create({
      data: {
        companyId,
        cnae: cnaeCode,
        descricao: dto.descricao?.trim() || null,
        principal: dto.principal ?? false,
      },
    });
  }

  async setPrincipal(companyId: string, cnaeId: string) {
    const cnae = await this.prisma.companyCnae.findFirst({
      where: { id: cnaeId, companyId },
    });
    if (!cnae) throw new NotFoundException('CNAE não encontrado');

    // Desmarca todos os principais
    await this.prisma.companyCnae.updateMany({
      where: { companyId, principal: true },
      data: { principal: false },
    });

    // Marca o novo principal
    const updated = await this.prisma.companyCnae.update({
      where: { id: cnaeId },
      data: { principal: true },
    });

    // Sincroniza cnaePrincipal na company
    await this.prisma.company.update({
      where: { id: companyId },
      data: { cnaePrincipal: updated.cnae },
    });

    return updated;
  }

  async removeCnae(companyId: string, cnaeId: string) {
    const cnae = await this.prisma.companyCnae.findFirst({
      where: { id: cnaeId, companyId },
    });
    if (!cnae) throw new NotFoundException('CNAE não encontrado');
    if (cnae.principal) {
      throw new BadRequestException(
        'Não é possível remover o CNAE principal. Defina outro como principal antes de remover este.',
      );
    }
    await this.prisma.companyCnae.delete({ where: { id: cnaeId } });
    return { ok: true };
  }

  async updateCnae(companyId: string, cnaeId: string, descricao: string) {
    const cnae = await this.prisma.companyCnae.findFirst({
      where: { id: cnaeId, companyId },
    });
    if (!cnae) throw new NotFoundException('CNAE não encontrado');
    return this.prisma.companyCnae.update({
      where: { id: cnaeId },
      data: { descricao: descricao?.trim() || null },
    });
  }

  // -----------------------------------------------------------------------
  // Tax Rates
  // -----------------------------------------------------------------------

  async getTaxRates(companyId: string) {
    const rates = await this.prisma.companyTaxRate.findFirst({
      where: {
        companyId,
        vigenciaInicio: { lte: new Date() },
        OR: [{ vigenciaFim: null }, { vigenciaFim: { gte: new Date() } }],
      },
      orderBy: { vigenciaInicio: 'desc' },
    });

    // Retorna padrões se não houver configuração
    return rates ?? {
      aliquotaPis: 0.65,
      aliquotaCofins: 3.0,
      aliquotaIss: 5.0,
      aliquotaCsll: 1.0,
      aliquotaIr: 1.5,
      aliquotaInss: 0.0,
      regime: null,
    };
  }

  async saveTaxRates(companyId: string, data: {
    aliquotaPis: number;
    aliquotaCofins: number;
    aliquotaIss: number;
    aliquotaCsll: number;
    aliquotaIr: number;
    aliquotaInss: number;
    aliquotaCbs?: number;
    aliquotaIbs?: number;
    regime: string;
  }, userId?: string) {
    // Captura alíquotas anteriores para auditoria
    const oldRates = await this.prisma.companyTaxRate.findFirst({
      where: { companyId, regime: data.regime as any, vigenciaFim: null },
      orderBy: { vigenciaInicio: 'desc' },
    });

    // Desativa alíquotas anteriores para este regime
    await this.prisma.companyTaxRate.updateMany({
      where: { companyId, regime: data.regime as any, vigenciaFim: null },
      data: { vigenciaFim: new Date() },
    });

    const created = await this.prisma.companyTaxRate.create({
      data: {
        companyId,
        regime: data.regime as any,
        aliquotaPis: data.aliquotaPis,
        aliquotaCofins: data.aliquotaCofins,
        aliquotaIss: data.aliquotaIss,
        aliquotaCsll: data.aliquotaCsll,
        aliquotaIr: data.aliquotaIr,
        aliquotaInss: data.aliquotaInss,
        aliquotaCbs: data.aliquotaCbs ?? 0.0,
        aliquotaIbs: data.aliquotaIbs ?? 0.0,
      },
    });

    // Auditoria de alíquotas
    try {
      const auditOld = oldRates
        ? {
            regime: oldRates.regime,
            aliquotaPis: Number(oldRates.aliquotaPis),
            aliquotaCofins: Number(oldRates.aliquotaCofins),
            aliquotaIss: Number(oldRates.aliquotaIss),
            aliquotaCsll: Number(oldRates.aliquotaCsll),
            aliquotaIr: Number(oldRates.aliquotaIr),
            aliquotaInss: Number(oldRates.aliquotaInss),
            aliquotaCbs: Number((oldRates as any).aliquotaCbs ?? 0),
            aliquotaIbs: Number((oldRates as any).aliquotaIbs ?? 0),
          }
        : null;
      const auditNew = {
        regime: data.regime,
        aliquotaPis: data.aliquotaPis,
        aliquotaCofins: data.aliquotaCofins,
        aliquotaIss: data.aliquotaIss,
        aliquotaCsll: data.aliquotaCsll,
        aliquotaIr: data.aliquotaIr,
        aliquotaInss: data.aliquotaInss,
        aliquotaCbs: data.aliquotaCbs ?? 0,
        aliquotaIbs: data.aliquotaIbs ?? 0,
      };
      await this.prisma.auditLog.create({
        data: {
          userId: userId ?? null,
          module: 'FISCAL' as any,
          action: 'UPDATE',
          entityType: 'company_tax_rates',
          entityId: companyId,
          oldData: (auditOld ?? {}) as any,
          newData: auditNew as any,
        },
      });
    } catch { /* auditoria não pode bloquear a operação */ }

    return created;
  }

  // -----------------------------------------------------------------------
  // Fiscal Audit Log
  // -----------------------------------------------------------------------

  async getFiscalAuditLog(companyId: string, limit = 50) {
    return this.prisma.auditLog.findMany({
      where: {
        module: 'FISCAL' as any,
        entityId: companyId,
        entityType: { in: ['company_fiscal_config', 'company_tax_rates'] },
      },
      include: {
        user: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  // -----------------------------------------------------------------------
  // Tax Retention Config (mínimos configuráveis + Reforma Tributária)
  // -----------------------------------------------------------------------

  async getTaxRetentionConfig(companyId: string) {
    const config = await this.prisma.taxRetentionConfig.findUnique({
      where: { companyId },
    });
    // Retorna defaults se não configurado
    return config ?? {
      minimoRetencaoPisCofinsCsll: 215.05,
      minimoRetencaoIrrf: 10.00,
      minimoRetencaoInss: 0.00,
      minimoRetencaoIss: 0.00,
      usarSistemaNovo: false,
      periodoReforma: null,
      aliquotaCbs: 0.9,
      aliquotaIbs: 0.1,
    };
  }

  async saveTaxRetentionConfig(companyId: string, data: {
    minimoRetencaoPisCofinsCsll?: number;
    minimoRetencaoIrrf?: number;
    minimoRetencaoInss?: number;
    minimoRetencaoIss?: number;
    usarSistemaNovo?: boolean;
    periodoReforma?: string;
    aliquotaCbs?: number;
    aliquotaIbs?: number;
  }) {
    return this.prisma.taxRetentionConfig.upsert({
      where: { companyId },
      create: { companyId, ...data },
      update: data,
    });
  }

  // ── Multi-empresa ────────────────────────────────────────────────────────

  async listUserCompanies(userId: string) {
    const links = await this.prisma.userCompany.findMany({
      where: { userId },
      include: {
        company: {
          select: { id: true, cnpj: true, razaoSocial: true, nomeFantasia: true, uf: true, municipio: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    return links.map((l) => l.company);
  }

  async createCompany(userId: string, dto: UpdateCompanyDto) {
    if (!dto.cnpj) throw new BadRequestException('CNPJ é obrigatório');

    const select = { id: true, cnpj: true, razaoSocial: true, nomeFantasia: true, uf: true, municipio: true };

    const existing = await this.prisma.company.findUnique({ where: { cnpj: dto.cnpj }, select });
    if (existing) {
      // Empresa já existe — apenas vincula o usuário se ainda não estiver vinculado
      await this.prisma.userCompany.upsert({
        where: { userId_companyId: { userId, companyId: existing.id } },
        create: { userId, companyId: existing.id },
        update: {},
      });
      return existing;
    }

    const company = await this.prisma.company.create({ data: dto as any, select });

    await this.prisma.userCompany.create({ data: { userId, companyId: company.id } });

    return company;
  }

  // -----------------------------------------------------------------------
  // Module Start Dates (datas de início por módulo fiscal)
  // -----------------------------------------------------------------------

  /**
   * Retorna todas as datas de início configuradas para a empresa, como um mapa
   * { module -> Date } para uso eficiente nos serviços de sync e calendário.
   * Também inclui dataInicioOperacao como fallback global.
   */
  async getModuleStartDatesMap(companyId: string): Promise<{
    global: Date | null;
    byModule: Record<string, Date>;
  }> {
    const [company, rows] = await Promise.all([
      this.prisma.company.findUnique({
        where: { id: companyId },
        select: { dataInicioOperacao: true },
      }),
      this.prisma.moduleStartDate.findMany({
        where: { companyId },
      }),
    ]);

    const byModule: Record<string, Date> = {};
    for (const row of rows) {
      byModule[row.module] = row.startDate;
    }

    return {
      global: company?.dataInicioOperacao ?? null,
      byModule,
    };
  }

  /** Resolve a data de início para um módulo específico, com fallback para global. */
  resolveModuleStartDate(
    map: { global: Date | null; byModule: Record<string, Date> },
    module: FiscalModule,
  ): Date | null {
    return map.byModule[module] ?? map.global ?? null;
  }

  /** Retorna lista de datas configuradas (para o endpoint GET). */
  async listModuleStartDates(companyId: string) {
    return this.prisma.moduleStartDate.findMany({
      where: { companyId },
      orderBy: { module: 'asc' },
    });
  }

  /** Upsert — cria ou atualiza a data de início de um módulo. */
  async upsertModuleStartDate(
    companyId: string,
    module: FiscalModule,
    startDate: string | null,
  ) {
    if (!startDate) {
      // null = remover a data do módulo (volta a usar o fallback global)
      await this.prisma.moduleStartDate.deleteMany({ where: { companyId, module } });
      return { module, startDate: null, deleted: true };
    }

    const date = new Date(startDate);
    return this.prisma.moduleStartDate.upsert({
      where: { companyId_module: { companyId, module } },
      create: { companyId, module, startDate: date },
      update: { startDate: date },
    });
  }

  /** Salva múltiplos módulos de uma vez (bulk upsert do frontend). */
  async bulkUpsertModuleStartDates(
    companyId: string,
    entries: Array<{ module: FiscalModule; startDate: string | null }>,
  ) {
    const results = await Promise.all(
      entries.map((e) => this.upsertModuleStartDate(companyId, e.module, e.startDate)),
    );
    return results;
  }
}
