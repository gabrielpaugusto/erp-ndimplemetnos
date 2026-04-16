import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';

export interface CreateCbenefDto {
  codigo: string;
  uf: string;
  descricao: string;
  tipo: string;
  fundamentoLegal?: string;
  ncms?: string;
  percentualReducao?: number;
  vigenciaInicio?: string;
  vigenciaFim?: string;
  ativo?: boolean;
}

@Injectable()
export class CbenefService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: {
    uf?: string;
    tipo?: string;
    search?: string;
    page?: string;
    limit?: string;
  }) {
    const page = parseInt(query.page ?? '1');
    const limit = parseInt(query.limit ?? '50');
    const where: any = {};

    if (query.uf) where.uf = query.uf.toUpperCase();
    if (query.tipo) where.tipo = query.tipo;
    if (query.search) {
      where.OR = [
        { codigo: { contains: query.search, mode: 'insensitive' } },
        { descricao: { contains: query.search, mode: 'insensitive' } },
        { fundamentoLegal: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.cbenef.findMany({
        where,
        orderBy: [{ uf: 'asc' }, { codigo: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.cbenef.count({ where }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string) {
    const item = await this.prisma.cbenef.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('CBENEF não encontrado');
    return item;
  }

  /** Busca CBENEF pelo código para uso em NF-e */
  async buscarPorCodigo(codigo: string, uf: string) {
    return this.prisma.cbenef.findFirst({
      where: { codigo: codigo.toUpperCase(), uf: uf.toUpperCase(), ativo: true },
    });
  }

  /** Lista CBENEF aplicáveis a um NCM / UF para o FiscalBrain */
  async sugerirParaNcm(uf: string, ncm: string) {
    const today = new Date();
    const todos = await this.prisma.cbenef.findMany({
      where: {
        uf: uf.toUpperCase(),
        ativo: true,
        OR: [
          { vigenciaFim: null },
          { vigenciaFim: { gte: today } },
        ],
      },
      orderBy: { codigo: 'asc' },
    });

    // Filtra por NCM se o campo ncms estiver preenchido
    const prefixos = [ncm, ncm.slice(0, 4), ncm.slice(0, 2)];
    return todos.filter((c) => {
      if (!c.ncms) return true; // sem restrição = aplica a todos
      return prefixos.some((p) => c.ncms!.split(',').map((x) => x.trim()).includes(p));
    });
  }

  async create(dto: CreateCbenefDto) {
    return this.prisma.cbenef.create({
      data: {
        codigo: dto.codigo.toUpperCase(),
        uf: dto.uf.toUpperCase(),
        descricao: dto.descricao,
        tipo: dto.tipo,
        fundamentoLegal: dto.fundamentoLegal,
        ncms: dto.ncms,
        percentualReducao: dto.percentualReducao,
        vigenciaInicio: dto.vigenciaInicio ? new Date(dto.vigenciaInicio) : null,
        vigenciaFim: dto.vigenciaFim ? new Date(dto.vigenciaFim) : null,
        ativo: dto.ativo ?? true,
      },
    });
  }

  async update(id: string, dto: Partial<CreateCbenefDto>) {
    await this.findOne(id);
    return this.prisma.cbenef.update({
      where: { id },
      data: {
        ...(dto.codigo && { codigo: dto.codigo.toUpperCase() }),
        ...(dto.uf && { uf: dto.uf.toUpperCase() }),
        ...(dto.descricao !== undefined && { descricao: dto.descricao }),
        ...(dto.tipo !== undefined && { tipo: dto.tipo }),
        ...(dto.fundamentoLegal !== undefined && { fundamentoLegal: dto.fundamentoLegal }),
        ...(dto.ncms !== undefined && { ncms: dto.ncms }),
        ...(dto.percentualReducao !== undefined && { percentualReducao: dto.percentualReducao }),
        ...(dto.vigenciaInicio !== undefined && {
          vigenciaInicio: dto.vigenciaInicio ? new Date(dto.vigenciaInicio) : null,
        }),
        ...(dto.vigenciaFim !== undefined && {
          vigenciaFim: dto.vigenciaFim ? new Date(dto.vigenciaFim) : null,
        }),
        ...(dto.ativo !== undefined && { ativo: dto.ativo }),
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.cbenef.delete({ where: { id } });
  }
}
