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

    return this.prisma.person.create({
      data: {
        ...personData,
        type: personData.type as any,
        companyId,
        addresses: addresses
          ? { create: addresses.map((a) => ({ ...a, type: a.type as any })) as any }
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
  }

  async update(id: string, data: UpdatePersonDto) {
    const { addresses, contacts, ...personData } = data;

    return this.prisma.person.update({
      where: { id },
      data: personData as any,
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
