import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';

export interface InssFaixaDto {
  limiteMax: number;
  aliquota: number;
  ordem: number;
}

export interface IrrfFaixaDto {
  limiteMax: number;
  aliquota: number;
  deducao: number;
  ordem: number;
}

export interface PayrollConfigDto {
  fgtsRate?: number;
  inssPatronalRate?: number;
  inssTeto?: number;
}

@Injectable()
export class PayrollConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async getConfig(companyId: string) {
    const [config, inssCount, irrfCount] = await Promise.all([
      this.prisma.payrollConfig.findUnique({ where: { companyId } }),
      this.prisma.inssFaixa.count({ where: { companyId } }),
      this.prisma.irrfFaixa.count({ where: { companyId } }),
    ]);

    return {
      config: config ?? {
        fgtsRate: 0.08,
        inssPatronalRate: 0.20,
        inssTeto: 7786.02,
      },
      hasInssFaixas: inssCount > 0,
      hasIrrfFaixas: irrfCount > 0,
    };
  }

  async updateConfig(companyId: string, dto: PayrollConfigDto) {
    return this.prisma.payrollConfig.upsert({
      where: { companyId },
      create: {
        companyId,
        fgtsRate: dto.fgtsRate ?? 0.08,
        inssPatronalRate: dto.inssPatronalRate ?? 0.20,
        inssTeto: dto.inssTeto ?? 7786.02,
      },
      update: {
        ...(dto.fgtsRate !== undefined && { fgtsRate: dto.fgtsRate }),
        ...(dto.inssPatronalRate !== undefined && { inssPatronalRate: dto.inssPatronalRate }),
        ...(dto.inssTeto !== undefined && { inssTeto: dto.inssTeto }),
      },
    });
  }

  async getFaixasPorAno(companyId: string, ano: number) {
    const [inssFaixas, irrfFaixas] = await Promise.all([
      this.prisma.inssFaixa.findMany({
        where: { companyId, ano },
        orderBy: { ordem: 'asc' },
      }),
      this.prisma.irrfFaixa.findMany({
        where: { companyId, ano },
        orderBy: { ordem: 'asc' },
      }),
    ]);

    return { ano, inssFaixas, irrfFaixas };
  }

  async saveInssFaixas(companyId: string, ano: number, faixas: InssFaixaDto[]) {
    if (!faixas || faixas.length === 0) {
      throw new BadRequestException('É necessário informar pelo menos uma faixa de INSS');
    }

    // Replace all faixas for this company/year in a transaction
    await this.prisma.$transaction(async (tx) => {
      await tx.inssFaixa.deleteMany({ where: { companyId, ano } });
      await tx.inssFaixa.createMany({
        data: faixas.map((f) => ({
          companyId,
          ano,
          limiteMax: f.limiteMax,
          aliquota: f.aliquota,
          ordem: f.ordem,
        })),
      });
    });

    return this.prisma.inssFaixa.findMany({
      where: { companyId, ano },
      orderBy: { ordem: 'asc' },
    });
  }

  async saveIrrfFaixas(companyId: string, ano: number, faixas: IrrfFaixaDto[]) {
    if (!faixas || faixas.length === 0) {
      throw new BadRequestException('É necessário informar pelo menos uma faixa de IRRF');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.irrfFaixa.deleteMany({ where: { companyId, ano } });
      await tx.irrfFaixa.createMany({
        data: faixas.map((f) => ({
          companyId,
          ano,
          limiteMax: f.limiteMax,
          aliquota: f.aliquota,
          deducao: f.deducao,
          ordem: f.ordem,
        })),
      });
    });

    return this.prisma.irrfFaixa.findMany({
      where: { companyId, ano },
      orderBy: { ordem: 'asc' },
    });
  }

  async importDefaults2025(companyId: string) {
    const ano = 2025;

    const inssFaixas2025: InssFaixaDto[] = [
      { ordem: 1, limiteMax: 1412.0, aliquota: 0.075 },
      { ordem: 2, limiteMax: 2666.68, aliquota: 0.09 },
      { ordem: 3, limiteMax: 4000.03, aliquota: 0.12 },
      { ordem: 4, limiteMax: 7786.02, aliquota: 0.14 },
    ];

    const irrfFaixas2025: IrrfFaixaDto[] = [
      { ordem: 1, limiteMax: 2259.2, aliquota: 0, deducao: 0 },
      { ordem: 2, limiteMax: 2826.65, aliquota: 0.075, deducao: 169.44 },
      { ordem: 3, limiteMax: 3751.05, aliquota: 0.15, deducao: 381.44 },
      { ordem: 4, limiteMax: 4664.68, aliquota: 0.225, deducao: 662.77 },
      { ordem: 5, limiteMax: 99999999, aliquota: 0.275, deducao: 896.0 },
    ];

    await this.prisma.$transaction(async (tx) => {
      await tx.inssFaixa.deleteMany({ where: { companyId, ano } });
      await tx.irrfFaixa.deleteMany({ where: { companyId, ano } });
      await tx.inssFaixa.createMany({
        data: inssFaixas2025.map((f) => ({ companyId, ano, ...f })),
      });
      await tx.irrfFaixa.createMany({
        data: irrfFaixas2025.map((f) => ({ companyId, ano, ...f })),
      });
    });

    return this.getFaixasPorAno(companyId, ano);
  }
}
