import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
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

    try {
      return await this.prisma.chartOfAccount.delete({ where: { id } });
    } catch (error) {
      if (error?.code === 'P2003' || error?.code === 'P2014') {
        throw new ConflictException('Registro em uso e não pode ser excluído');
      }
      throw error;
    }
  }

  async seedDefaults(companyId: string) {
    const defaults: Array<{
      code: string;
      name: string;
      type: string;
      nature: string;
      level: number;
      parentCode?: string;
    }> = [
      { code: '1',         name: 'ATIVO',                              type: 'PATRIMONIAL',  nature: 'DEVEDORA', level: 1 },
      { code: '1.1',       name: 'ATIVO CIRCULANTE',                   type: 'PATRIMONIAL',  nature: 'DEVEDORA', level: 2, parentCode: '1' },
      { code: '1.1.1',     name: 'Disponibilidades',                   type: 'PATRIMONIAL',  nature: 'DEVEDORA', level: 3, parentCode: '1.1' },
      { code: '1.1.1.001', name: 'Caixa e equivalentes',               type: 'PATRIMONIAL',  nature: 'DEVEDORA', level: 4, parentCode: '1.1.1' },
      { code: '1.1.1.002', name: 'Banco conta corrente',               type: 'PATRIMONIAL',  nature: 'DEVEDORA', level: 4, parentCode: '1.1.1' },
      { code: '1.1.2',     name: 'Créditos',                           type: 'PATRIMONIAL',  nature: 'DEVEDORA', level: 3, parentCode: '1.1' },
      { code: '1.1.2.001', name: 'Clientes (duplicatas a receber)',     type: 'PATRIMONIAL',  nature: 'DEVEDORA', level: 4, parentCode: '1.1.2' },
      { code: '1.1.4',     name: 'Estoques',                           type: 'PATRIMONIAL',  nature: 'DEVEDORA', level: 3, parentCode: '1.1' },
      { code: '1.1.4.001', name: 'Estoque matéria-prima',              type: 'PATRIMONIAL',  nature: 'DEVEDORA', level: 4, parentCode: '1.1.4' },
      { code: '1.1.4.002', name: 'Estoque produtos acabados',          type: 'PATRIMONIAL',  nature: 'DEVEDORA', level: 4, parentCode: '1.1.4' },
      { code: '1.1.4.003', name: 'Estoque mercadorias',                type: 'PATRIMONIAL',  nature: 'DEVEDORA', level: 4, parentCode: '1.1.4' },
      { code: '2',         name: 'PASSIVO',                            type: 'PATRIMONIAL',  nature: 'CREDORA',  level: 1 },
      { code: '2.1',       name: 'PASSIVO CIRCULANTE',                 type: 'PATRIMONIAL',  nature: 'CREDORA',  level: 2, parentCode: '2' },
      { code: '2.1.1',     name: 'Obrigações comerciais',              type: 'PATRIMONIAL',  nature: 'CREDORA',  level: 3, parentCode: '2.1' },
      { code: '2.1.1.001', name: 'Fornecedores (duplicatas a pagar)',  type: 'PATRIMONIAL',  nature: 'CREDORA',  level: 4, parentCode: '2.1.1' },
      { code: '2.1.2',     name: 'Obrigações trabalhistas',            type: 'PATRIMONIAL',  nature: 'CREDORA',  level: 3, parentCode: '2.1' },
      { code: '2.1.2.001', name: 'Salários a pagar',                   type: 'PATRIMONIAL',  nature: 'CREDORA',  level: 4, parentCode: '2.1.2' },
      { code: '2.1.2.002', name: 'FGTS a recolher',                    type: 'PATRIMONIAL',  nature: 'CREDORA',  level: 4, parentCode: '2.1.2' },
      { code: '2.1.2.003', name: 'INSS a recolher',                    type: 'PATRIMONIAL',  nature: 'CREDORA',  level: 4, parentCode: '2.1.2' },
      { code: '3',         name: 'RECEITAS',                           type: 'RESULTADO',    nature: 'CREDORA',  level: 1 },
      { code: '3.1',       name: 'Receitas operacionais',              type: 'RESULTADO',    nature: 'CREDORA',  level: 2, parentCode: '3' },
      { code: '3.1.1',     name: 'Receita de vendas',                  type: 'RESULTADO',    nature: 'CREDORA',  level: 3, parentCode: '3.1' },
      { code: '3.1.1.001', name: 'Receita de vendas de mercadorias',   type: 'RESULTADO',    nature: 'CREDORA',  level: 4, parentCode: '3.1.1' },
      { code: '3.1.2',     name: 'Receita de serviços',                type: 'RESULTADO',    nature: 'CREDORA',  level: 3, parentCode: '3.1' },
      { code: '3.1.2.001', name: 'Receita de prestação de serviços',   type: 'RESULTADO',    nature: 'CREDORA',  level: 4, parentCode: '3.1.2' },
      { code: '4',         name: 'DESPESAS E CUSTOS',                  type: 'RESULTADO',    nature: 'DEVEDORA', level: 1 },
      { code: '4.1',       name: 'Custos operacionais',                type: 'RESULTADO',    nature: 'DEVEDORA', level: 2, parentCode: '4' },
      { code: '4.1.1',     name: 'Custo das mercadorias vendidas',     type: 'RESULTADO',    nature: 'DEVEDORA', level: 3, parentCode: '4.1' },
      { code: '4.1.1.001', name: 'CMV — custo das mercadorias vendidas', type: 'RESULTADO',  nature: 'DEVEDORA', level: 4, parentCode: '4.1.1' },
      { code: '4.2',       name: 'Despesas administrativas',           type: 'RESULTADO',    nature: 'DEVEDORA', level: 2, parentCode: '4' },
      { code: '4.2.1',     name: 'Despesas com pessoal',               type: 'RESULTADO',    nature: 'DEVEDORA', level: 3, parentCode: '4.2' },
      { code: '4.2.1.001', name: 'Despesa com salários',               type: 'RESULTADO',    nature: 'DEVEDORA', level: 4, parentCode: '4.2.1' },
      { code: '4.2.1.002', name: 'Despesa FGTS',                       type: 'RESULTADO',    nature: 'DEVEDORA', level: 4, parentCode: '4.2.1' },
      { code: '4.2.1.003', name: 'Despesa INSS patronal',              type: 'RESULTADO',    nature: 'DEVEDORA', level: 4, parentCode: '4.2.1' },
    ];

    const idMap = new Map<string, string>();
    let created = 0;
    let skipped = 0;

    for (const entry of defaults) {
      const existing = await this.prisma.chartOfAccount.findFirst({
        where: { companyId, code: entry.code },
      });
      if (existing) {
        idMap.set(entry.code, existing.id);
        skipped++;
        continue;
      }
      const parentId = entry.parentCode ? idMap.get(entry.parentCode) ?? null : null;
      const account = await this.prisma.chartOfAccount.create({
        data: {
          companyId,
          code: entry.code,
          name: entry.name,
          type: entry.type as any,
          nature: entry.nature as any,
          level: entry.level,
          parentId,
          acceptsEntries: entry.level === 4,
        },
      });
      idMap.set(entry.code, account.id);
      created++;
    }

    return { created, skipped, total: defaults.length };
  }
}
