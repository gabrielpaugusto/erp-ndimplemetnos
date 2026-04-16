import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { auditStorage } from './audit.context';

export type DocumentEventType =
  | 'CRIADO'
  | 'ALTERADO'
  | 'STATUS_MUDOU'
  | 'APROVADO'
  | 'REJEITADO'
  | 'COMENTARIO'
  | 'DOCUMENTO_VINCULADO'
  | 'ALERTA_GERADO'
  | 'ITEM_APROVADO'
  | 'ITEM_REJEITADO'
  | 'RESERVA_CRIADA'
  | 'RESERVA_LIBERADA'
  | 'RESERVA_CONSUMIDA';

export interface RecordEventDto {
  companyId: string;
  entityType: string;
  entityId: string;
  eventType: DocumentEventType;
  fieldChanged?: string;
  oldValue?: unknown;
  newValue?: unknown;
  motivoAlteracao?: string;
  description?: string;
  userId?: string;
}

@Injectable()
export class DocumentEventService {
  private readonly logger = new Logger(DocumentEventService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Registra um evento na linha do tempo de um documento.
   * Usa setImmediate para não bloquear a resposta principal.
   */
  record(dto: RecordEventDto): void {
    // Captura o contexto de auditoria do request atual (userId, IP)
    const auditCtx = auditStorage.getStore();

    setImmediate(() => {
      this.prisma.documentEvent
        .create({
          data: {
            companyId:      dto.companyId,
            entityType:     dto.entityType,
            entityId:       dto.entityId,
            eventType:      dto.eventType as any,
            fieldChanged:   dto.fieldChanged ?? null,
            oldValue:       dto.oldValue !== undefined ? (dto.oldValue as any) : undefined,
            newValue:       dto.newValue !== undefined ? (dto.newValue as any) : undefined,
            motivoAlteracao: dto.motivoAlteracao ?? null,
            description:    dto.description ?? null,
            userId:         dto.userId ?? auditCtx?.userId ?? null,
            ipAddress:      auditCtx?.ipAddress ?? null,
          },
        })
        .catch((e) => {
          this.logger.warn(
            `[DocumentEvent] Falha ao registrar evento ${dto.eventType} em ${dto.entityType}#${dto.entityId}: ${e?.message ?? e}`,
          );
        });
    });
  }

  /**
   * Versão async para quando precisa aguardar a gravação (ex: em transações).
   */
  async recordAsync(dto: RecordEventDto): Promise<void> {
    const auditCtx = auditStorage.getStore();
    try {
      await this.prisma.documentEvent.create({
        data: {
          companyId:      dto.companyId,
          entityType:     dto.entityType,
          entityId:       dto.entityId,
          eventType:      dto.eventType as any,
          fieldChanged:   dto.fieldChanged ?? null,
          oldValue:       dto.oldValue !== undefined ? (dto.oldValue as any) : undefined,
          newValue:       dto.newValue !== undefined ? (dto.newValue as any) : undefined,
          motivoAlteracao: dto.motivoAlteracao ?? null,
          description:    dto.description ?? null,
          userId:         dto.userId ?? auditCtx?.userId ?? null,
          ipAddress:      auditCtx?.ipAddress ?? null,
        },
      });
    } catch (e) {
      this.logger.warn(
        `[DocumentEvent] Falha ao registrar evento ${dto.eventType} em ${dto.entityType}#${dto.entityId}: ${(e as Error)?.message ?? e}`,
      );
    }
  }

  /**
   * Retorna a linha do tempo de um documento, ordenada do mais recente ao mais antigo.
   */
  async getTimeline(entityType: string, entityId: string, companyId: string) {
    return this.prisma.documentEvent.findMany({
      where: { entityType, entityId, companyId },
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true } },
      },
    });
  }
}
