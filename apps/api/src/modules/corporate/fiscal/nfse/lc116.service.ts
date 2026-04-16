import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';

@Injectable()
export class Lc116Service {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(search?: string) {
    return this.prisma.lc116Servico.findMany({
      where: {
        ativo: true,
        ...(search
          ? {
              OR: [
                { codigo: { contains: search, mode: 'insensitive' } },
                { descricao: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { codigo: 'asc' },
    });
  }

  async findOne(id: string) {
    return this.prisma.lc116Servico.findUnique({ where: { id } });
  }
}
