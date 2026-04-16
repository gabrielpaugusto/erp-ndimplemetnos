import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';

export type AbcClass = 'A' | 'B' | 'C';

@Injectable()
export class StockReportsService {
  constructor(private readonly prisma: PrismaService) {}

  // =====================================================================
  // CURVA ABC POR VALOR DE ESTOQUE
  // =====================================================================
  async curvABCEstoque(companyId: string, locationId?: string) {
    const where: any = { companyId };
    if (locationId) where.locationId = locationId;

    const balances = await this.prisma.stockBalance.findMany({
      where,
      include: {
        product: {
          select: {
            id: true, code: true, description: true, unit: true,
            group: { select: { code: true, name: true } },
            subgroup: { select: { code: true, name: true } },
          },
        },
        location: { select: { id: true, name: true } },
      },
    });

    // Agrupa por produto (somando todos os locais se locationId não informado)
    const byProduct = new Map<string, {
      productId: string; code: string; description: string; unit: string;
      group?: any; subgroup?: any;
      quantidade: number; custoMedio: number; valorTotal: number;
    }>();

    for (const b of balances) {
      const existing = byProduct.get(b.productId);
      const valor = Number(b.quantity) * Number(b.averageCost);
      if (existing) {
        existing.quantidade += Number(b.quantity);
        existing.valorTotal += valor;
      } else {
        byProduct.set(b.productId, {
          productId: b.productId,
          code: b.product.code,
          description: b.product.description,
          unit: b.product.unit,
          group: b.product.group,
          subgroup: b.product.subgroup,
          quantidade: Number(b.quantity),
          custoMedio: Number(b.averageCost),
          valorTotal: valor,
        });
      }
    }

    const items = Array.from(byProduct.values())
      .filter(i => i.valorTotal > 0)
      .sort((a, b) => b.valorTotal - a.valorTotal);

    const totalGeral = items.reduce((s, i) => s + i.valorTotal, 0);
    let acumulado = 0;

    return items.map((item, idx) => {
      acumulado += item.valorTotal;
      const percentAcumulado = totalGeral > 0 ? (acumulado / totalGeral) * 100 : 0;
      const classe: AbcClass = percentAcumulado <= 80 ? 'A' : percentAcumulado <= 95 ? 'B' : 'C';
      return {
        rank: idx + 1,
        ...item,
        percentualValor: totalGeral > 0 ? (item.valorTotal / totalGeral) * 100 : 0,
        percentualAcumulado: percentAcumulado,
        classe,
      };
    });
  }

  // =====================================================================
  // CURVA ABC POR CONSUMO (movimentações de saída no período)
  // =====================================================================
  async curvABCConsumo(companyId: string, startDate: Date, endDate: Date) {
    const movements = await this.prisma.stockMovement.findMany({
      where: {
        companyId,
        type: 'SAIDA',
        date: { gte: startDate, lte: endDate },
      },
      include: {
        product: {
          select: {
            id: true, code: true, description: true, unit: true,
            group: { select: { code: true, name: true } },
          },
        },
      },
    });

    const byProduct = new Map<string, {
      productId: string; code: string; description: string; unit: string; group?: any;
      quantidadeTotal: number; valorTotal: number; ocorrencias: number;
    }>();

    for (const m of movements) {
      const existing = byProduct.get(m.productId);
      const valor = Number(m.quantity) * Number(m.unitCost);
      if (existing) {
        existing.quantidadeTotal += Number(m.quantity);
        existing.valorTotal += valor;
        existing.ocorrencias++;
      } else {
        byProduct.set(m.productId, {
          productId: m.productId,
          code: m.product.code,
          description: m.product.description,
          unit: m.product.unit,
          group: m.product.group,
          quantidadeTotal: Number(m.quantity),
          valorTotal: valor,
          ocorrencias: 1,
        });
      }
    }

    const items = Array.from(byProduct.values())
      .sort((a, b) => b.valorTotal - a.valorTotal);

    const totalGeral = items.reduce((s, i) => s + i.valorTotal, 0);
    let acumulado = 0;

    return items.map((item, idx) => {
      acumulado += item.valorTotal;
      const percentAcumulado = totalGeral > 0 ? (acumulado / totalGeral) * 100 : 0;
      const classe: AbcClass = percentAcumulado <= 80 ? 'A' : percentAcumulado <= 95 ? 'B' : 'C';
      return {
        rank: idx + 1,
        ...item,
        percentualValor: totalGeral > 0 ? (item.valorTotal / totalGeral) * 100 : 0,
        percentualAcumulado: percentAcumulado,
        classe,
      };
    });
  }

