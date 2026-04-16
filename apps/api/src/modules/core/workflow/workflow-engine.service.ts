import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';

/**
 * Sprint 4.4 — Workflow Engine
 *
 * Motor de regras baseado em eventos de mudança de status de documentos.
 *
 * O schema WorkflowConfig tem:
 *   documentType  String   — "SaleOrder" | "Requisition" | etc.
 *   transitions   Json     — [{ from, to, label, notify?, webhookUrl?, ... }]
 *   notifyOnFields Json    — ["status", "dataEntrega"]
 *   active        Boolean
 *
 * Quando triggerStatusChange() é chamado, busca a config do documentType
 * e encontra a transição cujo `from` + `to` casam, então executa os hooks
 * configurados (notificação na timeline, webhook, log).
 */
@Injectable()
export class WorkflowEngineService {
  private readonly logger = new Logger(WorkflowEngineService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Trigger Principal ───────────────────────────────────────────────────

  /**
   * Chamado após qualquer mudança de status de documento.
   */
  async triggerStatusChange(params: {
    entityType: string;
    entityId:   string;
    companyId:  string;
    fromStatus: string;
    toStatus:   string;
    userId:     string;
    context?:   Record<string, unknown>;
  }): Promise<void> {
    const { entityType, entityId, companyId, fromStatus, toStatus, userId, context } = params;

    // Buscar config pelo documentType
    const config = await this.prisma.workflowConfig.findFirst({
      where: { companyId, documentType: entityType, active: true },
    }).catch(() => null);

    if (!config) return;

    // Encontrar transições que casam com fromStatus → toStatus
    const transitions: Array<{
      from:       string;
      to:         string;
      label?:     string;
      notify?:    string;
      webhookUrl?: string;
      logOnly?:   boolean;
    }> = (config.transitions as any) ?? [];

    const matching = transitions.filter(
      (t) =>
        (t.from === fromStatus || t.from === '*') &&
        (t.to   === toStatus   || t.to   === '*'),
    );

    if (matching.length === 0) return;

    for (const t of matching) {
      try {
        await this.executeTransition(t, { entityType, entityId, companyId, fromStatus, toStatus, userId, context });
      } catch (err: any) {
        this.logger.error(
          `Workflow para ${entityType}/${entityId}: ${err?.message}`,
        );
      }
    }
  }

  // ── Executar uma transição ──────────────────────────────────────────────

  private async executeTransition(
    transition: {
      from: string; to: string; label?: string;
      notify?: string; webhookUrl?: string; logOnly?: boolean;
    },
    params: {
      entityType: string; entityId: string; companyId: string;
      fromStatus: string; toStatus: string; userId: string;
      context?: Record<string, unknown>;
    },
  ): Promise<void> {
    const label = transition.label ?? `${params.fromStatus} → ${params.toStatus}`;

    // 1. Log
    if (!transition.logOnly) {
      this.logger.log(
        `[Workflow] ${params.entityType}#${params.entityId}: ${label}`,
      );
    }

    // 2. Notificação na timeline
    if (transition.notify) {
      await this.prisma.documentEvent.create({
        data: {
          companyId:   params.companyId,
          entityType:  params.entityType,
          entityId:    params.entityId,
          eventType:   'COMENTARIO' as any,
          description: `[Workflow] ${transition.notify}`,
          userId:      params.userId,
        },
      }).catch(() => {/* silently skip */});
    }

    // 3. Webhook (fire-and-forget)
    if (transition.webhookUrl) {
      const url = transition.webhookUrl;
      setImmediate(async () => {
        try {
          const payload = {
            event:      'STATUS_CHANGED',
            entityType: params.entityType,
            entityId:   params.entityId,
            companyId:  params.companyId,
            fromStatus: params.fromStatus,
            toStatus:   params.toStatus,
            userId:     params.userId,
            timestamp:  new Date().toISOString(),
            context:    params.context ?? {},
          };
          const res = await fetch(url, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(payload),
          });
          this.logger.log(`[Workflow] webhook → ${url} — ${res.status}`);
        } catch (e: any) {
          this.logger.warn(`[Workflow] webhook FALHOU: ${e?.message}`);
        }
      });
    }
  }

