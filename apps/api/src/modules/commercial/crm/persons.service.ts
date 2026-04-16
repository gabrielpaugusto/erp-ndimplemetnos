import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';
import { CreatePersonDto, CreateAddressDto, CreateContactDto } from './dto/create-person.dto';
import { UpdatePersonDto } from './dto/update-person.dto';

@Injectable()
export class PersonsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    companyId: string,
    query: {
      search?: string;
      type?: string;
      role?: string;
      active?: string;
      page?: string;
      limit?: string;
    },
  ) {
    const page = parseInt(query.page || '1', 10);
    const limit = parseInt(query.limit || '20', 10);
    const skip = (page - 1) * limit;

    const where: any = { companyId };

    if (query.search) {
      where.OR = [
        { razaoSocial: { contains: query.search, mode: 'insensitive' } },
        { cpfCnpj: { contains: query.search } },
      ];
    }

    if (query.type) {
      where.type = query.type;
    }

    if (query.role) {
      where.roles = { has: query.role };
    }

    if (query.active !== undefined) {
      where.active = query.active === 'true';
    }

    const [data, total] = await Promise.all([
      this.prisma.person.findMany({
        where,
        skip,
        take: limit,
        orderBy: { razaoSocial: 'asc' },
      }),
      this.prisma.person.count({ where }),
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

  async findOne(id: string) {
    return this.prisma.person.findUniqueOrThrow({
      where: { id },
      include: {
        addresses: true,
        contacts: true,
        bankAccounts: true,
      },
    });
  }

  async create(companyId: string, data: CreatePersonDto) {
    const { addresses, contacts, ...personData } = data;

    const person = await this.prisma.person.create({
      data: {
        ...personData,
        cpfCnpj: (personData.cpfCnpj ?? '').replace(/\D/g, ''),
        type: personData.type as any,
        companyId,
        addresses: addresses
          ? {
              create: addresses.map((a) => ({
                ...a,
                cep: (a.cep ?? '').replace(/\D/g, ''),
                type: a.type as any,
              })) as any,
            }
          : undefined,
        contacts: contacts
          ? { create: contacts.map((c) => ({ ...c, type: c.type as any })) as any }
          : undefined,
      } as any,
      include: {
        addresses: true,
        contacts: true,
      },
    });

    // Auto-vincular NF-es existentes ao novo cadastro pelo CNPJ/CPF
    const cpfCnpj = (personData.cpfCnpj ?? '').replace(/\D/g, '');
    if (cpfCnpj) {
      await this.linkNfesToPerson(companyId, cpfCnpj, person.id);
    }

    return person;
  }

  async update(id: string, data: UpdatePersonDto) {
    const { addresses, contacts, ...personData } = data;

    const person = await this.prisma.person.update({
      where: { id },
      data: {
        ...personData,
        ...(personData.cpfCnpj ? { cpfCnpj: personData.cpfCnpj.replace(/\D/g, '') } : {}),
      } as any,
    });

    // Auto-vincular NF-es existentes ao cadastro atualizado pelo CNPJ/CPF
    const cpfCnpj = personData.cpfCnpj
      ? personData.cpfCnpj.replace(/\D/g, '')
      : person.cpfCnpj;
    if (cpfCnpj) {
      await this.linkNfesToPerson(person.companyId, cpfCnpj, person.id);
    }

    return person;
  }

  /**
   * Vincula NF-es sem emitentePessoaId ao cadastro correto pelo CNPJ.
   * Chamado automaticamente após criar/atualizar uma pessoa.
   */
  private async linkNfesToPerson(companyId: string, cpfCnpj: string, personId: string) {
    const clean = cpfCnpj.replace(/\D/g, '');
    if (!clean) return;
    await (this.prisma as any).nFeInbox.updateMany({
      where: {
        companyId,
        emitenteCnpj: clean,
        emitentePessoaId: null,
      },
      data: { emitentePessoaId: personId },
    });
  }

  async findFiscalData(personId: string, companyId: string) {
    return this.prisma.person.findFirst({
      where: { id: personId, companyId },
      select: {
        id: true,
        cpfCnpj: true,
        razaoSocial: true,
        type: true,
        taxRegime: true,
        optanteSimples: true,
        retencaoIss: true,
        retencaoFederal: true,
        retencaoInss: true,
        municipioIbge: true,
        inscricaoMunicipal: true,
      },
    });
  }

  async findFiscalDataByCpfCnpj(cpfCnpj: string, companyId: string) {
    return this.prisma.person.findFirst({
      where: { cpfCnpj: cpfCnpj.replace(/\D/g, ''), companyId },
      select: {
        id: true,
        type: true,
        razaoSocial: true,
        taxRegime: true,
        optanteSimples: true,
        retencaoIss: true,
        retencaoFederal: true,
        retencaoInss: true,
      },
    });
  }

  async remove(id: string) {
    return this.prisma.person.update({
      where: { id },
      data: { active: false },
    });
  }

  async addAddress(personId: string, data: CreateAddressDto) {
    return this.prisma.personAddress.create({
      data: {
        ...data,
        type: data.type as any,
        personId,
      } as any,
    });
  }

  async addContact(personId: string, data: CreateContactDto) {
    return this.prisma.personContact.create({
      data: {
        ...data,
        type: data.type as any,
        personId,
      } as any,
    });
  }
}
