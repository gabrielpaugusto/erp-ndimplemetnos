import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';
import { SefazClientService } from '@/modules/corporate/fiscal/government/sefaz/sefaz-client.service';
import { CreateCteDto } from './dto/create-cte.dto';
import { OperacoesFiscaisService } from '@/modules/corporate/fiscal/operacoes-fiscais.service';

@Injectable()
export class CteService {
  private readonly logger = new Logger(CteService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sefazClient: SefazClientService,
    private readonly operacoesFiscais: OperacoesFiscaisService,
  ) {}

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

    // ── Consulta Motor de Regras Fiscais (TES) para FRETE ──────────────────
    const company = await this.prisma.company.findUnique({
      where: { id: cte.companyId },
      select: { taxRegime: true, uf: true },
    });
    const taxRegimeEmpresa = (company as any)?.taxRegime ?? 'LUCRO_REAL';
    const ufEmpresa        = (company as any)?.uf ?? '';

    // `creditoIcms` no CT-e = true → FOB (destinatário paga = pode creditar)
    //                          false → CIF (emitente paga = não credita)
    const freteContaDestinatario: boolean = cte.creditoIcms ?? false;

    const regra = await this.operacoesFiscais.determinar(cte.companyId, {
      tipo:                    'ENTRADA',
      destinacao:              'FRETE',
      ufFornecedor:            (cte as any).transportadoraUf ?? ufEmpresa,
      ufEmpresa,
      freteContaDestinatario,
      taxRegimeEmpresa,
    });

    // Créditos efetivos determinados pelo motor
    const deveCreditarIcms     = regra?.creditaIcms       ?? freteContaDestinatario;
    const deveCreditarPisCofins = regra?.creditaPisCofins ?? (freteContaDestinatario && taxRegimeEmpresa === 'LUCRO_REAL');
    const cfopEscriturado      = regra?.cfop ?? cte.cfop ?? '2352';
    const cstIcmsEscriturado   = regra?.cstIcms ?? cte.cstIcms ?? '000';

    // Calcula PIS/COFINS sobre frete (alíquotas não-cumulativas: 1,65% + 7,6%)
    const valorPisFrete    = deveCreditarPisCofins ? this.round(valorFrete * 0.0165) : 0;
    const valorCofinsFrete = deveCreditarPisCofins ? this.round(valorFrete * 0.076)  : 0;

