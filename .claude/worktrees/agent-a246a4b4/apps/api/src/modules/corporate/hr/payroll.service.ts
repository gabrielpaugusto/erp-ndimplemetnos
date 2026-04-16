import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';
import { IntegrationService } from '@/modules/core/integration/integration.service';
import { CreatePayrollDto } from './dto/create-payroll.dto';
import { UpdatePayrollDto } from './dto/update-payroll.dto';

// Brazilian INSS progressive tax table (2024/2025 rates)
const INSS_TABLE = [
  { limit: 1412.0, rate: 0.075 },
  { limit: 2666.68, rate: 0.09 },
  { limit: 4000.03, rate: 0.12 },
  { limit: 7786.02, rate: 0.14 },
];

// Brazilian IRRF progressive tax table (2024/2025 rates)
const IRRF_TABLE = [
  { limit: 2259.2, rate: 0, deduction: 0 },
  { limit: 2826.65, rate: 0.075, deduction: 169.44 },
  { limit: 3751.05, rate: 0.15, deduction: 381.44 },
  { limit: 4664.68, rate: 0.225, deduction: 662.77 },
  { limit: Infinity, rate: 0.275, deduction: 896.0 },
];

const FGTS_RATE = 0.08;
const INSS_PATRONAL_RATE = 0.2;

