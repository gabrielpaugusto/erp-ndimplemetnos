import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';

@Injectable()
export class StockAlertsService {
  constructor(private readonly prisma: PrismaService) {}

  async getAlerts(companyId: string) {
    // Find all StockBalance where quantityOnHand <= reorderPoint AND reorderPoint > 0
    const balances = await this.prisma.stockBalance.findMany({
      where: {
        companyId,
        reorderPoint: { gt: 0 },
      },
      include: {
        product: {
          select: {
            id: true,
            code: true,
            description: true,
            unit: true,
            estoqueMinimo: true,
            estoqueMaximo: true,
          },
        },
        location: {
          select: { id: true, code: true, name: true, type: true },
        },
      },
    });

    // Filter where quantity <= reorderPoint
    const alertBalances = balances.filter(
      (b) => Number(b.quantity) <= Number(b.reorderPoint),
    );

    // Group by product (sum across all locations)
    const productMap = new Map<
      string,
      {
        productId: string;
        productCode: string;
        productDescription: string;
        unit: string;
        currentStock: number;
        reorderPoint: number;
        estoqueMinimo: number;
        suggestedQuantity: number;
        locations: Array<{
          locationId: string;
          locationCode: string;
          locationName: string;
          quantity: number;
          reorderPoint: number;
        }>;
      }
    >();

    for (const balance of alertBalances) {
      const productId = balance.productId;
      const qty = Number(balance.quantity);
      const rp = Number(balance.reorderPoint);
      const minStock = Number(balance.product.estoqueMinimo || 0);
      const suggestedQty = Math.max(0, rp * 2 - qty);

      if (productMap.has(productId)) {
        const existing = productMap.get(productId)!;
        existing.currentStock += qty;
        existing.locations.push({
          locationId: balance.locationId,
          locationCode: balance.location.code,
          locationName: balance.location.name,
          quantity: qty,
          reorderPoint: rp,
        });
      } else {
        productMap.set(productId, {
          productId,
          productCode: balance.product.code,
          productDescription: balance.product.description,
          unit: balance.product.unit,
          currentStock: qty,
          reorderPoint: rp,
          estoqueMinimo: minStock,
          suggestedQuantity: suggestedQty,
          locations: [
            {
              locationId: balance.locationId,
              locationCode: balance.location.code,
              locationName: balance.location.name,
              quantity: qty,
              reorderPoint: rp,
            },
          ],
        });
      }
    }

    // Enrich with preferred supplier from ProductSupplier catalog
    const alerts = await Promise.all(
      Array.from(productMap.values()).map(async (alert) => {
        const preferredSupplier = await this.prisma.productSupplier.findFirst({
          where: {
            companyId,
            productId: alert.productId,
            preferred: true,
          },
          include: {
            person: {
              select: { id: true, razaoSocial: true, nomeFantasia: true },
            },
          },
        });

        return {
          ...alert,
          preferredSupplierId: preferredSupplier?.personId || null,
          preferredSupplierName:
            preferredSupplier?.person.nomeFantasia ||
            preferredSupplier?.person.razaoSocial ||
            null,
          preferredSupplierCatalog: preferredSupplier
            ? {
                codigoFornecedor: preferredSupplier.codigoFornecedor,
                precoUltCompra: preferredSupplier.precoUltCompra,
                prazoEntregaDias: preferredSupplier.prazoEntregaDias,
              }
            : null,
        };
      }),
    );

    // Sort by urgency: lowest ratio of currentStock/reorderPoint first
    alerts.sort((a, b) => {
      const ratioA = a.reorderPoint > 0 ? a.currentStock / a.reorderPoint : 0;
      const ratioB = b.reorderPoint > 0 ? b.currentStock / b.reorderPoint : 0;
      return ratioA - ratioB;
    });

    return {
      data: alerts,
      total: alerts.length,
    };
  }

  async generateRequisitions(
    companyId: string,
    userId: string,
    productIds: string[],
  ) {
    if (!productIds || productIds.length === 0) {
      return { requisitions: [], count: 0 };
    }

    const alerts = await this.getAlerts(companyId);
    const alertMap = new Map(
      alerts.data.map((a) => [a.productId, a]),
    );

    const createdIds: string[] = [];

    for (const productId of productIds) {
      const alert = alertMap.get(productId);
      if (!alert) continue;

      const suggestedQty = alert.suggestedQuantity > 0 ? alert.suggestedQuantity : alert.reorderPoint;

      const numero = await this.generateRequisitionNumero(companyId);

      const req = await this.prisma.purchaseRequest.create({
        data: {
          companyId,
          numero,
          solicitanteId: userId,
          description: `Reposição automática de estoque: ${alert.productDescription}`,
          justificativa: `Estoque atual (${alert.currentStock}) abaixo do ponto de reposição (${alert.reorderPoint}). Sugestão de compra: ${suggestedQty} ${alert.unit}.`,
          status: 'RASCUNHO' as any,
          priority: 7, // High priority for stock alerts
          items: {
            create: [
              {
                productId,
                quantity: suggestedQty,
                unit: alert.unit,
                description: `Reposição automática — estoque mínimo atingido`,
              },
            ],
          },
        },
        include: {
          items: {
            include: {
              product: {
                select: { id: true, code: true, description: true },
              },
            },
          },
        },
      });

      createdIds.push(req.id);
    }

    return {
      requisitions: createdIds,
      count: createdIds.length,
    };
  }

  private async generateRequisitionNumero(companyId: string): Promise<string> {
    const today = new Date();
    const dateStr =
      today.getFullYear().toString() +
      (today.getMonth() + 1).toString().padStart(2, '0') +
      today.getDate().toString().padStart(2, '0');

    const prefix = `SC-${dateStr}-`;

    const last = await this.prisma.purchaseRequest.findFirst({
      where: {
        companyId,
        numero: { startsWith: prefix },
      },
      orderBy: { numero: 'desc' },
    });

    let sequence = 1;
    if (last && last.numero) {
      const lastSequence = parseInt(last.numero.replace(prefix, ''), 10);
      if (!isNaN(lastSequence)) {
        sequence = lastSequence + 1;
      }
    }

    return `${prefix}${sequence.toString().padStart(3, '0')}`;
  }
}
