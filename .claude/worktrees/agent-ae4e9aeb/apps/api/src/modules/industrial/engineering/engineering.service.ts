import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';

@Injectable()
export class EngineeringService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Dashboard consolidado de Engenharia ─────────────────────────────────────
  async getDashboard(companyId: string) {
    const [
      totalProdutos,
      produtosPorTipo,
      totalBoms,
      totalRoteiros,
      totalCentros,
      bomsRecentes,
      produtosSemBom,
    ] = await Promise.all([
      // Total de produtos ativos
      this.prisma.product.count({ where: { companyId, active: true } }),

      // Produtos agrupados por tipo
      this.prisma.product.groupBy({
        by: ['type'],
        where: { companyId, active: true },
        _count: { type: true },
      }),

      // Total de BOMs ativas
      this.prisma.billOfMaterial.count({ where: { companyId, active: true } }),

      // Total de roteiros ativos
      this.prisma.productionRouting.count({ where: { companyId, active: true } }),

      // Total de centros de trabalho ativos
      this.prisma.workCenter.count({ where: { companyId, active: true } }),

      // BOMs mais recentes (últimas 5 modificadas)
      this.prisma.billOfMaterial.findMany({
        where: { companyId, active: true },
        orderBy: { updatedAt: 'desc' },
        take: 5,
        include: {
          product: { select: { code: true, description: true, unit: true } },
          _count: { select: { items: true } },
        },
      }),

      // Produtos sem BOM (tipo PRODUTO_ACABADO ou MATERIA_PRIMA)
      this.prisma.product.count({
        where: {
          companyId,
          active: true,
          type: { in: ['PRODUTO_ACABADO', 'MATERIA_PRIMA', 'COMPONENTE'] },
          boms: { none: { active: true } },
        },
      }),
    ]);

    return {
      kpis: {
        totalProdutos,
        totalBoms,
        totalRoteiros,
        totalCentros,
        produtosSemBom,
        coberturaBom: totalProdutos > 0
          ? Math.round(((totalProdutos - produtosSemBom) / totalProdutos) * 100)
          : 0,
      },
      produtosPorTipo: produtosPorTipo.map((p) => ({
        tipo: p.type,
        total: p._count.type,
      })),
      bomsRecentes: bomsRecentes.map((b) => ({
        id: b.id,
        version: b.version,
        description: b.description,
        produto: b.product
          ? { code: b.product.code, description: b.product.description, unit: b.product.unit }
          : null,
        totalItens: b._count.items,
        updatedAt: b.updatedAt,
      })),
    };
  }

  // ── Lista produtos com indicação de BOM e Roteiro ───────────────────────────
  async getProductsWithEngineering(
    companyId: string,
    query: { search?: string; type?: string; page?: string; limit?: string },
  ) {
    const page  = parseInt(query.page  || '1',  10);
    const limit = parseInt(query.limit || '20', 10);
    const skip  = (page - 1) * limit;

    const where: any = { companyId, active: true };
    if (query.search) {
      where.OR = [
        { description: { contains: query.search, mode: 'insensitive' } },
        { code:        { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query.type) where.type = query.type;

    const [data, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { code: 'asc' },
        include: {
          boms:     { where: { active: true }, select: { id: true, version: true } },
          routings: { where: { active: true }, select: { id: true, version: true } },
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      data: data.map((p) => ({
        id:          p.id,
        code:        p.code,
        description: p.description,
        type:        p.type,
        unit:        p.unit,
        active:      p.active,
        temBom:      p.boms.length > 0,
        temRoteiro:  p.routings.length > 0,
        versaoBom:   p.boms[0]?.version ?? null,
        versaoRoteiro: p.routings[0]?.version ?? null,
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }
}
