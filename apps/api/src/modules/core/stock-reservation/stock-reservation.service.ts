import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { DocumentEventService } from '../audit/document-event.service';

export type ReservationSource = 'PRODUCTION_ORDER' | 'SERVICE_ORDER' | 'SALE_ORDER';

export interface CreateReservationDto {
  companyId: string;
  sourceType: ReservationSource;
  sourceId: string;
  items: Array<{
    productId: string;
    locationId: string;
    quantity: number;
  }>;
  notes?: string;
  userId?: string;
}

export interface ReservationSummary {
  reserved: number;
  insufficient: Array<{ productId: string; required: number; available: number }>;
}

/**
 * Sprint 2.4 — Reserva de Estoque
 *
 * Cobre Ordem de Produção (OP), Ordem de Serviço (OS) e Pedido de Venda (PV).
 * availableQuantity no StockBalance = quantity - SUM(reservas ATIVAS daquele produto/localidade).
 *
 * Lógica:
 *  - createReservations(): chamado na liberação da OP/OS/PV — cria reservas + atualiza StockBalance.reservedQuantity
 *  - releaseReservations(): OP/OS/PV cancelada — devolve o saldo reservado
 *  - consumeReservations(): material efetivamente consumido — baixa estoque e marca como CONSUMIDA
 */
@Injectable()
export class StockReservationService {
  private readonly logger = new Logger(StockReservationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: DocumentEventService,
  ) {}

  /**
   * Cria reservas de estoque para todos os itens de um documento.
   * Itens com saldo insuficiente são reservados com alertas — não bloqueiam o processo.
   */
  async createReservations(dto: CreateReservationDto): Promise<ReservationSummary> {
    const insufficient: Array<{ productId: string; required: number; available: number }> = [];
    let reserved = 0;

    await this.prisma.$transaction(async (tx) => {
      for (const item of dto.items) {
        const balance = await tx.stockBalance.findFirst({
          where: {
            companyId: dto.companyId,
            productId: item.productId,
            locationId: item.locationId,
          },
        });

        const available = balance ? Number(balance.availableQuantity) : 0;
        const toReserve = Math.min(item.quantity, available); // reserva o que há disponível

        if (available < item.quantity) {
          insufficient.push({
            productId: item.productId,
            required: item.quantity,
            available,
          });
          this.logger.warn(
            `[Reserva] Estoque insuficiente para ${item.productId} ` +
            `em ${item.locationId}: necessário=${item.quantity} disponível=${available}`,
          );
        }

        if (toReserve > 0) {
          // Cria a reserva
          await tx.stockReservation.create({
            data: {
              companyId:  dto.companyId,
              productId:  item.productId,
              locationId: item.locationId,
              quantity:   toReserve,
              sourceType: dto.sourceType as any,
              sourceId:   dto.sourceId,
              notes:      dto.notes ?? null,
              status:     'ATIVA',
            },
          });

          // Atualiza StockBalance.reservedQuantity e availableQuantity
          if (balance) {
            await tx.stockBalance.update({
              where: { id: balance.id },
              data: {
                reservedQuantity: { increment: toReserve },
                availableQuantity: { decrement: toReserve },
              },
            });
          }

          reserved++;
        }
      }
    });

    // Registra na timeline do documento
    this.events.record({
      companyId:   dto.companyId,
      entityType:  this.sourceTypeToEntityType(dto.sourceType),
      entityId:    dto.sourceId,
      eventType:   'RESERVA_CRIADA',
      description: `${reserved} reserva(s) criada(s)${insufficient.length > 0 ? ` — ${insufficient.length} item(ns) com saldo insuficiente` : ''}`,
      userId:      dto.userId,
    });

    return { reserved, insufficient };
  }

  /**
   * Libera todas as reservas ATIVAS de um documento (cancelamento, rejeição).
   */
  async releaseReservations(
    companyId: string,
    sourceType: ReservationSource,
    sourceId: string,
    userId?: string,
  ): Promise<number> {
    const reservations = await this.prisma.stockReservation.findMany({
      where: { companyId, sourceType: sourceType as any, sourceId, status: 'ATIVA' },
    });

    if (reservations.length === 0) return 0;

    await this.prisma.$transaction(async (tx) => {
      for (const r of reservations) {
        await tx.stockReservation.update({
          where: { id: r.id },
          data: { status: 'LIBERADA', releasedAt: new Date() },
        });

        // Devolve o saldo ao StockBalance
        await tx.stockBalance.updateMany({
          where: { companyId, productId: r.productId, locationId: r.locationId },
          data: {
            reservedQuantity: { decrement: Number(r.quantity) },
            availableQuantity: { increment: Number(r.quantity) },
          },
        });
      }
    });

    this.events.record({
      companyId,
      entityType: this.sourceTypeToEntityType(sourceType),
      entityId:   sourceId,
      eventType:  'RESERVA_LIBERADA',
      description: `${reservations.length} reserva(s) liberada(s) (cancelamento/rejeição)`,
      userId,
    });

    return reservations.length;
  }

  /**
   * Consome reservas — chamado quando o material é efetivamente retirado do estoque.
   * Recebe uma lista de { productId, locationId, quantity } efetivamente consumidos.
   */
  async consumeReservations(
    companyId: string,
    sourceType: ReservationSource,
    sourceId: string,
    userId?: string,
  ): Promise<number> {
    const reservations = await this.prisma.stockReservation.findMany({
      where: { companyId, sourceType: sourceType as any, sourceId, status: 'ATIVA' },
    });

    if (reservations.length === 0) return 0;

    await this.prisma.$transaction(async (tx) => {
      for (const r of reservations) {
        await tx.stockReservation.update({
          where: { id: r.id },
          data: { status: 'CONSUMIDA', consumedAt: new Date() },
        });

        // A quantidade reservada é baixada (o movimento de estoque real será feito
        // pelo StockMovementService — aqui apenas remove a reserva do saldo)
        await tx.stockBalance.updateMany({
          where: { companyId, productId: r.productId, locationId: r.locationId },
          data: {
            reservedQuantity: { decrement: Number(r.quantity) },
            // availableQuantity já foi reduzida na criação da reserva;
            // a baixa real no quantity é feita pelo StockMovement
          },
        });
      }
    });

    this.events.record({
      companyId,
      entityType: this.sourceTypeToEntityType(sourceType),
      entityId:   sourceId,
      eventType:  'RESERVA_CONSUMIDA',
      description: `${reservations.length} reserva(s) consumida(s)`,
      userId,
    });

    return reservations.length;
  }

  /**
   * Lista as reservas ativas de um documento.
   */
  async listBySource(companyId: string, sourceType: ReservationSource, sourceId: string) {
    return this.prisma.stockReservation.findMany({
      where: { companyId, sourceType: sourceType as any, sourceId },
      include: {
        product:  { select: { id: true, code: true, description: true, unit: true } },
        location: { select: { id: true, code: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  private sourceTypeToEntityType(sourceType: ReservationSource): string {
    const map: Record<ReservationSource, string> = {
      PRODUCTION_ORDER: 'ProductionOrder',
      SERVICE_ORDER:    'ServiceOrder',
      SALE_ORDER:       'SaleOrder',
    };
    return map[sourceType];
  }
}
