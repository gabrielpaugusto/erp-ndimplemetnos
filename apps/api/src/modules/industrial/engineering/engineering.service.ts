import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';
import * as XLSX from 'xlsx';

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

  // ── Mapeamento de unidade textual → UnitType enum ───────────────────────────
  private mapUnit(raw: string): string {
    const u = (raw || '').toString().trim().toUpperCase()
      .replace('Ç', 'C').replace('²', '2').replace('³', '3');
    const map: Record<string, string> = {
      UN: 'UN', UNIDADE: 'UN', UNID: 'UN',
      KG: 'KG', QUILO: 'KG', QUILOGRAMA: 'KG',
      M: 'M', MT: 'M', METRO: 'M',
      M2: 'M2',
      M3: 'M3',
      L: 'L', LT: 'L', LITRO: 'L',
      PC: 'PC', PCA: 'PC', PECA: 'PC', PECAS: 'PC',
      CJ: 'CJ', KIT: 'CJ', CONJUNTO: 'CJ',
      HR: 'HR', H: 'HR', HORA: 'HR', HORAS: 'HR',
      SV: 'SV', SERV: 'SV', SERVICO: 'SV',
      TON: 'TON', T: 'TON', TONELADA: 'TON',
      MM: 'MM', MILIMETRO: 'MM',
      CM: 'CM', CENTIMETRO: 'CM',
    };
    return map[u] ?? 'UN';
  }

  // ── Parse arquivo Excel de BOM do SolidWorks ─────────────────────────────────
  parseBomFile(buffer: Buffer): { rows: any[]; errors: string[] } {
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = wb.SheetNames[0];
    if (!sheetName) throw new BadRequestException('Arquivo Excel sem planilhas.');

    const ws = wb.Sheets[sheetName];
    const raw: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

    if (raw.length < 2) throw new BadRequestException('Planilha vazia ou sem dados.');

    // Encontra linha de cabeçalho (primeira linha com PART NUMBER ou PARTNUMBER)
    let headerIdx = -1;
    let headerRow: string[] = [];
    for (let i = 0; i < Math.min(raw.length, 5); i++) {
      const row = raw[i].map((c: any) => String(c).toUpperCase().trim().replace(/\s+/g, ' '));
      if (row.some((c) => c.includes('PART') || c.includes('DESCRI'))) {
        headerIdx = i;
        headerRow = row;
        break;
      }
    }
    if (headerIdx === -1) throw new BadRequestException('Cabeçalho não encontrado. Esperado: PART NUMBER, DESCRIÇÃO, QUANTIDADE, UNIDADE.');

    // Mapeamento de colunas pelo cabeçalho
    const col = (names: string[]) => {
      for (const n of names) {
        const idx = headerRow.findIndex((h) => h.includes(n));
        if (idx !== -1) return idx;
      }
      return -1;
    };

    const colItem     = col(['ITEM']);
    const colPart     = col(['PART NUMBER', 'PART_NUMBER', 'PARTNUMBER', 'CODIGO', 'COD']);
    const colDesc     = col(['DESCRI']);
    const colMat      = col(['MATERIAL']);
    const colQtd      = col(['QUANTIDADE', 'QTDE', 'QTD', 'QUANTITY', 'QT ']);
    const colUnit     = col(['UNIDADE', 'UNIT']);
    const colPeso     = col(['PESO']);
    const colAcab     = col(['ACABAMENTO', 'FINISH']);
    const colRev      = col(['REVIS']);
    const colObs      = col(['OBSERVA', 'OBS', 'NOTE']);

    if (colPart === -1) throw new BadRequestException('Coluna PART NUMBER não encontrada.');
    if (colDesc === -1) throw new BadRequestException('Coluna DESCRIÇÃO não encontrada.');
    if (colQtd  === -1) throw new BadRequestException('Coluna QUANTIDADE não encontrada.');

    const rows: any[] = [];
    const errors: string[] = [];

    for (let i = headerIdx + 1; i < raw.length; i++) {
      const r = raw[i];
      const partNumber = String(r[colPart] ?? '').trim();
      const descricao  = String(r[colDesc]  ?? '').trim();
      const qtdRaw     = r[colQtd];

      // Pula linhas vazias
      if (!partNumber && !descricao) continue;

      if (!partNumber) { errors.push(`Linha ${i + 1}: PART NUMBER vazio.`); continue; }
      if (!descricao)  { errors.push(`Linha ${i + 1}: DESCRIÇÃO vazia.`);  continue; }

      const quantidade = parseFloat(String(qtdRaw).replace(',', '.'));
      if (isNaN(quantidade) || quantidade <= 0) {
        errors.push(`Linha ${i + 1} (${partNumber}): QUANTIDADE inválida.`);
        continue;
      }

      rows.push({
        item:      colItem !== -1 ? String(r[colItem] ?? '').trim() : String(i - headerIdx),
        partNumber,
        descricao,
        material:  colMat  !== -1 ? String(r[colMat]  ?? '').trim() : '',
        quantidade,
        unidade:   colUnit !== -1 ? this.mapUnit(String(r[colUnit] ?? '')) : 'UN',
        peso:      colPeso !== -1 ? parseFloat(String(r[colPeso] ?? '0').replace(',', '.')) || null : null,
        acabamento: colAcab !== -1 ? String(r[colAcab] ?? '').trim() : '',
        revisao:   colRev  !== -1 ? String(r[colRev]  ?? '').trim() : '',
        observacoes: colObs !== -1 ? String(r[colObs] ?? '').trim() : '',
      });
    }

    return { rows, errors };
  }

  // ── Importa BOM para o banco ──────────────────────────────────────────────────
  async importBom(
    companyId: string,
    productId: string,
    rows: any[],
    description?: string,
  ) {
    if (!rows || rows.length === 0) throw new BadRequestException('Nenhum item para importar.');

    return this.prisma.$transaction(async (tx) => {
      // 1. Upsert cada produto-filho (componente) pelo code
      const itemsWithProductId: { productId: string; quantity: number; unit: string; observations: string }[] = [];

      for (const row of rows) {
        const existing = await tx.product.findFirst({
          where: { companyId, code: row.partNumber },
        });

        let childId: string;
        if (existing) {
          // Atualiza descrição e peso se vieram do Excel
          await tx.product.update({
            where: { id: existing.id },
            data: {
              description: row.descricao || existing.description,
              ...(row.peso != null ? { pesoLiquido: row.peso } : {}),
            },
          });
          childId = existing.id;
        } else {
          const created = await tx.product.create({
            data: {
              companyId,
              code:        row.partNumber,
              description: row.descricao,
              type:        'COMPONENTE',
              unit:        row.unidade as any,
              ...(row.peso != null ? { pesoLiquido: row.peso } : {}),
            },
          });
          childId = created.id;
        }

        const obs = [row.material, row.acabamento, row.revisao ? `Rev.${row.revisao}` : '', row.observacoes]
          .filter(Boolean).join(' | ') || undefined;

        itemsWithProductId.push({ productId: childId, quantity: row.quantidade, unit: row.unidade, observations: obs ?? '' });
      }

      // 2. Desativa BOMs anteriores do mesmo produto
      await tx.billOfMaterial.updateMany({
        where: { companyId, productId, active: true },
        data: { active: false },
      });

      // 3. Determina próxima versão
      const lastBom = await tx.billOfMaterial.findFirst({
        where: { companyId, productId },
        orderBy: { version: 'desc' },
      });
      const nextVersion = (lastBom?.version ?? 0) + 1;

      // 4. Cria nova BOM
      const bom = await tx.billOfMaterial.create({
        data: {
          companyId,
          productId,
          version: nextVersion,
          description: description || `BOM importada do SolidWorks — v${nextVersion}`,
          active: true,
          items: {
            create: itemsWithProductId.map((it) => ({
              productId:    it.productId,
              quantity:     it.quantity,
              unit:         it.unit,
              wastagePercent: 0,
              observations: it.observations,
            })),
          },
        },
        include: { items: { include: { product: { select: { code: true, description: true } } } } },
      });

      return { bomId: bom.id, version: bom.version, totalItens: bom.items.length };
    });
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
