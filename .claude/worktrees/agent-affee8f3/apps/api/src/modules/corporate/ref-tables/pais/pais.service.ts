import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';

@Injectable()
export class PaisService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: { search?: string; active?: string; page?: string; limit?: string }) {
    const page = parseInt(query.page || '1', 10);
    const limit = parseInt(query.limit || '50', 10);
    const skip = (page - 1) * limit;
    const where: any = {};
    if (query.search) {
      where.OR = [
        { code: { contains: query.search, mode: 'insensitive' } },
        { name: { contains: query.search, mode: 'insensitive' } },
        { iso2: { contains: query.search, mode: 'insensitive' } },
        { iso3: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query.active !== undefined) where.active = query.active === 'true';
    const [data, total] = await Promise.all([
      this.prisma.pais.findMany({ where, skip, take: limit, orderBy: { name: 'asc' } }),
      this.prisma.pais.count({ where }),
    ]);
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string) {
    return this.prisma.pais.findUniqueOrThrow({ where: { id } });
  }

  async findByCode(code: string) {
    return this.prisma.pais.findUnique({ where: { code } });
  }

  async create(data: { code: string; iso2?: string; iso3?: string; name: string; nameEn?: string; active?: boolean }) {
    return this.prisma.pais.create({ data });
  }

  async update(id: string, data: Partial<{ code: string; iso2: string; iso3: string; name: string; nameEn: string; active: boolean }>) {
    return this.prisma.pais.update({ where: { id }, data });
  }
}
