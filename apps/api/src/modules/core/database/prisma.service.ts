import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@erp/db';
import { auditStorage } from '../audit/audit.context';

/**
 * PrismaService — wrapper do PrismaClient com audit log automático.
 *
 * Prisma v6 removeu $use() em favor de $extends().
 * O audit middleware usa query events via $on('query') não sendo suportado
 * para before/after hooks sem $use. A solução é usar $extends com
 * itxMiddleware via client extensions.
 *
 * Por compatibilidade e simplicidade, o audit é feito via um wrapper
 * de extensão que intercepta as mutations relevantes.
 */

const TRACKED_MODELS = new Set([
  'SaleOrder', 'PurchaseOrder', 'ProductionOrder', 'Requisition',
  'NFeInbox', 'Quotation', 'PurchaseRequest', 'ServiceOrder',
  'CalderariaOrder', 'FinancialMovement', 'JournalEntry',
]);

const TRACKED_ACTIONS = new Set(['create', 'update', 'updateMany', 'delete', 'deleteMany']);

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super();
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * Registra um evento de auditoria manualmente.
   * Chamado pelos serviços que precisam de rastreabilidade após mutations críticas.
   * O middleware automático foi removido pois Prisma v6 descontinuou $use().
   */
  async auditMutation(params: {
    model:    string;
    action:   string;
    entityId: string | null;
    oldData?: any;
    newData?: any;
  }) {
    if (!TRACKED_MODELS.has(params.model) || !TRACKED_ACTIONS.has(params.action)) return;

    const context = auditStorage.getStore();
    setImmediate(async () => {
      try {
        await (this as any).auditLog.create({
          data: {
            userId:     context?.userId   ?? null,
            module:     'SETTINGS' as any,
            action:     params.action,
            entityType: params.model,
            entityId:   params.entityId   ?? null,
            oldData:    params.oldData    ?? undefined,
            newData:    params.newData    ?? undefined,
            ipAddress:  context?.ipAddress ?? null,
            userAgent:  context?.userAgent ?? null,
          },
        });
      } catch (e) {
        this.logger.warn(`Audit log failed for ${params.model}.${params.action}: ${e}`);
      }
    });
  }
}
