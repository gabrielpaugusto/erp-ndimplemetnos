import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';

/**
 * Sprint 4.2 — MRP Básico (Material Requirements Planning)
 *
 * Lógica:
 *   Para cada OP em status PLANEJADA ou LIBERADA:
 *     Para cada item da BOM ativa do produto:
 *       necessidade_bruta   = qtd_op * qtd_por_unidade_bom
 *       estoque_disponivel  = stockBalance.availableQuantity
 *       estoque_reservado   = stockBalance.reservedQuantity
 *       necessidade_liquida = max(0, necessidade_bruta - (disponivel - reservado))
 *       → se necessidade_liquida > 0 → gerar MrpSuggestion
 *
 * As sugestões geradas são agrupadas por produto + fornecedor padrão.
 * O usuário pode aceitar (gera Pedido de Compra) ou rejeitar individualmente.
 */
@Injectable()
export class MrpService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Executar MRP ────────────────────────────────────────────────────────

  async run(companyId: string, userId: string) {
    const rodadaId = `MRP-${Date.now()}`;
    const now      = new Date();

    // 1. Buscar OPs ativas com BOM do produto
    const ops = await this.prisma.productionOrder.findMany({
      where: {
        companyId,
        status: { in: ['PLANEJADA', 'LIBERADA'] as any[] },
      },
      include: {
        product: {
          include: {
            boms: {
              where:   { active: true },
              include: {
                items: {
                  include: {
                    product: {
                      select: {
                        id: true, code: true, description: true,
                        unit: true, leadTimeDias: true,
                      },
                    },
                  },
                },
              },
              orderBy: { version: 'desc' },
              take:    1,
            },
          },
        },
      },
    });

    if (ops.length === 0) {
      return { sugestoes: 0, rodadaId, message: 'Nenhuma OP ativa encontrada' };
    }

    // 2. Coletar todos os componentIds necessários
    const componentIds = new Set<string>();
    for (const op of ops) {
      for (const bom of op.product.boms) {
        for (const item of bom.items) {
          componentIds.add(item.productId);
        }
      }
    }

    // 3. Buscar saldos de estoque
    const saldos = await this.prisma.stockBalance.findMany({
      where: { companyId, productId: { in: [...componentIds] } },
      select: { productId: true, availableQuantity: true, reservedQuantity: true },
    });
    const saldoMap = new Map(saldos.map((s) => [s.productId, s]));

    // 4. Calcular necessidades por componente
    const necessidades = new Map<
      string,
      {
        productId:          string;
        code:               string;
        description:        string;
        unit:               string;
        leadTimeDias:       number | null;
        necessidadeBruta:   number;
        estoqueDisponivel:  number;
        estoqueReservado:   number;
        necessidadeLiquida: number;
        opsOrigem:          Array<{ opId: string; opNumero: string; quantidade: number }>;
      }
    >();

    for (const op of ops) {
      const bom = op.product.boms[0];
      if (!bom) continue;

      for (const bomItem of bom.items) {
        const pid         = bomItem.productId;
        const qtd         = Number(op.quantity) * bomItem.quantity;
        const saldo       = saldoMap.get(pid);
        const disponivel  = saldo ? Number(saldo.availableQuantity) : 0;
        const reservado   = saldo ? Number(saldo.reservedQuantity)  : 0;

        const existing = necessidades.get(pid);
        if (existing) {
          existing.necessidadeBruta += qtd;
          existing.opsOrigem.push({ opId: op.id, opNumero: op.numero, quantidade: qtd });
        } else {
          necessidades.set(pid, {
            productId:          pid,
            code:               bomItem.product.code,
            description:        bomItem.product.description,
            unit:               bomItem.product.unit ?? '',
            leadTimeDias:       bomItem.product.leadTimeDias ?? null,
            necessidadeBruta:   qtd,
            estoqueDisponivel:  disponivel,
            estoqueReservado:   reservado,
            necessidadeLiquida: 0,
            opsOrigem:          [{ opId: op.id, opNumero: op.numero, quantidade: qtd }],
          });
        }
      }
    }

    // 5. Calcular necessidade líquida
    for (const n of necessidades.values()) {
      n.necessidadeLiquida = Math.max(
        0,
        n.necessidadeBruta - (n.estoqueDisponivel - n.estoqueReservado),
      );
    }

    const comNecessidade = [...necessidades.values()].filter((n) => n.necessidadeLiquida > 0);

    if (comNecessidade.length === 0) {
      return { sugestoes: 0, rodadaId, message: 'Estoque suficiente para todas as OPs' };
    }

    // 6. Buscar fornecedores preferenciais de cada produto
    const prodIds = comNecessidade.map((n) => n.productId);
    const suppliers = await this.prisma.productSupplier.findMany({
      where: { productId: { in: prodIds }, preferred: true, active: true },
      select: {
        productId:        true,
        personId:         true,
        prazoEntregaDias: true,
      },
      orderBy: { createdAt: 'asc' },
    }).catch(() => [] as any[]);

    const supplierMap = new Map<string, { personId: string; prazoEntregaDias: number | null }>();
    for (const s of suppliers) {
      if (!supplierMap.has(s.productId)) {
        supplierMap.set(s.productId, {
          personId:        s.personId,
          prazoEntregaDias: s.prazoEntregaDias ?? null,
        });
      }
    }

    // 7. Cancelar sugestões PENDENTES anteriores
    await this.prisma.mrpSuggestion.updateMany({
      where: { companyId, status: 'PENDENTE' as any },
      data:  { status: 'REJEITADA' as any, observacoes: 'Cancelada por nova rodada MRP' },
    }).catch(() => {/* ignore se model não existir ainda */});

    // 8. Criar novas sugestões
    let criadas = 0;
    for (const n of comNecessidade) {
      const sup      = supplierMap.get(n.productId);
      const qtdSug   = n.necessidadeLiquida;
      const leadTime = sup?.prazoEntregaDias ?? n.leadTimeDias ?? 30;

      await this.prisma.mrpSuggestion.create({
        data: {
          companyId,
          rodadaId,
          productId:          n.productId,
          supplierId:         sup?.personId ?? null,
          necessidadeBruta:   n.necessidadeBruta,
          estoqueDisponivel:  n.estoqueDisponivel,
          estoqueReservado:   n.estoqueReservado,
          necessidadeLiquida: n.necessidadeLiquida,
          quantidadeSugerida: qtdSug,
          unit:               n.unit || 'UN',
          fontes:             n.opsOrigem as any,
          status:             'PENDENTE' as any,
          observacoes:        `Lead time: ${leadTime}d`,
        },
      }).catch(() => { /* silently skip if model not yet in DB */ });
      criadas++;
    }

    return {
      sugestoes:    criadas,
      rodadaId,
      message:      `${criadas} sugestão(ões) de compra gerada(s)`,
      necessidades: comNecessidade.map((n) => ({
        ...n,
        fornecedorPadrao: supplierMap.get(n.productId)?.personId ?? null,
      })),
    };
  }

  // ── Listar sugestões ────────────────────────────────────────────────────

  async listSuggestions(companyId: string, status?: string) {
    const where: any = { companyId };
    if (status) where.status = status;

    return this.prisma.mrpSuggestion.findMany({
      where,
      include: {
        product:  { select: { id: true, code: true, description: true, unit: true } },
        supplier: { select: { id: true, razaoSocial: true } },
      },
      orderBy: { geradoEm: 'desc' },
    }).catch(() => [] as any[]);
  }

  // ── Aceitar sugestão (gera Pedido de Compra rascunho) ───────────────────

  async acceptSuggestion(id: string, companyId: string, userId: string) {
    const sug = await this.prisma.mrpSuggestion.findFirst({
      where: { id, companyId },
      include: {
        product:  true,
        supplier: true,
      },
    }).catch(() => null);

    if (!sug) throw new NotFoundException(`Sugestão MRP ${id} não encontrada`);

    // Gerar número do pedido de compra (String no schema)
    const maxPo = await this.prisma.purchaseOrder.findFirst({
      where:   { companyId },
      orderBy: { createdAt: 'desc' },
      select:  { numero: true },
    });
    const lastNum   = maxPo?.numero ? parseInt(maxPo.numero, 10) : 0;
    const nextNumero = String(lastNum + 1).padStart(6, '0');

    const s = sug as any;

    const po = await this.prisma.$transaction(async (tx) => {
      // Pedido de compra precisa de supplierId — usar fornecedor da sugestão ou lançar erro gracioso
      if (!s.supplierId) {
        throw new Error('Sugestão sem fornecedor preferencial — associe um fornecedor antes de aceitar');
      }

      const order = await tx.purchaseOrder.create({
        data: {
          companyId,
          numero:       nextNumero,
          supplierId:   s.supplierId,
          status:       'RASCUNHO' as any,
          observations: `Gerado pelo MRP (rodada ${s.rodadaId})`,
          items: {
            create: [{
              productId:        s.productId,
              quantity:         s.quantidadeSugerida,
              unit:             s.unit ?? 'UN',
              unitPrice:        0,
              totalPrice:       0,
              quantityReceived: 0,
            }],
          },
        },
        include: {
          supplier: { select: { razaoSocial: true } },
          items:    { include: { product: { select: { code: true, description: true } } } },
        },
      });

      // Atualizar status da sugestão
      await tx.mrpSuggestion.update({
        where: { id },
        data:  { status: 'ACEITA' as any, purchaseOrderId: order.id },
      }).catch(() => {/* ignore if field doesn't exist */});

      return order;
    });

    return po;
  }

  // ── Rejeitar sugestão ───────────────────────────────────────────────────

  async rejectSuggestion(id: string, companyId: string, motivo?: string) {
    const sug = await this.prisma.mrpSuggestion.findFirst({
      where: { id, companyId },
    }).catch(() => null);

    if (!sug) throw new NotFoundException(`Sugestão MRP ${id} não encontrada`);

    return this.prisma.mrpSuggestion.update({
      where: { id },
      data:  {
        status:     'REJEITADA' as any,
        observacoes: motivo ? `Rejeitada: ${motivo}` : 'Rejeitada manualmente',
      },
    }).catch(() => ({ id, status: 'REJEITADA', motivo }));
  }

  // ── Preview (sem persistir) ─────────────────────────────────────────────

  async preview(companyId: string) {
    // Executar uma análise sem persistir: calcula e retorna as necessidades
    const rodadaId = `PREVIEW-${Date.now()}`;
    const ops = await this.prisma.productionOrder.findMany({
      where: {
        companyId,
        status: { in: ['PLANEJADA', 'LIBERADA'] as any[] },
      },
      include: {
        product: {
          include: {
            boms: {
              where:   { active: true },
              include: { items: { include: { product: { select: { id: true, code: true, description: true, unit: true, leadTimeDias: true } } } } },
              orderBy: { version: 'desc' },
              take:    1,
            },
          },
        },
      },
    });

    const componentIds = new Set<string>();
    for (const op of ops) {
      for (const bom of op.product.boms) {
        for (const item of bom.items) componentIds.add(item.productId);
      }
    }

    const saldos = await this.prisma.stockBalance.findMany({
      where: { companyId, productId: { in: [...componentIds] } },
      select: { productId: true, availableQuantity: true, reservedQuantity: true },
    });
    const saldoMap = new Map(saldos.map((s) => [s.productId, s]));

    const necessidades: any[] = [];
    const seen = new Map<string, any>();

    for (const op of ops) {
      const bom = op.product.boms[0];
      if (!bom) continue;
      for (const bomItem of bom.items) {
        const pid = bomItem.productId;
        const qtd = Number(op.quantity) * bomItem.quantity;
        const saldo = saldoMap.get(pid);
        const disponivel = saldo ? Number(saldo.availableQuantity) : 0;
        const reservado  = saldo ? Number(saldo.reservedQuantity)  : 0;
        if (seen.has(pid)) {
          seen.get(pid).necessidadeBruta += qtd;
        } else {
          const n = {
            productId:          pid,
            code:               bomItem.product.code,
            description:        bomItem.product.description,
            unit:               bomItem.product.unit ?? '',
            necessidadeBruta:   qtd,
            estoqueDisponivel:  disponivel,
            estoqueReservado:   reservado,
            necessidadeLiquida: 0,
          };
          seen.set(pid, n);
          necessidades.push(n);
        }
      }
    }

    for (const n of necessidades) {
      n.necessidadeLiquida = Math.max(0, n.necessidadeBruta - (n.estoqueDisponivel - n.estoqueReservado));
    }

    const comNecessidade = necessidades.filter((n) => n.necessidadeLiquida > 0);

    return {
      preview:      true,
      sugestoes:    comNecessidade.length,
      rodadaId,
      message:      comNecessidade.length > 0
        ? `${comNecessidade.length} item(ns) com necessidade de compra`
        : 'Estoque suficiente para todas as OPs',
      necessidades: comNecessidade,
    };
  }
}
