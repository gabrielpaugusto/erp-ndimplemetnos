import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';
import { CreateCteDto } from './dto/create-cte.dto';

@Injectable()
export class CteService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── LISTAGEM ───────────────────────────────────────────────────────────────

  async findAll(
    companyId: string,
    query: {
      search?: string;
      status?: string;
      startDate?: string;
      endDate?: string;
      page?: string;
      limit?: string;
    },
  ) {
    const page  = parseInt(query.page  || '1',  10);
    const limit = parseInt(query.limit || '20', 10);
    const skip  = (page - 1) * limit;

    const where: any = { companyId };

    if (query.search) {
      where.OR = [
        { numero: { contains: query.search, mode: 'insensitive' } },
        { transportadoraNome: { contains: query.search, mode: 'insensitive' } },
        { chaveAcesso: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.status) where.status = query.status;

    if (query.startDate || query.endDate) {
      where.dataEmissao = {};
      if (query.startDate) where.dataEmissao.gte = new Date(query.startDate);
      if (query.endDate)   where.dataEmissao.lte = new Date(query.endDate);
    }

    const [data, total] = await Promise.all([
      this.prisma.cteDocument.findMany({
        where,
        skip,
        take: limit,
        orderBy: { dataEmissao: 'desc' },
        include: {
          transportadora: { select: { id: true, razaoSocial: true, cpfCnpj: true } },
          purchaseOrder:  { select: { id: true, numero: true, status: true } },
          nfeInbox:       { select: { id: true, numero: true, emitenteNome: true } },
        },
      }),
      this.prisma.cteDocument.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const cte = await this.prisma.cteDocument.findUnique({
      where: { id },
      include: {
        transportadora: {
          select: { id: true, razaoSocial: true, cpfCnpj: true, addresses: { take: 1 } },
        },
        purchaseOrder: {
          include: {
            items: { include: { product: { select: { id: true, description: true, code: true } } } },
          },
        },
        nfeInbox: {
          include: { items: true },
        },
      },
    });

    if (!cte) throw new NotFoundException(`CT-e ${id} não encontrado`);
    return cte;
  }

  // ─── CRIAÇÃO ─────────────────────────────────────────────────────────────────

  async create(companyId: string, dto: CreateCteDto) {
    // Calcula valorTotal = frete + seguro + outras - desconto
    const valorTotal = this.round(
      (dto.valorFrete || 0) +
      (dto.valorSeguro || 0) +
      (dto.valorOutrasDespesas || 0) -
      (dto.valorDesconto || 0),
    );

    // ICMS automático: se não informado, calcula sobre o frete com alíquota padrão
    let valorIcms = dto.valorIcms ?? 0;
    const aliqIcms = dto.aliqIcms ?? 12;
    const bcIcms = dto.bcIcms ?? (dto.valorFrete || 0);
    if (!dto.valorIcms && aliqIcms > 0) {
      valorIcms = this.round(bcIcms * aliqIcms / 100);
    }

    const cte = await this.prisma.cteDocument.create({
      data: {
        companyId,
        chaveAcesso:           dto.chaveAcesso || null,
        numero:                dto.numero,
        serie:                 dto.serie || '0',
        dataEmissao:           new Date(dto.dataEmissao),
        dataEntrega:           dto.dataEntrega ? new Date(dto.dataEntrega) : null,
        transportadoraId:      dto.transportadoraId || null,
        transportadoraCnpj:    dto.transportadoraCnpj,
        transportadoraNome:    dto.transportadoraNome,
        remetenteCnpj:         dto.remetenteCnpj || null,
        remetenteNome:         dto.remetenteNome || null,
        destinatarioCnpj:      dto.destinatarioCnpj || null,
        destinatarioNome:      dto.destinatarioNome || null,
        modalidade:            (dto.modalidade || 'RODOVIARIO') as any,
        naturezaPrestacao:     dto.naturezaPrestacao || 'PRESTAÇÃO DE SERVIÇO DE TRANSPORTE',
        cfop:                  dto.cfop || '2352',
        ufInicio:              dto.ufInicio || null,
        ufFim:                 dto.ufFim || null,
        pesoTotalKg:           dto.pesoTotalKg || null,
        valorFrete:            dto.valorFrete,
        valorSeguro:           dto.valorSeguro || 0,
        valorOutrasDespesas:   dto.valorOutrasDespesas || 0,
        valorDesconto:         dto.valorDesconto || 0,
        valorTotal,
        cstIcms:               dto.cstIcms || '00',
        bcIcms,
        aliqIcms,
        valorIcms,
        creditoIcms:           dto.creditoIcms ?? true,
        condicaoPagamento:     dto.condicaoPagamento || null,
        dataVencimentoFrete:   dto.dataVencimentoFrete ? new Date(dto.dataVencimentoFrete) : null,
        purchaseOrderId:       dto.purchaseOrderId || null,
        nfeInboxId:            dto.nfeInboxId || null,
        observacoes:           dto.observacoes || null,
        xmlContent:            dto.xmlContent || null,
        status:                'REGISTRADO' as any,
      },
      include: {
        transportadora: { select: { id: true, razaoSocial: true, cpfCnpj: true } },
        purchaseOrder:  { select: { id: true, numero: true } },
      },
    });

    return cte;
  }

  async update(id: string, dto: Partial<CreateCteDto>) {
    const existing = await this.prisma.cteDocument.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`CT-e ${id} não encontrado`);

    if (existing.status === 'ESCRITURADO') {
      throw new BadRequestException('CT-e já escriturado não pode ser editado.');
    }

    const data: any = { ...dto };
    if (dto.dataEmissao) data.dataEmissao = new Date(dto.dataEmissao);
    if (dto.dataEntrega) data.dataEntrega = new Date(dto.dataEntrega);
    if (dto.dataVencimentoFrete) data.dataVencimentoFrete = new Date(dto.dataVencimentoFrete);
    delete data.companyId;

    return this.prisma.cteDocument.update({
      where: { id },
      data,
      include: {
        transportadora: { select: { id: true, razaoSocial: true, cpfCnpj: true } },
      },
    });
  }

  // ─── MANIFESTAÇÃO ────────────────────────────────────────────────────────────

  async manifestar(id: string, tipo: 'CIENCIA' | 'CONFIRMACAO' | 'DESCONHECIMENTO' | 'NAO_REALIZADO') {
    const cte = await this.prisma.cteDocument.findUnique({ where: { id } });
    if (!cte) throw new NotFoundException(`CT-e ${id} não encontrado`);

    if (cte.status === 'CANCELADO') {
      throw new BadRequestException('CT-e cancelado não pode ser manifestado.');
    }

    return this.prisma.cteDocument.update({
      where: { id },
      data: {
        manifestacao:     tipo as any,
        dataManifestacao: new Date(),
        status:           'MANIFESTADO' as any,
      },
    });
  }

  // ─── ESCRITURAÇÃO — INTEGRAÇÃO COMPLETA ─────────────────────────────────────
  /**
   * Ao escriturar o CT-e, o sistema:
   *  1. Lança crédito de ICMS no livro fiscal (se creditoIcms = true)
   *  2. Gera título em Contas a Pagar para a transportadora
   *  3. Rateia o custo do frete nos itens da NF-e de entrada vinculada
   *  4. Gera lançamento contábil automático
   *  5. Marca status como ESCRITURADO
   */
  async escriturar(id: string, userId: string) {
    const cte = await this.prisma.cteDocument.findUnique({
      where: { id },
      include: {
        nfeInbox: { include: { items: true } },
        purchaseOrder: { include: { items: { include: { product: true } } } },
        company: true,
        transportadora: true,
      },
    });

    if (!cte) throw new NotFoundException(`CT-e ${id} não encontrado`);
    if (cte.status === 'ESCRITURADO') throw new BadRequestException('CT-e já foi escriturado.');
    if (cte.status === 'CANCELADO')   throw new BadRequestException('CT-e cancelado não pode ser escriturado.');

    const valorFrete = Number(cte.valorFrete);
    const valorIcms  = Number(cte.valorIcms);
    const valorTotal = Number(cte.valorTotal);

    return this.prisma.$transaction(async (tx) => {
      const resultIds: Record<string, string | null> = {
        financialMovementId: null,
        journalEntryId:      null,
        fiscalEntryId:       null,
      };

      // ── 1. Crédito de ICMS no livro fiscal ──────────────────────────────
      if (cte.creditoIcms && valorIcms > 0) {
        const fiscalEntry = await tx.fiscalEntry.create({
          data: ({
            companyId:     cte.companyId,
            type:          'ENTRADA',
            tipoLivro:     'SAIDAS', // ICMS sobre frete é crédito
            dataDocumento: cte.dataEmissao,
            cfop:          cte.cfop,
            cnpjEmitente:  cte.transportadoraCnpj,
            nomeEmitente:  cte.transportadoraNome,
            numeroDoc:     cte.numero,
            serieDoc:      cte.serie,
            valorTotal:    valorTotal,
            bcIcms:        Number(cte.bcIcms),
            aliqIcms:      cte.aliqIcms,
            valorIcms:     valorIcms,
            cstIcms:       cte.cstIcms || '00',
            observacoes:   `CT-e ${cte.numero} — Crédito ICMS sobre frete (CFOP ${cte.cfop})`,
          } as any),
        });
        resultIds.fiscalEntryId = fiscalEntry.id;
      }

      // ── 2. Contas a Pagar — título para a transportadora ────────────────
      if (cte.transportadoraId) {
        const vencimento = cte.dataVencimentoFrete
          ? new Date(cte.dataVencimentoFrete)
          : new Date(new Date(cte.dataEmissao).getTime() + 30 * 24 * 60 * 60 * 1000); // D+30

        const movimento = await tx.financialMovement.create({
          data: {
            companyId:     cte.companyId,
            type:          'PAYABLE' as any,
            personId:      cte.transportadoraId,
            description:   `Frete CT-e ${cte.numero} — ${cte.transportadoraNome}`,
            numero:        `CTE-${cte.numero}`,
            valor:         valorTotal,
            dataEmissao:   cte.dataEmissao,
            dataVencimento: vencimento,
            status:        'PENDENTE' as any,
            cteDocumentId: cte.id,
            observations:  `CT-e ${cte.numero} emitido em ${cte.dataEmissao.toLocaleDateString('pt-BR')} | ICMS: R$ ${valorIcms.toFixed(2)}`,
          },
        });
        resultIds.financialMovementId = movimento.id;
      }

      // ── 3. Rateio do custo de frete nos itens da NF-e de entrada ────────
      if (cte.nfeInboxId && (cte.nfeInbox?.items?.length ?? 0) > 0) {
        const itens = cte.nfeInbox!.items!;
        const totalMercadorias = itens.reduce((sum, i) => sum + Number(i.valorTotal), 0);

        for (const item of itens) {
          if (totalMercadorias <= 0) break;
          const proporcao     = Number(item.valorTotal) / totalMercadorias;
          const freteRateado  = this.round(valorFrete * proporcao);

          const itemAny = item as any;
          await tx.nFeInboxItem.update({
            where: { id: item.id },
            data: {
              valorFreteRateado: Number(itemAny.valorFreteRateado ?? 0) + freteRateado,
              custoTotal: Number(item.valorTotal) + Number(itemAny.valorFreteRateado ?? 0) + freteRateado,
            } as any,
          });
        }
      }

      // ── 4. Lançamento contábil ───────────────────────────────────────────
      // D: Estoque/Frete a Apropriar | C: Fornecedores (Transportadora)
      // Busca contas contábeis padrão para frete (Despesas c/ Frete e Fornecedores)
      const [ctaFrete, ctaFornecedor, ctaIcms] = await Promise.all([
        tx.chartOfAccount.findFirst({ where: { companyId: cte.companyId, code: { startsWith: '3' }, nature: 'DEVEDORA' }, select: { id: true } }),
        tx.chartOfAccount.findFirst({ where: { companyId: cte.companyId, code: { startsWith: '2' }, nature: 'CREDORA'  }, select: { id: true } }),
        tx.chartOfAccount.findFirst({ where: { companyId: cte.companyId, code: { startsWith: '1' }, nature: 'DEVEDORA' }, select: { id: true } }),
      ]);

      const lancamento = await tx.journalEntry.create({
        data: {
          companyId:   cte.companyId,
          numero:      `CTE-${cte.numero}`,
          date:        cte.dataEmissao,
          description: `CT-e ${cte.numero} — Frete ${cte.transportadoraNome}`,
          totalValue:  valorFrete + (cte.creditoIcms && valorIcms > 0 ? valorIcms * 2 : 0),
          userId:      userId,
          items: {
            create: ([
              // Débito: Despesas com Frete
              {
                type:        'DEVEDORA' as const,
                value:       valorFrete,
                description: `Frete s/ compra — CT-e ${cte.numero}`,
                accountId:   ctaFrete?.id ?? ctaFornecedor?.id ?? '',
              },
              // Crédito: Fornecedores / Transportadora
              {
                type:        'CREDORA' as const,
                value:       valorFrete,
                description: `CT-e ${cte.numero} — ${cte.transportadoraNome} a pagar`,
                accountId:   ctaFornecedor?.id ?? ctaFrete?.id ?? '',
              },
              // Se há crédito de ICMS: D: ICMS a Recuperar / C: Estoque
              ...(cte.creditoIcms && valorIcms > 0 ? [
                {
                  type:        'DEVEDORA' as const,
                  value:       valorIcms,
                  description: `ICMS s/ frete a recuperar — CT-e ${cte.numero}`,
                  accountId:   ctaIcms?.id ?? ctaFrete?.id ?? '',
                },
                {
                  type:        'CREDORA' as const,
                  value:       valorIcms,
                  description: `Redução custo frete (ICMS crédito) — CT-e ${cte.numero}`,
                  accountId:   ctaFornecedor?.id ?? ctaFrete?.id ?? '',
                },
              ] : []),
            ] as any[]),
          },
        },
      });
      resultIds.journalEntryId = lancamento.id;

      // ── 5. Atualiza status do CT-e ───────────────────────────────────────
      const updated = await tx.cteDocument.update({
        where: { id },
        data: {
          status:             'ESCRITURADO' as any,
          custoRateado:       true,
          valorRateadoTotal:  valorFrete,
          financialMovementId: resultIds.financialMovementId,
          journalEntryId:     resultIds.journalEntryId,
          fiscalEntryId:      resultIds.fiscalEntryId,
        },
        include: {
          transportadora: { select: { id: true, razaoSocial: true, cpfCnpj: true } },
        },
      });

      return {
        ...updated,
        integracoes: {
          creditoIcms:       resultIds.fiscalEntryId ? `R$ ${valorIcms.toFixed(2)} lançado no livro fiscal` : 'Não aplicável',
          contasPagar:       resultIds.financialMovementId ? `Título de R$ ${valorTotal.toFixed(2)} gerado` : 'Transportadora não vinculada',
          rateioFrete:       cte.nfeInboxId ? `Rateado em ${cte.nfeInbox?.items?.length ?? 0} itens da NF-e` : 'Sem NF-e vinculada',
          lancamentoContabil: resultIds.journalEntryId ? 'Lançamento contábil gerado' : 'Erro no lançamento',
        },
      };
    });
  }

  // ─── CANCELAMENTO ────────────────────────────────────────────────────────────

  async cancelar(id: string, motivo: string) {
    const cte = await this.prisma.cteDocument.findUnique({ where: { id } });
    if (!cte) throw new NotFoundException(`CT-e ${id} não encontrado`);

    if (cte.status === 'ESCRITURADO') {
      throw new BadRequestException(
        'CT-e escriturado não pode ser cancelado diretamente. Efetue o estorno contábil primeiro.',
      );
    }

    if (!motivo || motivo.length < 15) {
      throw new BadRequestException('Motivo deve ter no mínimo 15 caracteres.');
    }

    return this.prisma.cteDocument.update({
      where: { id },
      data: { status: 'CANCELADO' as any, motivoCancelamento: motivo },
    });
  }

  // ─── STATS ───────────────────────────────────────────────────────────────────

  async getStats(companyId: string, query: { startDate?: string; endDate?: string }) {
    const where: any = { companyId };
    if (query.startDate || query.endDate) {
      where.dataEmissao = {};
      if (query.startDate) where.dataEmissao.gte = new Date(query.startDate);
      if (query.endDate)   where.dataEmissao.lte = new Date(query.endDate);
    }

    const [byStatus, totais, creditoIcms] = await Promise.all([
      this.prisma.cteDocument.groupBy({
        by: ['status'],
        where,
        _count: { id: true },
        _sum:   { valorTotal: true },
      }),
      this.prisma.cteDocument.aggregate({
        where,
        _sum:   { valorFrete: true, valorIcms: true, valorTotal: true },
        _count: { id: true },
      }),
      this.prisma.cteDocument.aggregate({
        where: { ...where, creditoIcms: true },
        _sum:  { valorIcms: true },
      }),
    ]);

    return {
      byStatus: byStatus.map((s) => ({
        status:     s.status,
        count:      s._count.id,
        valorTotal: Number(s._sum.valorTotal ?? 0),
      })),
      totais: {
        count:           totais._count.id,
        totalFrete:      Number(totais._sum.valorFrete  ?? 0),
        totalIcms:       Number(totais._sum.valorIcms   ?? 0),
        totalGeral:      Number(totais._sum.valorTotal  ?? 0),
        creditoIcmsRecuperavel: Number(creditoIcms._sum.valorIcms ?? 0),
      },
    };
  }

  private round(v: number): number {
    return Math.round(v * 100) / 100;
  }
}
