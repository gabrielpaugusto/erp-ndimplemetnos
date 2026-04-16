import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';
import { CreateTaxRuleDto } from './dto/create-tax-rule.dto';
import { UpdateTaxRuleDto } from './dto/update-tax-rule.dto';

@Injectable()
export class TaxRulesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    companyId: string,
    query: {
      search?: string;
      ncmCode?: string;
      cfopCode?: string;
      operation?: string;
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
        { name: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.ncmCode) {
      where.ncmCode = query.ncmCode;
    }

    if (query.cfopCode) {
      where.cfopCode = query.cfopCode;
    }

    if (query.operation) {
      where.operation = query.operation;
    }

    if (query.active !== undefined) {
      where.active = query.active === 'true';
    }

    const [data, total] = await Promise.all([
      this.prisma.taxRule.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ priority: 'desc' }, { name: 'asc' }],
      }),
      this.prisma.taxRule.count({ where }),
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
    const rule = await this.prisma.taxRule.findUnique({
      where: { id },
    });

    if (!rule) {
      throw new NotFoundException(`Tax rule ${id} not found`);
    }

    return rule;
  }

  async create(companyId: string, data: CreateTaxRuleDto) {
    return this.prisma.taxRule.create({
      data: {
        companyId,
        name: data.name,
        description: data.description || null,
        ncmCode: data.ncmCode || null,
        cfopCode: data.cfopCode || null,
        operation: (data.operation as any) || null,
        cstIcms: data.cstIcms || null,
        aliqIcms: data.aliqIcms ?? null,
        reducaoBcIcms: data.reducaoBcIcms ?? null,
        cstIpi: data.cstIpi || null,
        aliqIpi: data.aliqIpi ?? null,
        cstPis: data.cstPis || null,
        aliqPis: data.aliqPis ?? null,
        cstCofins: data.cstCofins || null,
        aliqCofins: data.aliqCofins ?? null,
        aliqIbs: data.aliqIbs ?? null,
        aliqCbs: data.aliqCbs ?? null,
        aliqIs: data.aliqIs ?? null,
        active: data.active ?? true,
        priority: data.priority ?? 0,
      },
    });
  }

  async update(id: string, data: UpdateTaxRuleDto) {
    const existing = await this.prisma.taxRule.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Tax rule ${id} not found`);
    }

    return this.prisma.taxRule.update({
      where: { id },
      data: data as any,
    });
  }

  async remove(id: string) {
    const existing = await this.prisma.taxRule.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Tax rule ${id} not found`);
    }

    await this.prisma.taxRule.delete({ where: { id } });

    return { deleted: true };
  }
}
