import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';

@Injectable()
export class IcmsInterestadualService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: { search?: string; active?: string; ufOrigem?: string; ufDestino?: string; tipo?: string; page?: string; limit?: string }) {
    const page = parseInt(query.page || '1', 10);
    const limit = parseInt(query.limit || '50', 10);
    const skip = (page - 1) * limit;
    const where: any = {};
    if (query.search) {
      where.OR = [
        { ufOrigem: { contains: query.search, mode: 'insensitive' } },
        { ufDestino: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query.active !== undefined) where.active = query.active === 'true';
    if (query.ufOrigem) where.ufOrigem = query.ufOrigem.toUpperCase();
    if (query.ufDestino) where.ufDestino = query.ufDestino.toUpperCase();
    if (query.tipo) where.tipo = query.tipo;
    const [data, total] = await Promise.all([
      this.prisma.icmsInterestadual.findMany({ where, skip, take: limit, orderBy: [{ ufOrigem: 'asc' }, { ufDestino: 'asc' }] }),
      this.prisma.icmsInterestadual.count({ where }),
    ]);
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string) {
    return this.prisma.icmsInterestadual.findUniqueOrThrow({ where: { id } });
  }

  async findRate(ufOrigem: string, ufDestino: string, tipo: string = 'NORMAL') {
    const rule = await this.prisma.icmsInterestadual.findFirst({
      where: { ufOrigem, ufDestino, tipo, active: true },
    });
    return rule?.aliquota ?? (tipo === 'IMPORTADO' ? 4 : 12);
  }

  async create(data: { ufOrigem: string; ufDestino: string; aliquota: number; tipo?: string; active?: boolean }) {
    return this.prisma.icmsInterestadual.create({ data });
  }

  async update(id: string, data: Partial<{ ufOrigem: string; ufDestino: string; aliquota: number; tipo: string; active: boolean }>) {
    return this.prisma.icmsInterestadual.update({ where: { id }, data });
  }
}
