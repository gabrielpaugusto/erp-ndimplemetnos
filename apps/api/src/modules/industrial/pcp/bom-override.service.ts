import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';
import { DocumentEventService } from '@/modules/core/audit/document-event.service';
import { IsString, IsOptional, IsArray, ValidateNested, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

// ── DTOs ─────────────────────────────────────────────────────────────────────

export class BomAddItemDto {
  @IsString() productId: string;
  @IsNumber() @Min(0) quantity: number;
  @IsString() unit: string;
  @IsOptional() @IsNumber() wastagePercent?: number;
  @IsOptional() @IsString() observations?: string;
}

export class BomRemoveItemDto {
  @IsString() bomItemId: string;
}

export class BomModifyItemDto {
  @IsString() bomItemId: string;
  @IsOptional() @IsNumber() @Min(0) quantity?: number;
  @IsOptional() @IsString() unit?: string;
  @IsOptional() @IsNumber() wastagePercent?: number;
  @IsOptional() @IsString() observations?: string;
}

export class CreateBomOverrideDto {
  @IsString() motivoCustomizacao: string;

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => BomAddItemDto)
  add?: BomAddItemDto[];

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => BomRemoveItemDto)
  remove?: BomRemoveItemDto[];

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => BomModifyItemDto)
  modify?: BomModifyItemDto[];
}

// ── Service ──────────────────────────────────────────────────────────────────

/**
 * Sprint 3.1 — BOM Customizada por Pedido
 *
 * Permite criar uma variação da BOM padrão para uma OP ou Pedido de Venda específico.
 * O release() em production-orders.service.ts já foi atualizado para usar a BOM override
 * quando existir, garantindo que o bomSnapshot capture a BOM customizada.
 */
