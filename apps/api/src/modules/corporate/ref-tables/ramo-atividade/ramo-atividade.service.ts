import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';

@Injectable()
export class RamoAtividadeService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: { ativo?: string } = {}) {
    const where: any = {};
    if (query.ativo !== undefined) where.ativo = query.ativo === 'true';
    return this.prisma.ramoAtividade.findMany({
      where,
      orderBy: { ordem: 'asc' },
    });
  }

  async findOne(id: string) {
    return this.prisma.ramoAtividade.findUniqueOrThrow({ where: { id } });
  }

  async create(data: {
    codigo: string;
    descricao: string;
    ativo?: boolean;
    ordem?: number;
  }) {
    return this.prisma.ramoAtividade.create({ data });
  }

  async update(
    id: string,
    data: Partial<{
      codigo: string;
      descricao: string;
      ativo: boolean;
      ordem: number;
    }>,
  ) {
    return this.prisma.ramoAtividade.update({ where: { id }, data });
  }
}