    return this.prisma.$transaction(async (tx) => {
      const resultIds: Record<string, string | null> = {
        financialMovementId: null,
        journalEntryId:      null,
        fiscalEntryId:       null,
      };

      // ── 1. Lançamentos fiscais: ICMS e PIS/COFINS (quando crédito permitido) ──
      const fiscalBase: any = {
        companyId:     cte.companyId,
        type:          'CREDITO',
        bookType:      'ENTRADA',
        dataLancamento: cte.dataEmissao,
        periodoReferencia: `${cte.dataEmissao.getFullYear()}-${String(cte.dataEmissao.getMonth()+1).padStart(2,'0')}`,
        cfopCode:      cfopEscriturado,
        naturezaOperacao: 'Prestação de Serviço de Transporte',
        valorContabil: valorTotal,
        baseCalculo:   valorFrete,
        observations:  `CT-e ${cte.numero}/${cte.serie} — ${cte.transportadoraNome} | ${freteContaDestinatario ? 'FOB' : 'CIF'}`,
      };

      if (deveCreditarIcms && valorIcms > 0) {
        const fiscalEntry = await tx.fiscalEntry.create({
          data: { ...fiscalBase, taxType: 'ICMS',
            aliquota: valorFrete > 0 ? (valorIcms / valorFrete) * 100 : 0,
            valorImposto: valorIcms } as any,
        });
        resultIds.fiscalEntryId = fiscalEntry.id;
      }
      if (deveCreditarPisCofins && valorPisFrete > 0) {
        await tx.fiscalEntry.create({ data: { ...fiscalBase, taxType: 'PIS',    aliquota: 1.65, valorImposto: valorPisFrete    } as any });
        await tx.fiscalEntry.create({ data: { ...fiscalBase, taxType: 'COFINS', aliquota: 7.60, valorImposto: valorCofinsFrete } as any });
      }

      // Se não há nenhum crédito, ainda assim registra o livro (sem valor de imposto)
      if (!deveCreditarIcms && !deveCreditarPisCofins) {
        await tx.fiscalEntry.create({
          data: { ...fiscalBase, taxType: 'ICMS', aliquota: 0, valorImposto: 0,
            observations: `${fiscalBase.observations} — sem crédito (CIF)` } as any,
        });
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
      const [ctaFrete, ctaFornecedor, ctaIcms] = await Promise.all([
        tx.chartOfAccount.findFirst({ where: { companyId: cte.companyId, code: { startsWith: regra?.contaDebitoCode?.charAt(0) ?? '3' }, nature: 'DEVEDORA' }, select: { id: true } }),
        tx.chartOfAccount.findFirst({ where: { companyId: cte.companyId, code: { startsWith: '2' }, nature: 'CREDORA'  }, select: { id: true } }),
        tx.chartOfAccount.findFirst({ where: { companyId: cte.companyId, code: { startsWith: '1' }, nature: 'DEVEDORA' }, select: { id: true } }),
      ]);

      const totalJournal = valorFrete
        + (deveCreditarIcms && valorIcms > 0 ? valorIcms * 2 : 0)
        + (deveCreditarPisCofins ? (valorPisFrete + valorCofinsFrete) * 2 : 0);

      const lancamento = await tx.journalEntry.create({
        data: {
          companyId:   cte.companyId,
          numero:      `CTE-${cte.numero}`,
          date:        cte.dataEmissao,
          description: `CT-e ${cte.numero} — Frete ${freteContaDestinatario ? 'FOB' : 'CIF'} — ${cte.transportadoraNome}`,
          totalValue:  totalJournal,
          userId:      userId,
          items: {
            create: ([
              // D: Despesas com Frete
              { type: 'DEVEDORA' as const, value: valorFrete,
                description: `Frete s/ compra — CT-e ${cte.numero} (${freteContaDestinatario ? 'FOB' : 'CIF'})`,
                accountId: ctaFrete?.id ?? ctaFornecedor?.id ?? '' },
              // C: Fornecedores / Transportadora
              { type: 'CREDORA' as const, value: valorFrete,
                description: `CT-e ${cte.numero} — ${cte.transportadoraNome} a pagar`,
                accountId: ctaFornecedor?.id ?? ctaFrete?.id ?? '' },
              // FOB → D: ICMS a Recuperar / C: Redução Custo Frete
              ...(deveCreditarIcms && valorIcms > 0 ? [
                { type: 'DEVEDORA' as const,  value: valorIcms, description: `ICMS s/ frete a recuperar (FOB) — CT-e ${cte.numero}`,   accountId: ctaIcms?.id ?? ctaFrete?.id ?? '' },
                { type: 'CREDORA'  as const,  value: valorIcms, description: `Redução custo frete (crédito ICMS FOB) — CT-e ${cte.numero}`, accountId: ctaFornecedor?.id ?? ctaFrete?.id ?? '' },
              ] : []),
              // FOB + Lucro Real → D: PIS/COFINS a Recuperar / C: Redução Custo Frete
              ...(deveCreditarPisCofins && valorPisFrete > 0 ? [
                { type: 'DEVEDORA' as const,  value: valorPisFrete + valorCofinsFrete,    description: `PIS/COFINS s/ frete a recuperar (FOB) — CT-e ${cte.numero}`,   accountId: ctaIcms?.id ?? ctaFrete?.id ?? '' },
                { type: 'CREDORA'  as const,  value: valorPisFrete + valorCofinsFrete,    description: `Redução custo frete (crédito PIS/COF FOB) — CT-e ${cte.numero}`, accountId: ctaFornecedor?.id ?? ctaFrete?.id ?? '' },
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

  // ─── SINCRONIZAÇÃO SEFAZ (via NFeDistribuicaoDFe — retorna CT-e também) ────────

  async syncFromSefaz(companyId: string) {
    const [company, moduleRows] = await Promise.all([
      this.prisma.company.findUnique({
        where: { id: companyId },
        select: { cnpj: true, uf: true, ambienteDFe: true, dataInicioOperacao: true },
      }),
      this.prisma.moduleStartDate.findMany({ where: { companyId } }),
    ]);
    if (!company?.cnpj) throw new BadRequestException('CNPJ da empresa não configurado');
    const globalInicio: Date | null = (company as any)?.dataInicioOperacao ?? null;
    const byModule: Record<string, Date> = {};
    for (const row of moduleRows) byModule[row.module] = row.startDate;
    const dataInicio: Date | null = byModule['CTE_ENTRADA'] ?? globalInicio ?? null;
    const uf = company.uf || 'SP';

    // NSU inicial: prioriza nsuRetornado do último 656 (SEFAZ exige uso do ultNSU retornado)
    const lastAuditLog = await this.prisma.sefazAuditLog.findFirst({
      where: { companyId, endpoint: 'NFeDistribuicaoDFe' },
      orderBy: { chamadaEm: 'desc' },
      select: { cStat: true, nsuRetornado: true },
    });

    let ultNSU: string;
    if (lastAuditLog?.cStat === '656' && lastAuditLog.nsuRetornado) {
      ultNSU = lastAuditLog.nsuRetornado;
      this.logger.log(`[Sync-CTe] Usando NSU do último 656 retornado pelo SEFAZ: ${ultNSU}`);
    } else {
      const [lastNfeNsu, lastCteNsu, lastMdfeNsu, lastEventoNsu] = await Promise.all([
        this.prisma.nFeInbox.findFirst({ where: { companyId, nsu: { not: null } }, orderBy: { nsu: 'desc' }, select: { nsu: true } }),
        this.prisma.cteDocument.findFirst({ where: { companyId, nsu: { not: null } }, orderBy: { nsu: 'desc' }, select: { nsu: true } }),
        this.prisma.mdfeInbox.findFirst({ where: { companyId, nsu: { not: null } }, orderBy: { nsu: 'desc' }, select: { nsu: true } }),
        this.prisma.dFeEvento.findFirst({ where: { companyId, nsu: { not: null } }, orderBy: { nsu: 'desc' }, select: { nsu: true } }),
      ]);
      const allNsus = [lastNfeNsu?.nsu, lastCteNsu?.nsu, lastMdfeNsu?.nsu, lastEventoNsu?.nsu].filter(Boolean) as string[];
      ultNSU = allNsus.length > 0 ? allNsus.sort().at(-1)! : '000000000000000';
    }
    this.logger.log(`[Sync-CTe] Usando NFeDistribuicaoDFe (retorna CT-e também). NSU inicial: ${ultNSU}`);

    let totalCreated = 0;
    let hasMore = true;

    while (hasMore) {
      const ambienteDFe = String(company.ambienteDFe ?? 2) as '1' | '2';
      const result = await this.sefazClient.distribuicaoDFe(companyId, uf, company.cnpj, ultNSU, ambienteDFe);
      this.logger.log(`[Sync-CTe] DistDFe: success=${result.success} cStat=${result.cStat} docs=${result.docs.length}`);

      if (!result.success) {
        if (result.cStat === '656') {
          this.logger.log(`[Sync-CTe] Limite de taxa SEFAZ (656). Encerrando com ${totalCreated} CT-e(s).`);
          const proxima = new Date(Date.now() + 60 * 60 * 1000);
          const horaProxima = proxima.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
          return {
            found: totalCreated,
            rateLimited: true,
            message: `⚠️ SEFAZ bloqueou temporariamente (limite: 1 chamada por hora). Tente novamente após ${horaProxima}.`,
          };
        }
        if (result.cStat === '589') {
          ultNSU = '000000000000000';
          continue;
        }
        throw new BadRequestException(`SEFAZ DistDFe erro (cStat ${result.cStat}): ${result.xMotivo}`);
      }

      if (result.docs.length === 0 || result.cStat === '137') {
        hasMore = false;
        break;
      }

      for (const doc of result.docs) {
        const schema = doc.schema || '';
        // Apenas CT-e (ignora NF-e, MDF-e, eventos — já tratados pelo NF-e sync)
        if (!schema.includes('CTe') && !schema.includes('cte') && !schema.includes('resCTe')) continue;

        const parsed = this.sefazClient.parsearXmlCTe(doc.xml);
        if (!parsed?.chCTe) continue;

        // Pula se já existe
        const existing = await this.prisma.cteDocument.findFirst({
          where: { companyId, chaveAcesso: parsed.chCTe },
        });
        if (existing) continue;

        // Ignorar CT-e emitidos antes da data de início de operação
        if (dataInicio && parsed.dhEmi && new Date(parsed.dhEmi) < dataInicio) {
          this.logger.debug(`[Sync-CTe] CT-e ${parsed.chCTe} ignorado (emissão anterior ao início de operação)`);
          continue;
        }

        // Tenta vincular transportadora pelo CNPJ
        const transportadora = parsed.cnpjEmit
          ? await this.prisma.person.findFirst({
              where: { companyId, cpfCnpj: parsed.cnpjEmit },
              select: { id: true },
            })
          : null;

        await this.prisma.cteDocument.create({
          data: {
            companyId,
            chaveAcesso:        parsed.chCTe,
            numero:             parsed.nCT || '0',
            serie:              parsed.serie || '0',
            dataEmissao:        parsed.dhEmi ? new Date(parsed.dhEmi) : new Date(),
            modalidade:         parsed.modalidade as any,
            cfop:               parsed.cfop || '2352',
            transportadoraId:   transportadora?.id ?? null,
            transportadoraCnpj: parsed.cnpjEmit,
            transportadoraNome: parsed.xNomeEmit,
            remetenteCnpj:      parsed.remetenteCnpj || null,
            remetenteNome:      parsed.remetenteNome || null,
            destinatarioCnpj:   parsed.destCnpj || null,
            destinatarioNome:   parsed.destNome || null,
            valorFrete:         parsed.vTPrest,
            valorTotal:         parsed.vTPrest,
            bcIcms:             parsed.vBC,
            aliqIcms:           parsed.pICMS,
            valorIcms:          parsed.vICMS,
            status:             'REGISTRADO',
            nsu:                doc.nsu,
            xmlContent:         doc.xml,
          },
        });
        totalCreated++;
      }

      if (result.maxNSU === ultNSU || result.docs.length < 50) {
        hasMore = false;
      } else {
        ultNSU = result.maxNSU;
      }
    }

    return { found: totalCreated, rateLimited: false, message: `${totalCreated} CT-e(s) importados do SEFAZ` };
  }

  async getSyncStatus(companyId: string) {
    // CT-e usa o mesmo endpoint NFeDistribuicaoDFe — status compartilhado
    const ultimo = await this.prisma.sefazAuditLog.findFirst({
      where: { companyId, endpoint: 'NFeDistribuicaoDFe' },
      orderBy: { chamadaEm: 'desc' },
    });

    const agora = new Date();
    const bloqueadoAte = ultimo?.proximaPermitida ?? null;
    const bloqueado = bloqueadoAte ? bloqueadoAte > agora : false;

    return {
      ultimaSincronizacao: ultimo?.chamadaEm ?? null,
      ultimoCstat: ultimo?.cStat ?? null,
      ultimoMotivo: ultimo?.xMotivo ?? null,
      totalDocsUltima: ultimo?.totalDocs ?? 0,
      bloqueado,
      bloqueadoAte: bloqueadoAte ?? null,
      segundosRestantes: bloqueado && bloqueadoAte
        ? Math.ceil((bloqueadoAte.getTime() - agora.getTime()) / 1000)
        : 0,
      origemBloqueio: (bloqueado ? ultimo?.origem : null) as 'ERP' | 'EXTERNO' | null,
      ambiente: ultimo?.ambiente ?? null,
    };
  }
}
