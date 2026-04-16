import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';

@Injectable()
export class CstPisCofinsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: { search?: string; active?: string; tipo?: string; regime?: string; page?: string; limit?: string }) {
    const page = parseInt(query.page || '1', 10);
    const limit = parseInt(query.limit || '50', 10);
    const skip = (page - 1) * limit;
    const where: any = {};
    if (query.search) {
      where.OR = [
        { code: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query.active !== undefined) where.active = query.active === 'true';
    if (query.tipo) where.tipo = query.tipo;
    if (query.regime) where.regime = query.regime;
    const [data, total] = await Promise.all([
      this.prisma.cstPisCofins.findMany({ where, skip, take: limit, orderBy: { code: 'asc' } }),
      this.prisma.cstPisCofins.count({ where }),
    ]);
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string) {
    return this.prisma.cstPisCofins.findUniqueOrThrow({ where: { id } });
  }

  async findByCode(code: string) {
    return this.prisma.cstPisCofins.findUnique({ where: { code } });
  }

  async create(data: { code: string; description: string; tipo: string; regime: string; active?: boolean }) {
    return this.prisma.cstPisCofins.create({ data });
  }

  async update(id: string, data: Partial<{ code: string; description: string; tipo: string; regime: string; active: boolean }>) {
    return this.prisma.cstPisCofins.update({ where: { id }, data });
  }
}
