import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';
import { ABBREVIATIONS_SEED } from './product-abbreviations.seed';

@Injectable()
export class ProductAbbreviationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(companyId: string, search?: string) {
    return this.prisma.productAbbreviation.findMany({
      where: {
        companyId,
        active: true,
        ...(search
          ? {
              OR: [
                { code: { contains: search, mode: 'insensitive' } },
                { fullText: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: [{ category: 'asc' }, { code: 'asc' }],
    });
  }

  async create(
    companyId: string,
    data: { code: string; fullText: string; category?: string },
  ) {
    return this.prisma.productAbbreviation.create({
      data: {
        companyId,
        code: data.code.toUpperCase(),
        fullText: data.fullText,
        category: data.category,
      },
    });
  }

  async update(
    id: string,
    data: { fullText?: string; category?: string; active?: boolean },
  ) {
    return this.prisma.productAbbreviation.update({ where: { id }, data });
  }

  async seedForCompany(companyId: string) {
    let created = 0;
    for (const abbr of ABBREVIATIONS_SEED) {
      const exists = await this.prisma.productAbbreviation.findFirst({
        where: { companyId, code: abbr.code },
      });
      if (!exists) {
        await this.prisma.productAbbreviation.create({
          data: {
            companyId,
            code: abbr.code,
            fullText: abbr.fullText,
            category: abbr.category,
          },
        });
        created++;
      }
    }
    return { message: `${created} abreviações inicializadas com sucesso.` };
  }
}
