import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';

@Injectable()
export class StProtocoloService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: {
    ufOrigem?: string;
    ufDestino?: string;
    ncm?: string;
    search?: string;
    page?: string;
    limit?: string;
  }) {
    const page = parseInt(query.page ?? '1');
    const limit = parseInt(query.limit ?? '30');
    const where: any = { ativo: true };
    if (query.ufOrigem) where.ufOrigem = query.ufOrigem.toUpperCase();
    if (query.ufDestino) where.ufDestino = query.ufDestino.toUpperCase();
    if (query.ncm) where.ncm = { contains: query.ncm };
    if (query.search) {
      where.OR = [
        { protocolo: { contains: query.search, mode: 'insensitive' } },
        { ncm: { contains: query.search } },
        { cest: { contains: query.search } },
        { descricaoProduto: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    const [data, total] = await Promise.all([
      this.prisma.stProtocoloConfaz.findMany({
        where,
        orderBy: [{ ufOrigem: 'asc' }, { ufDestino: 'asc' }, { ncm: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.stProtocoloConfaz.count({ where }),
    ]);
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string) {
    return this.prisma.stProtocoloConfaz.findUnique({ where: { id } });
  }

  async buscarMva(ufOrigem: string, ufDestino: string, ncm: string) {
    const today = new Date();
    const protocolo = await this.prisma.stProtocoloConfaz.findFirst({
      where: {
        ufOrigem: ufOrigem.toUpperCase(),
        ufDestino: ufDestino.toUpperCase(),
        ativo: true,
        ncm: {
          in: [ncm, ncm.substring(0, 4), ncm.substring(0, 2)],
        },
        vigenciaInicio: { lte: today },
      },
      orderBy: { ncm: 'desc' }, // mais específico primeiro
    });
    if (!protocolo) return null;
    const vigenciaFimOk = !protocolo.vigenciaFim || protocolo.vigenciaFim >= today;
    if (!vigenciaFimOk) return null;
    return {
      mva: protocolo.mvaAjustado ?? protocolo.mvaOriginal,
      protocolo: protocolo.protocolo,
      cest: protocolo.cest,
    };
  }

  async create(data: {
    ufOrigem: string; ufDestino: string; ncm: string; cest?: string;
    protocolo: string; descricaoProduto?: string;
    mvaOriginal: number; mvaAjustado?: number;
    vigenciaInicio: string; vigenciaFim?: string;
  }) {
    return this.prisma.stProtocoloConfaz.create({
      data: {
        ...data,
        ufOrigem: data.ufOrigem.toUpperCase(),
        ufDestino: data.ufDestino.toUpperCase(),
        mvaOriginal: data.mvaOriginal,
        mvaAjustado: data.mvaAjustado ?? null,
        vigenciaInicio: new Date(data.vigenciaInicio),
        vigenciaFim: data.vigenciaFim ? new Date(data.vigenciaFim) : null,
      },
    });
  }

  async update(id: string, data: Partial<{
    ufOrigem: string; ufDestino: string; ncm: string; cest: string;
    protocolo: string; descricaoProduto: string;
    mvaOriginal: number; mvaAjustado: number;
    vigenciaInicio: string; vigenciaFim: string; ativo: boolean;
  }>) {
    return this.prisma.stProtocoloConfaz.update({
      where: { id },
      data: {
        ...data,
        ufOrigem: data.ufOrigem?.toUpperCase(),
        ufDestino: data.ufDestino?.toUpperCase(),
        vigenciaInicio: data.vigenciaInicio ? new Date(data.vigenciaInicio) : undefined,
        vigenciaFim: data.vigenciaFim ? new Date(data.vigenciaFim) : undefined,
      },
    });
  }

  async remove(id: string) {
    return this.prisma.stProtocoloConfaz.update({ where: { id }, data: { ativo: false } });
  }
}