  // =====================================================================
  // RELATÓRIO GGF MENSAL (Gastos Gerais de Fabricação)
  // =====================================================================
  async relatorioGGFMensal(companyId: string, ano: number, mes: number) {
    const inicio = new Date(ano, mes - 1, 1);
    const fim = new Date(ano, mes, 0, 23, 59, 59);

    const movements = await this.prisma.stockMovement.findMany({
      where: {
        companyId,
        source: 'RGGF',
        type: 'SAIDA',
        date: { gte: inicio, lte: fim },
      },
      include: {
        product: {
          select: {
            id: true, code: true, description: true, unit: true,
            group: { select: { code: true, name: true } },
          },
        },
        user: { select: { id: true, name: true } },
        requisition: { select: { id: true, numero: true } },
      },
      orderBy: { date: 'asc' },
    });

    // Agrupa por produto
    const byProduct = new Map<string, {
      productId: string; code: string; description: string; unit: string; group?: any;
      quantidadeTotal: number; valorTotal: number; movimentos: any[];
    }>();

    for (const m of movements) {
      const existing = byProduct.get(m.productId);
      const valor = Number(m.quantity) * Number(m.unitCost);
      if (existing) {
        existing.quantidadeTotal += Number(m.quantity);
        existing.valorTotal += valor;
        existing.movimentos.push({
          data: m.date,
          quantidade: Number(m.quantity),
          custo: Number(m.unitCost),
          valor,
          usuario: m.user?.name,
          requisicao: m.requisition?.numero,
        });
      } else {
        byProduct.set(m.productId, {
          productId: m.productId,
          code: m.product.code,
          description: m.product.description,
          unit: m.product.unit,
          group: m.product.group,
          quantidadeTotal: Number(m.quantity),
          valorTotal: valor,
          movimentos: [{
            data: m.date,
            quantidade: Number(m.quantity),
            custo: Number(m.unitCost),
            valor,
            usuario: m.user?.name,
            requisicao: m.requisition?.numero,
          }],
        });
      }
    }

    const itens = Array.from(byProduct.values()).sort((a, b) => b.valorTotal - a.valorTotal);
    const totalGGF = itens.reduce((s, i) => s + i.valorTotal, 0);

    return {
      periodo: { ano, mes, inicio, fim },
      totalGGF,
      quantidadeItens: itens.length,
      quantidadeMovimentos: movements.length,
      itens,
      observacao: 'Este total deve ser rateado entre as Ordens de Produção do período, proporcionalmente às horas de produção ou custo direto.',
    };
  }

  // =====================================================================
  // ITENS SEM MOVIMENTAÇÃO (últimos N dias)
  // =====================================================================
  async itensSemMovimentacao(companyId: string, dias: number = 90) {
    const dataLimite = new Date();
    dataLimite.setDate(dataLimite.getDate() - dias);

    const products = await this.prisma.product.findMany({
      where: {
        companyId,
        active: true,
        controlaEstoque: true,
        OR: [
          { dataUltimaMovimentacao: null },
          { dataUltimaMovimentacao: { lt: dataLimite } },
        ],
      },
      select: {
        id: true, code: true, description: true, unit: true,
        dataUltimaMovimentacao: true,
        group: { select: { code: true, name: true } },
        stockBalances: {
          select: { quantity: true, availableQuantity: true, averageCost: true },
        },
      },
      orderBy: { dataUltimaMovimentacao: 'asc' },
    });

    return products.map(p => {
      const saldo = p.stockBalances.reduce((s, b) => s + Number(b.quantity), 0);
      const valor = p.stockBalances.reduce((s, b) => s + Number(b.quantity) * Number(b.averageCost), 0);
      return {
        ...p,
        saldoAtual: saldo,
        valorEstoque: valor,
        diasSemMovimento: p.dataUltimaMovimentacao
          ? Math.floor((Date.now() - new Date(p.dataUltimaMovimentacao).getTime()) / 86400000)
          : null,
      };
    });
  }
}
