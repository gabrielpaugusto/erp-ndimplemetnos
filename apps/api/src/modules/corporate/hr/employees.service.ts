import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';

@Injectable()
export class EmployeesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    companyId: string,
    query: {
      status?: string;
      departamento?: string;
      search?: string;
      page?: string;
      limit?: string;
    },
  ) {
    const page = parseInt(query.page || '1', 10);
    const limit = parseInt(query.limit || '20', 10);
    const skip = (page - 1) * limit;

    const where: any = { companyId };

    if (query.status) {
      where.status = query.status;
    }

    if (query.departamento) {
      where.departamento = query.departamento;
    }

    if (query.search) {
      where.OR = [
        { matricula: { contains: query.search, mode: 'insensitive' } },
        {
          person: {
            razaoSocial: { contains: query.search, mode: 'insensitive' },
          },
        },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.employee.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          person: {
            select: { id: true, razaoSocial: true, cpfCnpj: true },
          },
          costCenter: { select: { id: true, code: true, name: true } },
        },
      }),
      this.prisma.employee.count({ where }),
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
    const employee = await this.prisma.employee.findUnique({
      where: { id },
      include: {
        person: true,
        costCenter: { select: { id: true, code: true, name: true } },
        user: { select: { id: true, name: true, email: true } },
        benefits: true,
      },
    });

    if (!employee) {
      throw new NotFoundException(`Employee ${id} not found`);
    }

    return employee;
  }

  async create(companyId: string, data: CreateEmployeeDto) {
    return this.prisma.employee.create({
      data: {
        companyId,
        personId: data.personId,
        userId: data.userId,
        matricula: data.matricula,
        cargo: data.cargo,
        departamento: data.departamento,
        costCenterId: data.costCenterId,
        dataAdmissao: new Date(data.dataAdmissao),
        salarioBase: data.salarioBase,
        valorHora: data.valorHora ?? null,
        ctps: data.ctps,
        pis: data.pis,
        jornadaSemanal: data.jornadaSemanal ?? 44,
        observations: data.observations,
      },
      include: {
        person: {
          select: { id: true, razaoSocial: true, cpfCnpj: true },
        },
      },
    });
  }

  async update(id: string, data: UpdateEmployeeDto) {
    const existing = await this.prisma.employee.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Employee ${id} not found`);
    }

    const updateData: any = { ...data };

    if (data.dataAdmissao) {
      updateData.dataAdmissao = new Date(data.dataAdmissao);
    }
    if (data.dataDemissao) {
      updateData.dataDemissao = new Date(data.dataDemissao);
    }

    return this.prisma.employee.update({
      where: { id },
      data: updateData,
      include: {
        person: {
          select: { id: true, razaoSocial: true, cpfCnpj: true },
        },
      },
    });
  }

  async terminate(id: string, dataDemissao?: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { id },
    });

    if (!employee) {
      throw new NotFoundException(`Employee ${id} not found`);
    }

    if (employee.status === 'DEMITIDO') {
      throw new BadRequestException('Employee is already terminated');
    }

    return this.prisma.employee.update({
      where: { id },
      data: {
        status: 'DEMITIDO',
        dataDemissao: dataDemissao
          ? new Date(dataDemissao)
          : new Date(),
      },
      include: {
        person: {
          select: { id: true, razaoSocial: true, cpfCnpj: true },
        },
      },
    });
  }

  async getStats(companyId: string) {
    const employees = await this.prisma.employee.findMany({
      where: { companyId },
      select: { status: true, departamento: true },
    });

    const byStatus: Record<string, number> = {};
    const byDepartamento: Record<string, number> = {};

    for (const e of employees) {
      byStatus[e.status] = (byStatus[e.status] || 0) + 1;
      byDepartamento[e.departamento] =
        (byDepartamento[e.departamento] || 0) + 1;
    }

    return {
      total: employees.length,
      byStatus,
      byDepartamento,
    };
  }
}
