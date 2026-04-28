import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';

@Injectable()
export class NaturezaJuridicaService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: { ativo?: string } = {}) {
    const where: any = {};
    if (query.ativo !== undefined) where.ativo = query.ativo === 'true';
    return this.prisma.naturezaJuridica.findMany({
      where,
      orderBy: { ordem: 'asc' },
    });
  }

  async findOne(id: string) {
    return this.prisma.naturezaJuridica.findUniqueOrThrow({ where: { id } });
  }

  async create(data: {
    codigoIbge?: string;
    sigla: string;
    descricao: string;
    ativo?: boolean;
    ordem?: number;
  }) {
    return this.prisma.naturezaJuridica.create({ data });
  }

  async update(
    id: string,
    data: Partial<{
      codigoIbge: string;
      sigla: string;
      descricao: string;
      ativo: boolean;
      ordem: number;
    }>,
  ) {
    return this.prisma.naturezaJuridica.update({ where: { id }, data });
  }
}
