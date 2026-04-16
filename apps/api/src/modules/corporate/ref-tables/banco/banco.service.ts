import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';

@Injectable()
export class BancoService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: { search?: string; active?: string; tipo?: string; page?: string; limit?: string }) {
    const page = parseInt(query.page || '1', 10);
    const limit = parseInt(query.limit || '50', 10);
    const skip = (page - 1) * limit;
    const where: any = {};
    if (query.search) {
      where.OR = [
        { code: { contains: query.search, mode: 'insensitive' } },
        { name: { contains: query.search, mode: 'insensitive' } },
        { shortName: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query.active !== undefined) where.active = query.active === 'true';
    if (query.tipo) where.tipo = query.tipo;
    const [data, total] = await Promise.all([
      this.prisma.banco.findMany({ where, skip, take: limit, orderBy: { code: 'asc' } }),
      this.prisma.banco.count({ where }),
    ]);
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string) {
    return this.prisma.banco.findUniqueOrThrow({ where: { id } });
  }

  async findByCode(code: string) {
    return this.prisma.banco.findUnique({ where: { code } });
  }

  async create(data: { code: string; ispb?: string; name: string; shortName?: string; tipo?: string; active?: boolean }) {
    return this.prisma.banco.create({ data });
  }

  async update(id: string, data: Partial<{ code: string; ispb: string; name: string; shortName: string; tipo: string; active: boolean }>) {
    return this.prisma.banco.update({ where: { id }, data });
  }
}
