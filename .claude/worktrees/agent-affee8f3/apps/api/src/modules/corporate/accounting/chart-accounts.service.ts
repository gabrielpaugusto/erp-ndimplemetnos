import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';
import { CreateChartAccountDto } from './dto/create-chart-account.dto';
import { UpdateChartAccountDto } from './dto/update-chart-account.dto';

@Injectable()
export class ChartAccountsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    companyId: string,
    query: {
      type?: string;
      nature?: string;
      level?: string;
      active?: string;
      search?: string;
      page?: string;
      limit?: string;
    },
  ) {
    const page = parseInt(query.page || '1', 10);
    const limit = parseInt(query.limit || '50', 10);
    const skip = (page - 1) * limit;

    const where: any = { companyId };

    if (query.type) {
      where.type = query.type;
    }

    if (query.nature) {
      where.nature = query.nature;
    }

    if (query.level) {
      where.level = parseInt(query.level, 10);
    }

    if (query.active !== undefined) {
      where.active = query.active === 'true';
    }

    if (query.search) {
      where.OR = [
        { code: { contains: query.search, mode: 'insensitive' } },
        { name: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.chartOfAccount.findMany({
        where,
        skip,
        take: limit,
        orderBy: { code: 'asc' },
        include: {
          parent: { select: { id: true, code: true, name: true } },
        },
      }),
      this.prisma.chartOfAccount.count({ where }),
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

  async findTree(companyId: string) {
    const accounts = await this.prisma.chartOfAccount.findMany({
      where: { companyId, parentId: null },
      orderBy: { code: 'asc' },
      include: {
        children: {
          orderBy: { code: 'asc' },
          include: {
            children: {
              orderBy: { code: 'asc' },
              include: {
                children: {
                  orderBy: { code: 'asc' },
                  include: {
                    children: { orderBy: { code: 'asc' } },
                  },
                },
              },
            },
          },
        },
      },
    });

    return accounts;
  }

  async findOne(id: string) {
    const account = await this.prisma.chartOfAccount.findUnique({
      where: { id },
      include: {
        parent: { select: { id: true, code: true, name: true } },
        children: {
          orderBy: { code: 'asc' },
          select: { id: true, code: true, name: true, type: true, active: true },
        },
      },
    });

    if (!account) {
      throw new NotFoundException(`Chart account ${id} not found`);
    }

    return account;
  }

  async create(companyId: string, data: CreateChartAccountDto) {
    return this.prisma.chartOfAccount.create({
      data: {
        companyId,
        parentId: data.parentId,
        code: data.code,
        name: data.name,
        type: data.type as any,
        nature: data.nature as any,
        level: data.level,
        acceptsEntries: data.acceptsEntries ?? true,
      },
      include: {
        parent: { select: { id: true, code: true, name: true } },
      },
    });
  }

  async update(id: string, data: UpdateChartAccountDto) {
    const existing = await this.prisma.chartOfAccount.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Chart account ${id} not found`);
    }

    return this.prisma.chartOfAccount.update({
      where: { id },
      data: data as any,
      include: {
        parent: { select: { id: true, code: true, name: true } },
      },
    });
  }

  async remove(id: string) {
    const existing = await this.prisma.chartOfAccount.findUnique({
      where: { id },
      include: { children: { select: { id: true } } },
    });

    if (!existing) {
      throw new NotFoundException(`Chart account ${id} not found`);
    }

    if (existing.children.length > 0) {
      throw new NotFoundException(
        `Cannot delete account with children. Remove child accounts first.`,
      );
    }

    return this.prisma.chartOfAccount.delete({ where: { id } });
  }
}
