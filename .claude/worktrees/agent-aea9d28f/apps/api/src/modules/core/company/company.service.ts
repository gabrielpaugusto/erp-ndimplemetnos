import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';

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
  cnaePrincipal?: string;
  // Ambientes por módulo (1=produção, 2=homologação)
  ambienteSefaz?: number;
  ambienteNfe?: number;
  ambienteNfce?: number;
  ambienteNfse?: number;
  ambienteSped?: number;
  ambienteEsocial?: number;
  ambienteReinf?: number;
  ambienteDctfweb?: number;
  // NF-e config
  serieNfe?: number;
  serieNfce?: number;
  proximoNumeroNfe?: number;
  proximoNumeroNfce?: number;
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
    const { certDigitalSenha: _s, certDigitalConteudo: _c, ...safe } = company;
    return safe;
  }

  async update(companyId: string, dto: UpdateCompanyDto) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new NotFoundException('Empresa não encontrada');

    // Extrai apenas os campos permitidos — evita erro do Prisma ao receber
    // campos extras (id, cnpj, cnaes, createdAt, etc.) vindos do frontend.
    const {
      cnpj, razaoSocial, nomeFantasia, inscricaoEstadual, inscricaoMunicipal,
      logradouro, numero, complemento, bairro, codigoMunicipioIbge,
      municipio, uf, cep, telefone, email, taxRegime, cnaePrincipal,
      ambienteSefaz, ambienteNfe, ambienteNfce, ambienteNfse,
      ambienteSped, ambienteEsocial, ambienteReinf, ambienteDctfweb,
      serieNfe, serieNfce, proximoNumeroNfe, proximoNumeroNfce,
    } = dto as Record<string, unknown>;

    // Normaliza campos com formatacao de mascara antes de salvar
    const cnpjDigits = cnpj     ? String(cnpj).replace(/\D/g, '').slice(0, 14) : cnpj;
    const cepDigits  = cep      ? String(cep).replace(/\D/g, '').slice(0, 8)   : cep;
    const foneDigits = telefone ? String(telefone).replace(/\D/g, '').slice(0, 20) : telefone;

    const safeData = Object.fromEntries(
      Object.entries({
        cnpj: cnpjDigits, razaoSocial, nomeFantasia, inscricaoEstadual, inscricaoMunicipal,
        logradouro, numero, complemento, bairro, codigoMunicipioIbge,
        municipio, uf, cep: cepDigits, telefone: foneDigits, email, taxRegime, cnaePrincipal,
        ambienteSefaz, ambienteNfe, ambienteNfce, ambienteNfse,
        ambienteSped, ambienteEsocial, ambienteReinf, ambienteDctfweb,
        serieNfe, serieNfce, proximoNumeroNfe, proximoNumeroNfce,
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
    const { certDigitalSenha: _s, certDigitalConteudo: _c, ...safe } = updated;
    return safe;
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
}
