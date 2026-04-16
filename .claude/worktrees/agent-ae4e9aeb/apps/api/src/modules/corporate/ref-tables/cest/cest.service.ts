import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';

@Injectable()
export class CestService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: { search?: string; active?: string; segmento?: string; page?: string; limit?: string }) {
    const page = parseInt(query.page || '1', 10);
    const limit = parseInt(query.limit || '50', 10);
    const skip = (page - 1) * limit;
    const where: any = {};
    if (query.search) {
      where.OR = [
        { code: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
        { ncmRelacionado: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query.active !== undefined) where.active = query.active === 'true';
    if (query.segmento) where.segmento = query.segmento;
    const [data, total] = await Promise.all([
      this.prisma.cest.findMany({ where, skip, take: limit, orderBy: { code: 'asc' } }),
      this.prisma.cest.count({ where }),
    ]);
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string) {
    return this.prisma.cest.findUniqueOrThrow({ where: { id } });
  }

  async findByCode(code: string) {
    return this.prisma.cest.findUnique({ where: { code } });
  }

  async create(data: { code: string; codeFormatted: string; segmento: string; description: string; ncmRelacionado?: string; active?: boolean }) {
    return this.prisma.cest.create({ data });
  }

  async update(id: string, data: Partial<{ code: string; codeFormatted: string; segmento: string; description: string; ncmRelacionado: string; active: boolean }>) {
    return this.prisma.cest.update({ where: { id }, data });
  }
}