@Injectable()
export class BomOverrideService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly documentEvents: DocumentEventService,
  ) {}

  /**
   * Busca a BOM efetiva para uma OP — override se existir, senão a BOM global.
   * Retorna a BOM com os itens já mesclados (add/remove/modify aplicados).
   */
  async resolveEffectiveBom(productionOrderId: string, companyId: string) {
    const order = await this.prisma.productionOrder.findFirst({
      where: { id: productionOrderId, companyId },
      select: { productId: true, bomOverride: true },
    });
    if (!order) throw new NotFoundException(`OP ${productionOrderId} não encontrada`);

    // BOM padrão (mais recente ativa)
    const baseBom = await this.prisma.billOfMaterial.findFirst({
      where: { productId: order.productId, active: true },
      include: { items: { include: { product: { select: { id: true, code: true, description: true } } } } },
      orderBy: { version: 'desc' },
    });

    if (!baseBom) return null;

    const override = order.bomOverride as any;
    if (!override) return { ...baseBom, isCustomized: false };

    // Aplica override
    const customItems = override.customItems as {
      add: BomAddItemDto[];
      remove: { bomItemId: string }[];
      modify: BomModifyItemDto[];
    };

    let items = [...baseBom.items];

    // Remove
    const removedIds = new Set((customItems.remove ?? []).map((r) => r.bomItemId));
    items = items.filter((i) => !removedIds.has(i.id));

    // Modify
    for (const mod of customItems.modify ?? []) {
      const idx = items.findIndex((i) => i.id === mod.bomItemId);
      if (idx >= 0) {
        items[idx] = {
          ...items[idx],
          quantity:       mod.quantity       ?? items[idx].quantity,
          unit:           mod.unit           ?? items[idx].unit,
          wastagePercent: mod.wastagePercent ?? items[idx].wastagePercent,
          observations:   mod.observations   ?? items[idx].observations,
        };
      }
    }

    // Add
    for (const add of customItems.add ?? []) {
      items.push({
        id:             `custom-${add.productId}`,
        bomId:          baseBom.id,
        productId:      add.productId,
        product:        null as any,
        quantity:       add.quantity,
        unit:           add.unit,
        wastagePercent: add.wastagePercent ?? 0,
        observations:   add.observations ?? null,
      });
    }

    return { ...baseBom, items, isCustomized: true, overrideId: (order.bomOverride as any)?.id };
  }

  /**
   * Cria ou atualiza a BOM override de uma OP.
   */
  async upsertForProductionOrder(
    productionOrderId: string,
    companyId: string,
    userId: string,
    dto: CreateBomOverrideDto,
  ) {
    const order = await this.prisma.productionOrder.findFirst({
      where: { id: productionOrderId, companyId },
      select: { id: true, productId: true, status: true },
    });
    if (!order) throw new NotFoundException(`OP ${productionOrderId} não encontrada`);

    if (['CONCLUIDA', 'CANCELADA'].includes(order.status as string)) {
      throw new BadRequestException(`Não é possível customizar BOM de OP com status ${order.status}`);
    }

    const baseBom = await this.prisma.billOfMaterial.findFirst({
      where: { productId: order.productId, active: true },
      orderBy: { version: 'desc' },
    });
    if (!baseBom) throw new BadRequestException('Nenhuma BOM ativa encontrada para o produto desta OP');

    const customItems = {
      add:    dto.add    ?? [],
      remove: dto.remove ?? [],
      modify: dto.modify ?? [],
    };

    const override = await this.prisma.orderBomOverride.upsert({
      where: { productionOrderId },
      create: {
        companyId,
        productionOrderId,
        originalBomId:      baseBom.id,
        customItems:        customItems as any,
        motivoCustomizacao: dto.motivoCustomizacao,
        aprovadoPorId:      userId,
      },
      update: {
        customItems:        customItems as any,
        motivoCustomizacao: dto.motivoCustomizacao,
        aprovadoPorId:      userId,
      },
    });

    this.documentEvents.record({
      companyId,
      entityType: 'ProductionOrder',
      entityId:   productionOrderId,
      eventType:  'ALTERADO',
      fieldChanged: 'bomOverride',
      description: `BOM customizada: ${dto.motivoCustomizacao.substring(0, 80)}`,
      userId,
    });

    return override;
  }

  /**
   * Retorna o diff legível entre a BOM original e a override.
   */
  async getDiff(productionOrderId: string, companyId: string) {
    const effectiveBom = await this.resolveEffectiveBom(productionOrderId, companyId);
    if (!effectiveBom || !effectiveBom.isCustomized) {
      return { isCustomized: false, diff: null };
    }

    const override = await this.prisma.orderBomOverride.findUnique({
      where: { productionOrderId },
    });
    if (!override) return { isCustomized: false, diff: null };

    const customItems = override.customItems as any;

    // Busca nomes dos produtos adicionados
    const addedProductIds = (customItems.add ?? []).map((a: any) => a.productId);
    const addedProducts = addedProductIds.length > 0
      ? await this.prisma.product.findMany({
          where: { id: { in: addedProductIds } },
          select: { id: true, code: true, description: true },
        })
      : [];

    // Busca nomes dos itens removidos/modificados
    const changedItemIds = [
      ...(customItems.remove ?? []).map((r: any) => r.bomItemId),
      ...(customItems.modify ?? []).map((m: any) => m.bomItemId),
    ];
    const changedItems = changedItemIds.length > 0
      ? await this.prisma.bomItem.findMany({
          where: { id: { in: changedItemIds } },
          include: { product: { select: { code: true, description: true } } },
        })
      : [];

    return {
      isCustomized: true,
      motivoCustomizacao: override.motivoCustomizacao,
      diff: {
        adicionados: (customItems.add ?? []).map((a: any) => ({
          ...a,
          produto: addedProducts.find((p) => p.id === a.productId),
        })),
        removidos: (customItems.remove ?? []).map((r: any) => ({
          ...r,
          item: changedItems.find((i) => i.id === r.bomItemId),
        })),
        modificados: (customItems.modify ?? []).map((m: any) => ({
          ...m,
          item: changedItems.find((i) => i.id === m.bomItemId),
        })),
      },
    };
  }
}