  // ── CRUD de Configurações ───────────────────────────────────────────────

  async listConfigs(companyId: string, documentType?: string) {
    const where: any = { companyId };
    if (documentType) where.documentType = documentType;
    return this.prisma.workflowConfig.findMany({
      where,
      orderBy: { documentType: 'asc' },
    }).catch(() => [] as any[]);
  }

  async upsertConfig(
    companyId: string,
    dto: {
      documentType: string;
      transitions:  Array<{
        from:       string;
        to:         string;
        label?:     string;
        notify?:    string;
        webhookUrl?: string;
      }>;
      notifyOnFields?: string[];
    },
  ) {
    return this.prisma.workflowConfig.upsert({
      where:  { companyId_documentType: { companyId, documentType: dto.documentType } },
      create: {
        companyId,
        documentType:   dto.documentType,
        transitions:    dto.transitions as any,
        notifyOnFields: (dto.notifyOnFields ?? []) as any,
        active:         true,
      },
      update: {
        transitions:    dto.transitions as any,
        notifyOnFields: (dto.notifyOnFields ?? []) as any,
        active:         true,
      },
    }).catch(() => ({ error: 'WorkflowConfig upsert falhou — execute prisma db push' }));
  }

  async toggleConfig(companyId: string, documentType: string, active: boolean) {
    return this.prisma.workflowConfig.update({
      where: { companyId_documentType: { companyId, documentType } },
      data:  { active },
    }).catch(() => ({ companyId, documentType, active }));
  }

  // ── Templates pré-configurados ──────────────────────────────────────────

  /**
   * Seed de configurações padrão para os fluxos mais comuns.
   */
  async seedDefaults(companyId: string) {
    const defaults: Array<{
      documentType:   string;
      transitions:    any[];
      notifyOnFields: string[];
    }> = [
      {
        documentType:   'Requisition',
        notifyOnFields: ['status'],
        transitions: [
          { from: 'PENDENTE',   to: 'APROVADA',   label: 'Requisição aprovada',   notify: 'Requisição aprovada e pronta para cotação' },
          { from: 'PENDENTE',   to: 'REJEITADA',  label: 'Requisição rejeitada',  notify: 'Requisição rejeitada — verificar motivo' },
          { from: '*',          to: 'CANCELADA',  label: 'Requisição cancelada',  logOnly: true },
        ],
      },
      {
        documentType:   'SaleOrder',
        notifyOnFields: ['status'],
        transitions: [
          { from: '*', to: 'FATURADO',  label: 'Pedido faturado',   notify: 'Pedido faturado — acionar logística para entrega' },
          { from: '*', to: 'ENTREGUE',  label: 'Pedido entregue',   notify: 'Pedido entregue ao cliente — verificar satisfação' },
          { from: '*', to: 'CANCELADO', label: 'Pedido cancelado',  logOnly: true },
        ],
      },
      {
        documentType:   'ProductionOrder',
        notifyOnFields: ['status'],
        transitions: [
          { from: 'EM_PRODUCAO', to: 'CONCLUIDA', label: 'OP concluída', notify: 'Ordem de Produção concluída — produto disponível para expedição' },
          { from: '*',           to: 'PAUSADA',   label: 'OP pausada',   notify: 'Ordem de Produção pausada — verificar ocorrência' },
        ],
      },
      {
        documentType:   'PurchaseOrder',
        notifyOnFields: ['status'],
        transitions: [
          { from: '*', to: 'RECEBIDA', label: 'OC recebida', notify: 'Material recebido — atualizar estoque e verificar NF' },
        ],
      },
    ];

    let created = 0;
    for (const d of defaults) {
      const exists = await this.prisma.workflowConfig.findFirst({
        where: { companyId, documentType: d.documentType },
      }).catch(() => null);
      if (!exists) {
        await this.prisma.workflowConfig.create({
          data: {
            companyId,
            documentType:   d.documentType,
            transitions:    d.transitions as any,
            notifyOnFields: d.notifyOnFields as any,
            active:         true,
          },
        }).catch(() => {/* ignore if model not ready */});
        created++;
      }
    }

    return { created, message: `${created} workflow(s) padrão configurado(s)` };
  }
}
