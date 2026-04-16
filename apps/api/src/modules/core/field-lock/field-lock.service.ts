import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

/**
 * Sprint 2.1 — Soft Lock por Campo
 *
 * Garante que campos fiscais não sejam alterados após aprovação,
 * enquanto campos operacionais (dataEntrega, observacoes, responsavel, etc.)
 * permanecem sempre editáveis — diferente do modelo TOTVS/SAP que bloqueia tudo.
 *
 * Regras base embutidas (podem ser sobrescritas via DocumentFieldLock no banco):
 *   - SaleOrder/PurchaseOrder/ProductionOrder com status != RASCUNHO:
 *       locked: clienteId, valorTotal, cfop, ncm, itens fiscais
 *       free:   dataEntrega, observacoes, responsavel, motivoAlteracao
 *   - Campos de engenharia (BOM, roteiro): editáveis, exigem motivoAlteracao
 */

export interface FieldLockResult {
  allowed: boolean;
  lockedFields: string[];
  requiresMotivo: boolean;
  violatedFields: string[];
}

// Regras padrão por entityType — aplicadas quando não há config no banco
const DEFAULT_LOCKED_FIELDS: Record<string, Record<string, string[]>> = {
  SaleOrder: {
    APROVADO:   ['clienteId', 'vendedorId', 'valorTotal', 'desconto', 'cfop'],
    FATURADO:   ['clienteId', 'vendedorId', 'valorTotal', 'desconto', 'cfop', 'items'],
    ENTREGUE:   ['clienteId', 'vendedorId', 'valorTotal', 'desconto', 'cfop', 'items'],
  },
  PurchaseOrder: {
    APROVADO:   ['fornecedorId', 'valorTotal', 'items'],
    RECEBIDO:   ['fornecedorId', 'valorTotal', 'items', 'frete'],
  },
  ProductionOrder: {
    LIBERADA:   ['productId', 'quantity', 'bomId'],
    EM_PRODUCAO: ['productId', 'quantity', 'bomId'],
    CONCLUIDA:  ['productId', 'quantity', 'bomId', 'items'],
  },
  Requisition: {
    APROVADA:   ['productId', 'quantityRequested'],
    ENTREGUE:   ['productId', 'quantityRequested', 'quantityApproved'],
  },
};

const DEFAULT_FREE_FIELDS: Record<string, string[]> = {
  SaleOrder:       ['dataEntrega', 'observacoes', 'motivoAlteracao', 'responsavelId'],
  PurchaseOrder:   ['dataEntregaPrevista', 'observations', 'motivoAlteracao'],
  ProductionOrder: ['dataPrevisaoFim', 'observations', 'motivoAlteracao', 'prioridade'],
  Requisition:     ['justificativa', 'motivoAlteracao'],
};

const REQUIRES_MOTIVO_FIELDS: Record<string, string[]> = {
  ProductionOrder: ['dataPrevisaoFim', 'prioridade'],
  SaleOrder:       ['dataEntrega'],
};

@Injectable()
export class FieldLockService {
  private readonly logger = new Logger(FieldLockService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Valida se os campos alterados são permitidos para o documento/status atual.
   * Lança BadRequestException com lista detalhada se campos bloqueados forem tocados.
   */
  async validate(
    companyId: string,
    entityType: string,
    currentStatus: string,
    changedFields: string[],
    motivoAlteracao?: string,
  ): Promise<FieldLockResult> {
    // Busca config customizada no banco
    const dbConfig = await this.prisma.documentFieldLock.findUnique({
      where: {
        companyId_entityType_fromStatus: {
          companyId,
          entityType,
          fromStatus: currentStatus,
        },
      },
    });

    // Resolve locked e free fields (DB sobrescreve defaults)
    const lockedFields: string[] =
      dbConfig?.lockedFields ??
      DEFAULT_LOCKED_FIELDS[entityType]?.[currentStatus] ??
      [];

    const freeFields: string[] =
      dbConfig?.freeFields ??
      DEFAULT_FREE_FIELDS[entityType] ??
      [];

    const requiresMotivo: boolean =
      dbConfig?.requireMotivo ??
      (REQUIRES_MOTIVO_FIELDS[entityType]?.some((f) => changedFields.includes(f)) ?? false);

    // Campos realmente bloqueados = locked - free
    const effectiveLocked = lockedFields.filter((f) => !freeFields.includes(f));
    const violatedFields = changedFields.filter((f) => effectiveLocked.includes(f));

    if (violatedFields.length > 0) {
      throw new BadRequestException(
        `Campo(s) [${violatedFields.join(', ')}] não podem ser alterados com status "${currentStatus}". ` +
        `Campos sempre editáveis: [${freeFields.join(', ')}].`,
      );
    }

    if (requiresMotivo && !motivoAlteracao?.trim()) {
      throw new BadRequestException(
        `Alteração de [${changedFields.join(', ')}] exige o campo "motivoAlteracao" preenchido.`,
      );
    }

    return {
      allowed: true,
      lockedFields: effectiveLocked,
      requiresMotivo,
      violatedFields: [],
    };
  }

  /**
   * Retorna a configuração de lock para um tipo de documento e status.
   * Usado pelo frontend para renderizar campos como readonly.
   */
  async getConfig(companyId: string, entityType: string, currentStatus: string) {
    const dbConfig = await this.prisma.documentFieldLock.findUnique({
      where: {
        companyId_entityType_fromStatus: {
          companyId,
          entityType,
          fromStatus: currentStatus,
        },
      },
    });

    return {
      entityType,
      currentStatus,
      lockedFields:  dbConfig?.lockedFields  ?? DEFAULT_LOCKED_FIELDS[entityType]?.[currentStatus] ?? [],
      freeFields:    dbConfig?.freeFields    ?? DEFAULT_FREE_FIELDS[entityType] ?? [],
      requireMotivo: dbConfig?.requireMotivo ?? false,
      source:        dbConfig ? 'database' : 'default',
    };
  }

  /**
   * Salva/atualiza configuração de lock para um tipo de documento/status.
   */
  async upsertConfig(
    companyId: string,
    entityType: string,
    fromStatus: string,
    lockedFields: string[],
    freeFields: string[],
    requireMotivo: boolean,
  ) {
    return this.prisma.documentFieldLock.upsert({
      where: {
        companyId_entityType_fromStatus: { companyId, entityType, fromStatus },
      },
      create: { companyId, entityType, fromStatus, lockedFields, freeFields, requireMotivo },
      update: { lockedFields, freeFields, requireMotivo },
    });
  }
}