@Injectable()
export class PayrollService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly integration: IntegrationService,
  ) {}

  private calculateINSS(salarioBruto: number): number {
    let inss = 0;
    let remaining = salarioBruto;
    let previousLimit = 0;

    for (const bracket of INSS_TABLE) {
      if (remaining <= 0) break;
      const bracketRange = bracket.limit - previousLimit;
      const taxable = Math.min(remaining, bracketRange);
      inss += taxable * bracket.rate;
      remaining -= taxable;
      previousLimit = bracket.limit;
    }

    return +inss.toFixed(2);
  }

  private calculateIRRF(
    salarioBruto: number,
    inss: number,
  ): number {
    const baseCalculo = salarioBruto - inss;

    for (const bracket of IRRF_TABLE) {
      if (baseCalculo <= bracket.limit) {
        const irrf = baseCalculo * bracket.rate - bracket.deduction;
        return +Math.max(irrf, 0).toFixed(2);
      }
    }

    return 0;
  }

  async findAll(
    companyId: string,
    query: {
      status?: string;
      type?: string;
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

    if (query.type) {
      where.type = query.type;
    }

    if (query.search) {
      where.periodoReferencia = {
        contains: query.search,
        mode: 'insensitive',
      };
    }

    const [data, total] = await Promise.all([
      this.prisma.payroll.findMany({
        where,
        skip,
        take: limit,
        orderBy: { periodoReferencia: 'desc' },
        include: {
          _count: { select: { items: true } },
        },
      }),
      this.prisma.payroll.count({ where }),
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
    const payroll = await this.prisma.payroll.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            employee: {
              include: {
                person: {
                  select: { id: true, razaoSocial: true, cpfCnpj: true },
                },
              },
            },
          },
        },
      },
    });

    if (!payroll) {
      throw new NotFoundException(`Payroll ${id} not found`);
    }

    return payroll;
  }

  async create(companyId: string, data: CreatePayrollDto) {
    return this.prisma.payroll.create({
      data: {
        companyId,
        periodoReferencia: data.periodoReferencia,
        type: (data.type as any) || 'MENSAL',
        observations: data.observations,
      },
    });
  }

  async update(id: string, data: UpdatePayrollDto) {
    const existing = await this.prisma.payroll.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Payroll ${id} not found`);
    }

    if (existing.status !== 'RASCUNHO') {
      throw new BadRequestException(
        'Only draft payrolls can be updated',
      );
    }

    return this.prisma.payroll.update({
      where: { id },
      data: data as any,
    });
  }

  async calculate(id: string) {
    const payroll = await this.prisma.payroll.findUnique({
      where: { id },
    });

    if (!payroll) {
      throw new NotFoundException(`Payroll ${id} not found`);
    }

    if (payroll.status !== 'RASCUNHO' && payroll.status !== 'CALCULADA') {
      throw new BadRequestException(
        'Only draft or previously calculated payrolls can be calculated',
      );
    }

    // Fetch active employees
    const employees = await this.prisma.employee.findMany({
      where: {
        companyId: payroll.companyId,
        status: 'ATIVO',
      },
      include: {
        benefits: { where: { active: true } },
      },
    });

    return this.prisma.$transaction(async (tx) => {
      // Clear existing items
      await tx.payrollItem.deleteMany({
        where: { payrollId: id },
      });

      let payrollTotalBruto = 0;
      let payrollTotalDescontos = 0;
      let payrollTotalLiquido = 0;
      let payrollTotalEncargos = 0;

      for (const employee of employees) {
        const salarioBase = Number(employee.salarioBase);
        const totalBruto = salarioBase;

        // Calculate deductions
        const inss = this.calculateINSS(totalBruto);
        const irrf = this.calculateIRRF(totalBruto, inss);

        // Benefits deductions
        const valeTransporte = employee.benefits
          .filter((b) => b.type === 'VALE_TRANSPORTE')
          .reduce((sum, b) => sum + Number(b.valorFuncionario), 0);
        const valeRefeicao = employee.benefits
          .filter(
            (b) =>
              b.type === 'VALE_REFEICAO' || b.type === 'VALE_ALIMENTACAO',
          )
          .reduce((sum, b) => sum + Number(b.valorFuncionario), 0);

        const totalDescontos = +(
          inss +
          irrf +
          valeTransporte +
          valeRefeicao
        ).toFixed(2);
        const totalLiquido = +(totalBruto - totalDescontos).toFixed(2);

        // Employer charges
        const fgts = +(totalBruto * FGTS_RATE).toFixed(2);
        const inssPatronal = +(totalBruto * INSS_PATRONAL_RATE).toFixed(2);

        await tx.payrollItem.create({
          data: {
            payrollId: id,
            employeeId: employee.id,
            salarioBase,
            horasExtras: 0,
            valorHorasExtras: 0,
            adicionalNoturno: 0,
            periculosidade: 0,
            insalubridade: 0,
            outrosProventos: 0,
            totalBruto,
            inss,
            irrf,
            valeTransporte,
            valeRefeicao,
            outrosDescontos: 0,
            totalDescontos,
            totalLiquido,
            fgts,
            inssPatronal,
          },
        });

        payrollTotalBruto += totalBruto;
        payrollTotalDescontos += totalDescontos;
        payrollTotalLiquido += totalLiquido;
        payrollTotalEncargos += fgts + inssPatronal;
      }

      return tx.payroll.update({
        where: { id },
        data: {
          status: 'CALCULADA',
          dataCalculo: new Date(),
          totalBruto: +payrollTotalBruto.toFixed(2),
          totalDescontos: +payrollTotalDescontos.toFixed(2),
          totalLiquido: +payrollTotalLiquido.toFixed(2),
          totalEncargos: +payrollTotalEncargos.toFixed(2),
        },
        include: {
          items: {
            include: {
              employee: {
                include: {
                  person: {
                    select: { id: true, razaoSocial: true },
                  },
                },
              },
            },
          },
        },
      });
    });
  }

  async approve(id: string) {
    const payroll = await this.prisma.payroll.findUnique({
      where: { id },
    });

    if (!payroll) {
      throw new NotFoundException(`Payroll ${id} not found`);
    }

    if (payroll.status !== 'CALCULADA') {
      throw new BadRequestException(
        'Only calculated payrolls can be approved',
      );
    }

    return this.prisma.payroll.update({
      where: { id },
      data: { status: 'APROVADA' },
    });
  }

  async pay(id: string) {
    const payroll = await this.prisma.payroll.findUnique({
      where: { id },
    });

    if (!payroll) {
      throw new NotFoundException(`Payroll ${id} not found`);
    }

    if (payroll.status !== 'APROVADA') {
      throw new BadRequestException(
        'Only approved payrolls can be paid',
      );
    }

    const result = await this.prisma.payroll.update({
      where: { id },
      data: {
        status: 'PAGA',
        dataPagamento: new Date(),
      },
    });

    // Fire integration (non-blocking)
    this.integration.onPayrollPaid(id, payroll.companyId, 'system').catch(err => console.error('Integration error:', err));

    return result;
  }

  async getStats(companyId: string) {
    const payrolls = await this.prisma.payroll.findMany({
      where: { companyId },
      select: {
        status: true,
        type: true,
        totalBruto: true,
        totalLiquido: true,
        totalEncargos: true,
      },
    });

    const byStatus: Record<
      string,
      { count: number; totalBruto: number; totalLiquido: number }
    > = {};

    for (const p of payrolls) {
      if (!byStatus[p.status]) {
        byStatus[p.status] = { count: 0, totalBruto: 0, totalLiquido: 0 };
      }
      byStatus[p.status].count++;
      byStatus[p.status].totalBruto += Number(p.totalBruto);
      byStatus[p.status].totalLiquido += Number(p.totalLiquido);
    }

    return { total: payrolls.length, byStatus };
  }
}
