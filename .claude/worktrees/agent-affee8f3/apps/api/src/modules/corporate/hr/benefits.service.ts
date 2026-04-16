import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';
import { CreateBenefitDto } from './dto/create-benefit.dto';
import { UpdateBenefitDto } from './dto/update-benefit.dto';

@Injectable()
export class BenefitsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    companyId: string,
    query: {
      type?: string;
      active?: string;
      search?: string;
      page?: string;
      limit?: string;
    },
  ) {
    const page = parseInt(query.page || '1', 10);
    const limit = parseInt(query.limit || '20', 10);
    const skip = (page - 1) * limit;

    const where: any = {
      employee: { companyId },
    };

    if (query.type) {
      where.type = query.type;
    }

    if (query.active !== undefined) {
      where.active = query.active === 'true';
    }

    if (query.search) {
      where.description = { contains: query.search, mode: 'insensitive' };
    }

    const [data, total] = await Promise.all([
      this.prisma.employeeBenefit.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          employee: {
            include: {
              person: {
                select: { id: true, razaoSocial: true },
              },
            },
          },
        },
      }),
      this.prisma.employeeBenefit.count({ where }),
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
    const benefit = await this.prisma.employeeBenefit.findUnique({
      where: { id },
      include: {
        employee: {
          include: {
            person: {
              select: { id: true, razaoSocial: true, cpfCnpj: true },
            },
          },
        },
      },
    });

    if (!benefit) {
      throw new NotFoundException(`Benefit ${id} not found`);
    }

    return benefit;
  }

  async create(data: CreateBenefitDto) {
    return this.prisma.employeeBenefit.create({
      data: {
        employeeId: data.employeeId,
        type: data.type as any,
        description: data.description,
        valorEmpresa: data.valorEmpresa,
        valorFuncionario: data.valorFuncionario,
        active: data.active ?? true,
      },
      include: {
        employee: {
          include: {
            person: {
              select: { id: true, razaoSocial: true },
            },
          },
        },
      },
    });
  }

  async update(id: string, data: UpdateBenefitDto) {
    const existing = await this.prisma.employeeBenefit.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Benefit ${id} not found`);
    }

    return this.prisma.employeeBenefit.update({
      where: { id },
      data: data as any,
    });
  }

  async getByEmployee(employeeId: string) {
    const benefits = await this.prisma.employeeBenefit.findMany({
      where: { employeeId },
      orderBy: { type: 'asc' },
    });

    return { data: benefits };
  }

  async getSummary(companyId: string) {
    const benefits = await this.prisma.employeeBenefit.findMany({
      where: {
        employee: { companyId },
        active: true,
      },
      select: {
        type: true,
        valorEmpresa: true,
        valorFuncionario: true,
      },
    });

    const byType: Record<
      string,
      {
        count: number;
        totalEmpresa: number;
        totalFuncionario: number;
      }
    > = {};

    for (const b of benefits) {
      if (!byType[b.type]) {
        byType[b.type] = {
          count: 0,
          totalEmpresa: 0,
          totalFuncionario: 0,
        };
      }
      byType[b.type].count++;
      byType[b.type].totalEmpresa += Number(b.valorEmpresa);
      byType[b.type].totalFuncionario += Number(b.valorFuncionario);
    }

    const totalCostEmpresa = Object.values(byType).reduce(
      (sum, v) => sum + v.totalEmpresa,
      0,
    );

    return {
      totalBenefits: benefits.length,
      totalCostEmpresa,
      byType,
    };
  }
}
