import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';

@Injectable()
export class AiToolsService {
  constructor(private readonly prisma: PrismaService) {}

  async executeFinancialAnalysis(companyId: string) {
    const startTime = Date.now();
    try {
      const [totalReceitas, totalDespesas, vencidos, recentMovements] =
        await Promise.all([
          this.prisma.financialMovement.aggregate({
            where: { companyId, type: 'RECEITA' },
            _sum: { valor: true },
            _count: { id: true },
          }),
          this.prisma.financialMovement.aggregate({
            where: { companyId, type: 'DESPESA' },
            _sum: { valor: true },
            _count: { id: true },
          }),
          this.prisma.financialMovement.count({
            where: {
              companyId,
              status: 'VENCIDO',
            },
          }),
          this.prisma.financialMovement.findMany({
            where: { companyId },
            orderBy: { dataVencimento: 'desc' },
            take: 10,
            select: {
              id: true,
              description: true,
              type: true,
              valor: true,
              status: true,
              dataVencimento: true,
            },
          }),
        ]);

      const result = {
        totalAReceber: totalReceitas._sum.valor || 0,
        countReceitas: totalReceitas._count.id,
        totalAPagar: totalDespesas._sum.valor || 0,
        countDespesas: totalDespesas._count.id,
        vencidos,
        recentMovements,
      };

      await this.saveExecution(companyId, 'ANALYZE_FINANCIAL', {}, result, startTime);
      return result;
    } catch (error) {
      await this.saveExecution(
        companyId,
        'ANALYZE_FINANCIAL',
        {},
        null,
        startTime,
        error.message,
      );
      throw error;
    }
  }

  async executeStockAnalysis(companyId: string) {
    const startTime = Date.now();
    try {
      const [totalItems, belowMinimum, recentMovements, topByValue] =
        await Promise.all([
          this.prisma.stockBalance.count({ where: { companyId } }),
          this.prisma.stockBalance.count({
            where: {
              companyId,
              quantity: { lt: this.prisma.stockBalance.fields.minStock as any },
            },
          }).catch(() =>
            // Fallback: raw count where quantity < minStock
            this.prisma.$queryRawUnsafe<[{ count: bigint }]>(
              `SELECT COUNT(*)::int as count FROM stock_balances WHERE "companyId" = $1 AND quantity < "minStock" AND "minStock" > 0`,
              companyId,
            ).then((r) => Number(r[0]?.count || 0)),
          ),
          this.prisma.stockMovement.findMany({
            where: { companyId },
            orderBy: { date: 'desc' },
            take: 10,
            include: {
              product: { select: { id: true, description: true, code: true } },
            },
          }),
          this.prisma.stockBalance.findMany({
            where: { companyId },
            orderBy: { totalCost: 'desc' },
            take: 10,
            include: {
              product: { select: { id: true, description: true, code: true } },
              location: { select: { id: true, name: true } },
            },
          }),
        ]);

      const result = {
        totalItems,
        belowMinimum,
        recentMovements,
        topProductsByValue: topByValue,
      };

      await this.saveExecution(companyId, 'ANALYZE_STOCK', {}, result, startTime);
      return result;
    } catch (error) {
      await this.saveExecution(
        companyId,
        'ANALYZE_STOCK',
        {},
        null,
        startTime,
        error.message,
      );
      throw error;
    }
  }

  async executeProductionAnalysis(companyId: string) {
    const startTime = Date.now();
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const [inProgress, completedToday, byStatus, pending] =
        await Promise.all([
          this.prisma.productionOrder.count({
            where: { companyId, status: 'EM_PRODUCAO' },
          }),
          this.prisma.productionOrder.count({
            where: {
              companyId,
              status: 'CONCLUIDA',
              updatedAt: { gte: today, lt: tomorrow },
            },
          }),
          this.prisma.productionOrder.groupBy({
            by: ['status'],
            where: { companyId },
            _count: { id: true },
          }),
          this.prisma.productionOrder.count({
            where: {
              companyId,
              status: { in: ['PLANEJADA', 'LIBERADA'] },
            },
          }),
        ]);

      const result = {
        inProgress,
        completedToday,
        pending,
        byStatus: byStatus.map((s) => ({
          status: s.status,
          count: s._count.id,
        })),
      };

      await this.saveExecution(companyId, 'ANALYZE_PRODUCTION', {}, result, startTime);
      return result;
    } catch (error) {
      await this.saveExecution(
        companyId,
        'ANALYZE_PRODUCTION',
        {},
        null,
        startTime,
        error.message,
      );
      throw error;
    }
  }

  async executeDataQuery(companyId: string, query: string) {
    const startTime = Date.now();
    try {
      // Simple keyword-based data query — returns relevant counts/data
      const result: any = {};

      if (query.match(/cliente|person|cadastro/i)) {
        result.persons = await this.prisma.person.count({ where: { companyId } });
      }
      if (query.match(/venda|pedido|order/i)) {
        result.saleOrders = await this.prisma.saleOrder.count({
          where: { companyId },
        });
      }
      if (query.match(/produto|product/i)) {
        result.products = await this.prisma.product.count({
          where: { companyId },
        });
      }
      if (query.match(/nota|nfe|fiscal/i)) {
        result.nfeDocuments = await this.prisma.nFeDocument.count({
          where: { companyId },
        });
      }

      // If no specific match, return general overview
      if (Object.keys(result).length === 0) {
        const [persons, products, saleOrders] = await Promise.all([
          this.prisma.person.count({ where: { companyId } }),
          this.prisma.product.count({ where: { companyId } }),
          this.prisma.saleOrder.count({ where: { companyId } }),
        ]);
        result.overview = { persons, products, saleOrders };
      }

      await this.saveExecution(
        companyId,
        'QUERY_DATA',
        { query },
        result,
        startTime,
      );
      return result;
    } catch (error) {
      await this.saveExecution(
        companyId,
        'QUERY_DATA',
        { query },
        null,
        startTime,
        error.message,
      );
      throw error;
    }
  }

  async generateReport(companyId: string, reportType: string) {
    const startTime = Date.now();
    try {
      let reportData: any = {};

      switch (reportType) {
        case 'financeiro':
          const [receitas, despesas] = await Promise.all([
            this.prisma.financialMovement.aggregate({
              where: { companyId, type: 'RECEITA' },
              _sum: { valor: true },
              _count: { id: true },
            }),
            this.prisma.financialMovement.aggregate({
              where: { companyId, type: 'DESPESA' },
              _sum: { valor: true },
              _count: { id: true },
            }),
          ]);
          reportData = {
            type: 'financeiro',
            receitas: {
              total: receitas._sum.valor || 0,
              count: receitas._count.id,
            },
            despesas: {
              total: despesas._sum.valor || 0,
              count: despesas._count.id,
            },
          };
          break;

        case 'estoque':
          const stockSummary = await this.prisma.stockBalance.aggregate({
            where: { companyId },
            _sum: { totalCost: true, quantity: true },
            _count: { id: true },
          });
          reportData = {
            type: 'estoque',
            totalItems: stockSummary._count.id,
            totalQuantity: stockSummary._sum.quantity || 0,
            totalValue: stockSummary._sum.totalCost || 0,
          };
          break;

        case 'vendas':
          const salesByStatus = await this.prisma.saleOrder.groupBy({
            by: ['status'],
            where: { companyId },
            _count: { id: true },
            _sum: { total: true },
          });
          reportData = {
            type: 'vendas',
            byStatus: salesByStatus.map((s) => ({
              status: s.status,
              count: s._count.id,
              total: s._sum.total || 0,
            })),
          };
          break;

        default:
          reportData = { type: reportType, message: 'Tipo de relatorio nao suportado' };
      }

      await this.saveExecution(
        companyId,
        'GENERATE_REPORT',
        { reportType },
        reportData,
        startTime,
      );
      return reportData;
    } catch (error) {
      await this.saveExecution(
        companyId,
        'GENERATE_REPORT',
        { reportType },
        null,
        startTime,
        error.message,
      );
      throw error;
    }
  }

  private async saveExecution(
    companyId: string,
    toolType: string,
    input: any,
    output: any,
    startTime: number,
    errorMessage?: string,
  ) {
    // AiToolExecution requires a messageId — we'll handle this in the assistant service
    // This is a standalone record for tracking purposes
    // Note: the schema requires messageId, so we skip saving here
    // and let the assistant service handle it with proper messageId
  }
}
