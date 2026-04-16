import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';
import { IntegrationService } from '@/modules/core/integration/integration.service';
import { TaxEngineService } from '../tax-engine.service';
import { NfeXmlBuilderService } from './nfe-xml-builder.service';
import { NfeSignerService } from './nfe-signer.service';
import { DifalService } from './difal.service';
import { NfeIaPipelineSaidaService } from './nfe-ia-pipeline-saida.service';
import { SefazClientService } from '../government/sefaz/sefaz-client.service';
import { CertificadoService } from '@/modules/core/company/certificado.service';
import { CreateNfeDto } from './dto/create-nfe.dto';
import { UpdateNfeDto } from './dto/update-nfe.dto';
import { OperacoesFiscaisService } from '../operacoes-fiscais.service';
import { Logger } from '@nestjs/common';

@Injectable()
export class NfeService {
  private readonly logger = new Logger(NfeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly integration: IntegrationService,
    private readonly taxEngine: TaxEngineService,
    private readonly xmlBuilder: NfeXmlBuilderService,
    private readonly signer: NfeSignerService,
    private readonly difalService: DifalService,
    private readonly pipelineSaida: NfeIaPipelineSaidaService,
    private readonly sefazClient: SefazClientService,
    private readonly certificadoService: CertificadoService,
    private readonly operacoesFiscais: OperacoesFiscaisService,
  ) {}

  async findAll(
    companyId: string,
    query: {
      search?: string;
      type?: string;
      status?: string;
      operation?: string;
      startDate?: string;
      endDate?: string;
      page?: string;
      limit?: string;
    },
  ) {
    const page = parseInt(query.page || '1', 10);
    const limit = parseInt(query.limit || '20', 10);
    const skip = (page - 1) * limit;

    const where: any = { companyId };

    if (query.search) {
      where.OR = [
        { numero: !isNaN(Number(query.search)) ? Number(query.search) : undefined },
        { chaveAcesso: { contains: query.search, mode: 'insensitive' } },
        { naturezaOperacao: { contains: query.search, mode: 'insensitive' } },
        {
          person: {
            razaoSocial: { contains: query.search, mode: 'insensitive' },
          },
        },
      ].filter((c) => {
        // Remove undefined numero filter
        if ('numero' in c && c.numero === undefined) return false;
        return true;
      });
    }

    if (query.type) {
      where.type = query.type;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.operation) {
      where.operation = query.operation;
    }

    if (query.startDate || query.endDate) {
      where.dataEmissao = {};
      if (query.startDate) {
        where.dataEmissao.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        where.dataEmissao.lte = new Date(query.endDate);
      }
    }

    const [data, total] = await Promise.all([
      this.prisma.nFeDocument.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ createdAt: 'desc' }],
        include: {
          person: {
            select: { id: true, razaoSocial: true, cpfCnpj: true },
          },
        },
      }),
      this.prisma.nFeDocument.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const nfe = await this.prisma.nFeDocument.findUnique({
      where: { id },
      include: {
        person: {
          select: {
            id: true,
            cpfCnpj: true,
            razaoSocial: true,
            nomeFantasia: true,
            rgIe: true,
          },
        },
        items: {
          include: {
            product: {
              select: { id: true, description: true, code: true, unit: true },
            },
          },
          orderBy: { itemNumber: 'asc' },
        },
        saleOrder: {
          select: { id: true, numero: true, status: true },
        },
        serviceOrder: {
          select: { id: true, numero: true, status: true },
        },
      },
    });

    if (!nfe) {
      throw new NotFoundException(`NF-e ${id} not found`);
    }

    return nfe;
  }

  async create(companyId: string, data: CreateNfeDto) {
    return this.prisma.$transaction(async (tx) => {
      const items = data.items || [];

      const valorProdutos = items.reduce(
        (sum, i) => sum + i.quantity * i.unitPrice,
        0,
      );

      const nfe = await tx.nFeDocument.create({
        data: {
          companyId,
          type: data.type as any,
          finality: (data.finality || 'NORMAL') as any,
          operation: data.operation as any,
          status: 'RASCUNHO' as any,
          personId: data.personId,
          saleOrderId: data.saleOrderId || null,
          serviceOrderId: data.serviceOrderId || null,
          naturezaOperacao: data.naturezaOperacao,
          dataEmissao: new Date(data.dataEmissao),
          valorProdutos,
          valorTotal: valorProdutos,
          informacoesComplementares: data.informacoesComplementares || null,
          items:
            items.length > 0
              ? {
                  create: items.map((item, index) => ({
                    itemNumber: index + 1,
                    productId: item.productId || null,
                    description: item.description,
                    ncmCode: item.ncmCode,
                    cfopCode: item.cfopCode,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    totalPrice: item.quantity * item.unitPrice,
                    unit: item.unit,
                  })),
                }
              : undefined,
        },
        include: {
          person: {
            select: { id: true, razaoSocial: true, cpfCnpj: true },
          },
          items: true,
        },
      });

      return nfe;
    });
  }

  async update(id: string, data: UpdateNfeDto) {
    const existing = await this.prisma.nFeDocument.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`NF-e ${id} not found`);
    }

    if (existing.status !== 'RASCUNHO') {
      throw new BadRequestException(
        `Cannot update NF-e with status ${existing.status}. Only RASCUNHO can be edited.`,
      );
    }

    const updateData: any = { ...data };
    delete updateData.items;

    if (data.dataEmissao) {
      updateData.dataEmissao = new Date(data.dataEmissao);
    }

    return this.prisma.nFeDocument.update({
      where: { id },
      data: updateData,
      include: {
        person: {
          select: { id: true, razaoSocial: true, cpfCnpj: true },
        },
        items: true,
      },
    });
  }

  /**
   * Calculate taxes for all items on the NF-e.
   * Tenta primeiro com FiscalBrain (CFOP/CST/alíquotas contextualizados).
   * Se a classificação IA não estiver disponível, usa TaxEngine como fallback.
   */
  async calculateTaxes(id: string) {
    const nfe = await this.prisma.nFeDocument.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!nfe) {
      throw new NotFoundException(`NF-e ${id} not found`);
    }

    // ── FiscalBrain: verifica se já existem decisões para todos os itens ──
    const itemIds = nfe.items.map(i => i.id);
    const decisions = await this.prisma.fiscalBrainDecision.findMany({
      where: { companyId: nfe.companyId, documentType: 'NFeItem', documentId: { in: itemIds } },
      orderBy: { createdAt: 'desc' },
    });
    const latestByItem = new Map<string, typeof decisions[0]>();
    for (const d of decisions) {
      if (!latestByItem.has(d.documentId)) latestByItem.set(d.documentId, d);
    }

    // Verifica se todos os itens têm decisão autoAplicada → pula TaxEngine
    const todosAutoClassificados = nfe.items.length > 0 &&
      nfe.items.every(i => latestByItem.get(i.id)?.autoAplicado === true);

    if (todosAutoClassificados) {
      this.logger.log(`[calculateTaxes] NF-e ${id}: todos os itens classificados pelo FiscalBrain — pulando TaxEngine`);
      // Totais já aplicados no banco pelo pipeline; apenas recalcula totais e DIFAL
    } else {
      // ── Tenta FiscalBrain primeiro (fire-and-forget se ainda não classificado) ──
      const naoClassificados = nfe.items.filter(i => !latestByItem.has(i.id));
      if (naoClassificados.length > 0) {
        this.logger.log(`[calculateTaxes] NF-e ${id}: ${naoClassificados.length} item(s) sem classificação IA — executando pipeline saída`);
        try {
          await this.pipelineSaida.classificarNfe(id, nfe.companyId);
          // Recarrega decisões após pipeline
          const decisoesNovas = await this.prisma.fiscalBrainDecision.findMany({
            where: { companyId: nfe.companyId, documentType: 'NFeItem', documentId: { in: itemIds } },
            orderBy: { createdAt: 'desc' },
          });
          latestByItem.clear();
          for (const d of decisoesNovas) {
            if (!latestByItem.has(d.documentId)) latestByItem.set(d.documentId, d);
          }
        } catch (err: unknown) {
          this.logger.warn(`[calculateTaxes] FiscalBrain falhou: ${err instanceof Error ? err.message : err} — usando TaxEngine`);
        }
      }

      // ── TaxEngine como fallback para itens ainda sem decisão IA ──
      const itensSemIa = nfe.items.filter(i => !latestByItem.get(i.id)?.autoAplicado);
      if (itensSemIa.length > 0) {
        const taxItems = itensSemIa.map((item) => ({
          productId: item.productId || undefined,
          description: item.description,
          ncmCode: item.ncmCode,
          cfopCode: item.cfopCode,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          unit: item.unit,
        }));
        const taxResults = await this.taxEngine.calculateTax(
          nfe.companyId, taxItems, nfe.operation,
          itensSemIa[0]?.cfopCode || '', nfe.dataEmissao || new Date(),
        );
        for (let i = 0; i < itensSemIa.length; i++) {
          const item = itensSemIa[i];
          const tax = taxResults[i];
          await this.prisma.nFeItem.update({
            where: { id: item.id },
            data: {
              cstIcms: tax.cstIcms, bcIcms: tax.bcIcms, aliqIcms: tax.aliqIcms, valorIcms: tax.valorIcms,
              bcIcmsSt: tax.bcIcmsSt, aliqIcmsSt: tax.aliqIcmsSt, valorIcmsSt: tax.valorIcmsSt,
              cstIpi: tax.cstIpi, bcIpi: tax.bcIpi, aliqIpi: tax.aliqIpi, valorIpi: tax.valorIpi,
              cstPis: tax.cstPis, bcPis: tax.bcPis, aliqPis: tax.aliqPis, valorPis: tax.valorPis,
              cstCofins: tax.cstCofins, bcCofins: tax.bcCofins, aliqCofins: tax.aliqCofins, valorCofins: tax.valorCofins,
              bcIbs: tax.bcIbs, aliqIbs: tax.aliqIbs, valorIbs: tax.valorIbs,
              bcCbs: tax.bcCbs, aliqCbs: tax.aliqCbs, valorCbs: tax.valorCbs,
              bcIs: tax.bcIs, aliqIs: tax.aliqIs, valorIs: tax.valorIs,
            },
          });
        }
      }
    }

    // ── Recalcula totais somando todos os itens (IA + fallback) ─────────────
    const allItems = await this.prisma.nFeItem.findMany({ where: { nfeId: id } });
    const taxResults = allItems.map(item => ({
      valorIcms:   Number(item.valorIcms   ?? 0),
      valorIcmsSt: Number(item.valorIcmsSt ?? 0),
      valorIpi:    Number(item.valorIpi    ?? 0),
      valorPis:    Number(item.valorPis    ?? 0),
      valorCofins: Number(item.valorCofins ?? 0),
      valorIbs:    Number(item.valorIbs    ?? 0),
      valorCbs:    Number(item.valorCbs    ?? 0),
      valorIs:     Number(item.valorIs     ?? 0),
    }));

    // Acumula totais dos itens já atualizados (IA ou TaxEngine)
    const totals = taxResults.reduce(
      (acc, t) => ({
        valorIcms:   acc.valorIcms   + t.valorIcms,
        valorIcmsSt: acc.valorIcmsSt + t.valorIcmsSt,
        valorIpi:    acc.valorIpi    + t.valorIpi,
        valorPis:    acc.valorPis    + t.valorPis,
        valorCofins: acc.valorCofins + t.valorCofins,
        valorIbs:    acc.valorIbs    + t.valorIbs,
        valorCbs:    acc.valorCbs    + t.valorCbs,
        valorIs:     acc.valorIs     + t.valorIs,
      }),
      { valorIcms: 0, valorIcmsSt: 0, valorIpi: 0, valorPis: 0,
        valorCofins: 0, valorIbs: 0, valorCbs: 0, valorIs: 0 },
    );

    // Calcular DIFAL se operação interestadual para consumidor final
    let difalData: {
      valorDifal: number;
      valorDifalDestino: number;
      valorDifalOrigem: number;
      valorFcp: number;
      aliqInterestadual: number;
      aliqInternaDestino: number;
      ufDestino?: string;
    } = {
      valorDifal: 0, valorDifalDestino: 0, valorDifalOrigem: 0,
      valorFcp: 0, aliqInterestadual: 0, aliqInternaDestino: 0,
    };

    const person = await this.prisma.person.findUnique({
      where: { id: nfe.personId },
      include: { addresses: { take: 1 } },
    });
    const company = await this.prisma.company.findUnique({ where: { id: nfe.companyId } });
    const destAddr = person?.addresses?.[0];
    const ufDestino = destAddr?.uf || '';
    const ufOrigem = company?.uf || '';

    // DIFAL aplica em vendas para consumidor final interestadual
    const isSaida = nfe.operation === 'VENDA' || nfe.operation === 'REMESSA';
    const isInterestadual = ufOrigem && ufDestino && ufOrigem !== ufDestino;

    if (isSaida && isInterestadual && nfe.valorProdutos > 0) {
      // Alíquota interestadual: 4% importados, 7% para N/NE/CO/ES, 12% demais
      const nordesteCo = ['AC','AL','AP','AM','BA','CE','GO','MA','MT','MS','PA','PB','PE','PI','RN','RO','RR','SE','TO'];
      const aliqInterestadual = nordesteCo.includes(ufDestino) ? 7 : 12;

      const difal = await this.difalService.calcularDifal({
        valorBc: nfe.valorProdutos + totals.valorIpi,
        aliqInterestadual,
        ufOrigem,
        ufDestino,
        dataOperacao: nfe.dataEmissao || new Date(),
      });

      difalData = { ...difal, ufDestino, aliqInterestadual };
    }

    // Update NF-e totals
    const valorTotal =
      nfe.valorProdutos +
      nfe.valorFrete +
      nfe.valorSeguro +
      nfe.valorOutros -
      nfe.valorDesconto +
      totals.valorIpi +
      totals.valorIcmsSt;

    const updated = await this.prisma.nFeDocument.update({
      where: { id },
      data: {
        valorIcms: this.round(totals.valorIcms),
        valorIcmsSt: this.round(totals.valorIcmsSt),
        valorIpi: this.round(totals.valorIpi),
        valorPis: this.round(totals.valorPis),
        valorCofins: this.round(totals.valorCofins),
        valorIbs: this.round(totals.valorIbs),
        valorCbs: this.round(totals.valorCbs),
        valorIs: this.round(totals.valorIs),
        valorTotal: this.round(valorTotal),
        // DIFAL
        valorDifal: this.round(difalData.valorDifal),
        valorDifalDestino: this.round(difalData.valorDifalDestino),
        valorDifalOrigem: this.round(difalData.valorDifalOrigem),
        valorFcp: this.round(difalData.valorFcp),
        ufDestino: difalData.ufDestino || null,
        aliqInterestadual: difalData.aliqInterestadual || null,
        aliqInternaDestino: difalData.aliqInternaDestino || null,
      },
      include: {
        person: {
          select: { id: true, razaoSocial: true, cpfCnpj: true },
        },
        items: { orderBy: { itemNumber: 'asc' } },
      },
    });

    return updated;
  }

  /**
   * Validate NF-e required fields before transmission.
   */
  async validate(id: string) {
    const nfe = await this.prisma.nFeDocument.findUnique({
      where: { id },
      include: { items: true, person: true },
    });

    if (!nfe) {
      throw new NotFoundException(`NF-e ${id} not found`);
    }

    const errors: string[] = [];

    if (!nfe.personId) errors.push('Destinatario is required.');
    if (!nfe.naturezaOperacao) errors.push('Natureza da Operacao is required.');
    if (!nfe.dataEmissao) errors.push('Data de Emissao is required.');
    if (!nfe.items || nfe.items.length === 0)
      errors.push('At least one item is required.');

    for (const item of nfe.items) {
      if (!item.ncmCode)
        errors.push(`Item ${item.itemNumber}: NCM code is required.`);
      if (!item.cfopCode)
        errors.push(`Item ${item.itemNumber}: CFOP code is required.`);
      if (item.quantity <= 0)
        errors.push(`Item ${item.itemNumber}: quantity must be > 0.`);
      if (item.unitPrice < 0)
        errors.push(`Item ${item.itemNumber}: unit price must be >= 0.`);
    }

    if (nfe.person) {
      if (!nfe.person.cpfCnpj) errors.push('Person CPF/CNPJ is required.');
    }

    if (errors.length > 0) {
      throw new BadRequestException({
        message: 'NF-e validation failed',
        errors,
      });
    }

    // Move to VALIDADA
    if (nfe.status === 'RASCUNHO') {
      return this.prisma.nFeDocument.update({
        where: { id },
        data: { status: 'VALIDADA' as any },
        include: {
          person: { select: { id: true, razaoSocial: true, cpfCnpj: true } },
          items: { orderBy: { itemNumber: 'asc' } },
        },
      });
    }

    return nfe;
  }

  /**
   * Real transmission: builds NF-e XML, signs it with A1 certificate, and
   * sends to SEFAZ. Updates status to AUTORIZADA on success or REJEITADA on failure.
   */
  async transmit(id: string) {
    const nfe = await this.prisma.nFeDocument.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!nfe) {
      throw new NotFoundException(`NF-e ${id} not found`);
    }

    if (nfe.status !== 'VALIDADA' && nfe.status !== 'RASCUNHO') {
      throw new BadRequestException(
        `Cannot transmit NF-e with status ${nfe.status}. Expected VALIDADA or RASCUNHO.`,
      );
    }

    // If RASCUNHO, validate first
    if (nfe.status === 'RASCUNHO') {
      await this.validate(id);
    }

    // Auto-generate numero per serie
    const company = await this.prisma.company.findUnique({
      where: { id: nfe.companyId },
    });

    const numero = company?.proximoNumeroNfe ?? 1;

    // Increment company numero
    await this.prisma.company.update({
      where: { id: nfe.companyId },
      data: { proximoNumeroNfe: numero + 1 },
    });

    // Persist numero and serie before building XML
    await this.prisma.nFeDocument.update({
      where: { id },
      data: { numero, serie: company?.serieNfe ?? 1 },
    });

    // Get ambiente for NF-e from company (1=produção, 2=homologação)
    const ambienteNfe = (company?.ambienteNfe ?? 2) === 1 ? '1' : '2';
    const uf = company?.uf ?? 'SP';

    // Build XML
    const { xml, chaveAcesso } = await this.xmlBuilder.buildXml(id, ambienteNfe);

    // Sign XML with A1 certificate
    const { pfx, senha } = await this.certificadoService.getCertificateForSigning(nfe.companyId);
    const xmlAssinado = this.signer.signXml(xml, pfx, senha);

    // Transmit to SEFAZ
    const sefazResponse = await this.sefazClient.autorizarNfe(nfe.companyId, uf, xmlAssinado, ambienteNfe);

    if (!sefazResponse.success) {
      // Update status to DENEGADA (rejected by SEFAZ)
      await this.prisma.nFeDocument.update({
        where: { id },
        data: {
          status: 'DENEGADA' as any,
          motivoCancelamento: `${sefazResponse.cStat} - ${sefazResponse.xMotivo}`,
        },
      });
      throw new BadRequestException(
        `SEFAZ rejeitou a NF-e: [${sefazResponse.cStat}] ${sefazResponse.xMotivo}`,
      );
    }

    const updated = await this.prisma.nFeDocument.update({
      where: { id },
      data: {
        status: 'AUTORIZADA' as any,
        chaveAcesso,
        protocoloAutorizacao: sefazResponse.protocolNumber ?? null,
        dataAutorizacao: new Date(),
        xmlRetorno: sefazResponse.xml ?? null,
      },
      include: {
        person: { select: { id: true, razaoSocial: true, cpfCnpj: true } },
        items: { orderBy: { itemNumber: 'asc' } },
      },
    });

    if (nfe.type === 'SAIDA') {
      this.integration.onNfeAuthorizedSaida(id, nfe.companyId, 'system').catch(err => console.error('Integration error:', err));
    } else {
      this.integration.onNfeAuthorizedEntrada(id, nfe.companyId, 'system').catch(err => console.error('Integration error:', err));
    }

    // Auto-faturar the linked SaleOrder when NF-e is authorized
    if (nfe.saleOrderId) {
      this.prisma.saleOrder.update({
        where: { id: nfe.saleOrderId },
        data: { status: 'FATURADO' as any, dataFaturamento: new Date() },
      }).catch(err => console.error('SaleOrder faturamento error:', err));
    }

    return updated;
  }

  /**
   * Cancel an authorized NF-e with a reason.
   */
  async cancel(id: string, motivo: string) {
    const nfe = await this.prisma.nFeDocument.findUnique({
      where: { id },
    });

    if (!nfe) {
      throw new NotFoundException(`NF-e ${id} not found`);
    }

    if (nfe.status !== 'AUTORIZADA') {
      throw new BadRequestException(
        `Cannot cancel NF-e with status ${nfe.status}. Expected AUTORIZADA.`,
      );
    }

    if (!motivo || motivo.length < 15) {
      throw new BadRequestException(
        'Cancellation reason must be at least 15 characters.',
      );
    }

    return this.prisma.nFeDocument.update({
      where: { id },
      data: {
        status: 'CANCELADA' as any,
        motivoCancelamento: motivo,
      },
      include: {
        person: { select: { id: true, razaoSocial: true, cpfCnpj: true } },
        items: { orderBy: { itemNumber: 'asc' } },
      },
    });
  }

  /**
   * Get aggregated stats: group by status, totals by period.
   */
  async getStats(
    companyId: string,
    query: { startDate?: string; endDate?: string },
  ) {
    const where: any = { companyId };

    if (query.startDate || query.endDate) {
      where.dataEmissao = {};
      if (query.startDate) where.dataEmissao.gte = new Date(query.startDate);
      if (query.endDate) where.dataEmissao.lte = new Date(query.endDate);
    }

    const [byStatus, byType, totals] = await Promise.all([
      this.prisma.nFeDocument.groupBy({
        by: ['status'],
        where,
        _count: { id: true },
      }),
      this.prisma.nFeDocument.groupBy({
        by: ['type'],
        where,
        _count: { id: true },
        _sum: { valorTotal: true },
      }),
      this.prisma.nFeDocument.aggregate({
        where: { ...where, status: 'AUTORIZADA' },
        _sum: {
          valorTotal: true,
          valorIcms: true,
          valorIpi: true,
          valorPis: true,
          valorCofins: true,
          valorIbs: true,
          valorCbs: true,
          valorIs: true,
        },
        _count: { id: true },
      }),
    ]);

    return {
      byStatus: byStatus.map((s) => ({
        status: s.status,
        count: s._count.id,
      })),
      byType: byType.map((t) => ({
        type: t.type,
        count: t._count.id,
        valorTotal: t._sum.valorTotal || 0,
      })),
      totals: {
        count: totals._count.id,
        valorTotal: totals._sum.valorTotal || 0,
        valorIcms: totals._sum.valorIcms || 0,
        valorIpi: totals._sum.valorIpi || 0,
        valorPis: totals._sum.valorPis || 0,
        valorCofins: totals._sum.valorCofins || 0,
        valorIbs: totals._sum.valorIbs || 0,
        valorCbs: totals._sum.valorCbs || 0,
        valorIs: totals._sum.valorIs || 0,
      },
    };
  }

  /**
   * Emitir Carta de Correção Eletrônica (CC-e).
   * Só pode ser emitida para NF-e AUTORIZADA, com motivo mínimo de 15 caracteres.
   * Limite: 20 CC-e por NF-e (norma SEFAZ).
   * Tenta transmitir ao SEFAZ se a empresa possuir certificado digital configurado;
   * caso contrário registra localmente (modo offline/sem certificado).
   */
  async emitirCce(id: string, descricaoCorrecao: string) {
    const nfe = await this.prisma.nFeDocument.findUnique({ where: { id } });

    if (!nfe) throw new NotFoundException(`NF-e ${id} not found`);

    if (nfe.status !== 'AUTORIZADA') {
      throw new BadRequestException(
        'CC-e só pode ser emitida para NF-e com status AUTORIZADA.',
      );
    }

    if (!descricaoCorrecao || descricaoCorrecao.length < 15) {
      throw new BadRequestException(
        'A descrição da correção deve ter no mínimo 15 caracteres.',
      );
    }

    if (descricaoCorrecao.length > 1000) {
      throw new BadRequestException(
        'A descrição da correção não pode ultrapassar 1000 caracteres.',
      );
    }

    if (!nfe.chaveAcesso) {
      throw new BadRequestException(
        'NF-e não possui chave de acesso. Verifique se foi autorizada corretamente.',
      );
    }

    const cceNumero = (nfe.cceNumero || 0) + 1;

    if (cceNumero > 20) {
      throw new BadRequestException(
        'Limite de 20 Cartas de Correção por NF-e atingido (norma SEFAZ).',
      );
    }

    // Busca configuração da empresa para obter UF e ambiente
    const company = await this.prisma.company.findUnique({
      where: { id: nfe.companyId },
      select: { uf: true, ambienteNfe: true, certDigitalConteudo: true },
    });

    const uf = company?.uf ?? 'SP';
    const ambienteNfe = (company?.ambienteNfe ?? 2) === 1 ? '1' : '2';
    const temCertificado = !!(company as any)?.certDigitalConteudo;

    // Tentativa de transmissão ao SEFAZ (somente se certificado configurado)
    let sefazProtocolo: string | undefined;
    let sefazXml: string | undefined;
    let sefazStatus: 'TRANSMITIDA' | 'LOCAL' = 'LOCAL';

    if (temCertificado) {
      try {
        const sefazResult = await this.sefazClient.emitirCce(
          nfe.companyId,
          uf,
          nfe.chaveAcesso,
          cceNumero,
          descricaoCorrecao,
          ambienteNfe,
        );
        if (sefazResult.success) {
          sefazProtocolo = sefazResult.protocolNumber;
          sefazXml = sefazResult.chaveAcesso; // xml retornado encapsulado
          sefazStatus = 'TRANSMITIDA';
        }
      } catch {
        // Falha na transmissão → registra localmente sem lançar exceção
        sefazStatus = 'LOCAL';
      }
    }

    const updated = await this.prisma.nFeDocument.update({
      where: { id },
      data: {
        cceNumero,
        cceDataEvento: new Date(),
        cceDescricao: descricaoCorrecao,
        ...(sefazProtocolo ? { cceProtocolo: sefazProtocolo } : {}),
        ...(sefazXml      ? { cceXml:       sefazXml      } : {}),
      },
      include: {
        person: { select: { id: true, razaoSocial: true, cpfCnpj: true } },
        items: { orderBy: { itemNumber: 'asc' } },
      },
    });

    return {
      ...updated,
      cce: {
        numero: cceNumero,
        dataEvento: updated.cceDataEvento,
        descricao: updated.cceDescricao,
        protocolo: sefazProtocolo ?? null,
        status: sefazStatus === 'TRANSMITIDA' ? 'AUTORIZADA' : 'REGISTRADA',
        observacao: sefazStatus === 'TRANSMITIDA'
          ? `CC-e transmitida e autorizada pelo SEFAZ. Protocolo: ${sefazProtocolo}`
          : 'CC-e registrada localmente. Configure o certificado digital para transmissão ao SEFAZ.',
      },
    };
  }

  /**
   * Inutilizar faixa de numeração de NF-e junto à SEFAZ.
   * Necessário quando números foram pulados por falha de sistema ou erro operacional.
   */
  async inutilizar(
    companyId: string,
    data: {
      serie: number;
      numeroInicial: number;
      numeroFinal: number;
      justificativa: string;
    },
  ) {
    if (!data.justificativa || data.justificativa.length < 15) {
      throw new BadRequestException('Justificativa deve ter no mínimo 15 caracteres.');
    }
    if (data.numeroFinal < data.numeroInicial) {
      throw new BadRequestException('Número final deve ser maior ou igual ao número inicial.');
    }

    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new NotFoundException('Empresa não encontrada.');

    const uf = company.uf ?? 'SP';

    const result = await this.sefazClient.inutilizarNumeracao(
      companyId,
      uf,
      data.serie,
      data.numeroInicial,
      data.numeroFinal,
      data.justificativa,
    );

    if (!result.success) {
      throw new BadRequestException(
        `SEFAZ recusou inutilização: [${result.cStat}] ${result.xMotivo}`,
      );
    }

    return {
      ok: true,
      protocolo: result.protocolNumber,
      cStat: result.cStat,
      xMotivo: result.xMotivo,
      serie: data.serie,
      numeroInicial: data.numeroInicial,
      numeroFinal: data.numeroFinal,
    };
  }

  /**
   * Generate a mock 44-digit chaveAcesso for NF-e.
   */
  private generateChaveAcesso(
    uf: string,
    dataEmissao: Date,
    cnpj: string,
    modelo: number,
    serie: number,
    numero: number,
  ): string {
    const ufCode = uf.length === 2 ? this.ufToCode(uf) : uf.padStart(2, '0');
    const aamm =
      dataEmissao.getFullYear().toString().slice(2) +
      (dataEmissao.getMonth() + 1).toString().padStart(2, '0');
    const cnpjPad = cnpj.padStart(14, '0');
    const mod = modelo.toString().padStart(2, '0');
    const ser = serie.toString().padStart(3, '0');
    const num = numero.toString().padStart(9, '0');
    const tpEmis = '1'; // Emissao normal
    const cNf = Math.floor(Math.random() * 100000000)
      .toString()
      .padStart(8, '0');

    const chaveBase = `${ufCode}${aamm}${cnpjPad}${mod}${ser}${num}${tpEmis}${cNf}`;

    // Calculate check digit (mod 11)
    const dv = this.calculateMod11(chaveBase);

    return `${chaveBase}${dv}`;
  }

  private calculateMod11(chave: string): string {
    const weights = [2, 3, 4, 5, 6, 7, 8, 9];
    let sum = 0;
    const digits = chave.split('').reverse();

    for (let i = 0; i < digits.length; i++) {
      sum += parseInt(digits[i], 10) * weights[i % weights.length];
    }

    const remainder = sum % 11;
    const dv = remainder < 2 ? 0 : 11 - remainder;
    return dv.toString();
  }

  private ufToCode(uf: string): string {
    const codes: Record<string, string> = {
      AC: '12', AL: '27', AP: '16', AM: '13', BA: '29', CE: '23',
      DF: '53', ES: '32', GO: '52', MA: '21', MT: '51', MS: '50',
      MG: '31', PA: '15', PB: '25', PR: '41', PE: '26', PI: '22',
      RJ: '33', RN: '24', RS: '43', RO: '11', RR: '14', SC: '42',
      SP: '35', SE: '28', TO: '17',
    };
    return codes[uf.toUpperCase()] || '35';
  }

  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }

  /**
   * Escrituração fiscal de NF-e de saída:
   * - Lança livro fiscal de saídas (ICMS/IPI/PIS/COFINS débito)
   * - Gera Contas a Receber
   * - Lançamento contábil
   * - Status → ESCRITURADA
   */
  async escriturarSaida(nfeId: string, companyId: string, userId: string) {
    // ── Carrega NF-e com itens + produtos (A2: item a item) ──────────────────
    const nfe = await this.prisma.nFeDocument.findUnique({
      where: { id: nfeId },
      include: {
        items: { include: { product: true }, orderBy: { itemNumber: 'asc' } },
        person: { include: { addresses: { take: 1 } } },
      },
    });
    if (!nfe) throw new NotFoundException(`NF-e ${nfeId} não encontrada`);
    if ((nfe as any).type !== 'SAIDA') throw new BadRequestException('Escrituração de saída só se aplica a NF-e de saída.');
    if (!['AUTORIZADA'].includes(nfe.status as string)) throw new BadRequestException('NF-e deve estar AUTORIZADA para ser escriturada.');

    // ── A3: Regime tributário da empresa ─────────────────────────────────────
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { taxRegime: true, uf: true },
    });
    const taxRegimeEmpresa = (company as any)?.taxRegime ?? 'LUCRO_REAL';
    const ufEmpresa = (company as any)?.uf ?? '';
    const ufCliente = (nfe as any).person?.addresses?.[0]?.uf ?? '';

    // ── A5: tipoCliente derivado dos dados da pessoa ──────────────────────────
    const person = (nfe as any).person;
    let tipoCliente = 'CONTRIBUINTE';
    if (person) {
      if (person.type === 'PF' || !person.rgIe) tipoCliente = 'NAO_CONTRIBUINTE';
      else if (person.tipoFornecedor === 'SIMPLES_NACIONAL' || person.tipoFornecedor === 'MEI') tipoCliente = 'CONTRIBUINTE_SIMPLES';
    }

    const valorTotal  = Number((nfe as any).valorTotal ?? 0);
    const dataEmissao = (nfe as any).dataEmissao ?? new Date();
    const periodoRef  = `${dataEmissao.getFullYear()}-${String(dataEmissao.getMonth()+1).padStart(2,'0')}`;
    const natOp       = (nfe as any).naturezaOperacao ?? 'Venda';
    const nfeNumero   = (nfe as any).numero ?? nfeId.slice(-6);

    // ── A2: Motor por item ────────────────────────────────────────────────────
    interface ItemFiscalSaida {
      valorTotal:    number;
      valorIcms:     number;
      valorIpi:      number;
      valorPis:      number;
      valorCofins:   number;
      cfop:          string;
      cstIcms:       string;
      debitaIcms:    boolean;
      debitaIpi:     boolean;
      debitaPisCof:  boolean;
    }

    const itensFiscais: ItemFiscalSaida[] = [];

    for (const item of (nfe as any).items ?? []) {
      // Destinação: item → produto → fallback PRODUTO_REVENDA (A4)
      const destinacao = item.destinacaoFiscal
                      ?? item.product?.destinacaoFiscal
                      ?? 'PRODUTO_REVENDA';

      // ST: detecta pelo CST do item
      const cstItem = item.cstIcms ?? '';
      const temST   = cstItem === '010' || cstItem === '10' || cstItem === '070';

      const regra = await this.operacoesFiscais.determinar(companyId, {
        tipo: 'SAIDA',
        destinacao,
        tipoCliente,
        ufCliente,
        ufEmpresa,
        temST,
        taxRegimeEmpresa,
      });

      itensFiscais.push({
        valorTotal:   Number(item.totalPrice ?? 0),
        valorIcms:    Number(item.valorIcms  ?? 0),
        valorIpi:     Number(item.valorIpi   ?? 0),
        valorPis:     Number(item.valorPis   ?? 0),
        valorCofins:  Number(item.valorCofins ?? 0),
        cfop:         regra?.cfop   ?? item.cfopCode ?? '5102',
        cstIcms:      regra?.cstIcms ?? cstItem,
        debitaIcms:   regra ? regra.debitaIcms      : Number(item.valorIcms  ?? 0) > 0,
        debitaIpi:    regra ? regra.debitaIpi       : Number(item.valorIpi   ?? 0) > 0,
        debitaPisCof: regra ? regra.debitaPisCofins : taxRegimeEmpresa === 'LUCRO_REAL',
      });
    }

    // ── Totais agregados por tipo de imposto ──────────────────────────────────
    const totalBase      = itensFiscais.reduce((s, i) => s + i.valorTotal, 0);
    const totalIcmsDebito   = itensFiscais.filter(i => i.debitaIcms).reduce((s, i) => s + i.valorIcms, 0);
    const totalIpiDebito    = itensFiscais.filter(i => i.debitaIpi).reduce((s, i) => s + i.valorIpi,   0);
    const totalPisDebito    = itensFiscais.filter(i => i.debitaPisCof).reduce((s, i) => s + i.valorPis,    0);
    const totalCofinsDebito = itensFiscais.filter(i => i.debitaPisCof).reduce((s, i) => s + i.valorCofins, 0);

    // CFOP mais frequente por valor (cabeçalho do livro)
    const cfopFreq = itensFiscais.reduce((acc, i) => {
      acc[i.cfop] = (acc[i.cfop] ?? 0) + i.valorTotal;
      return acc;
    }, {} as Record<string, number>);
    const cfopPrincipal = Object.entries(cfopFreq).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '5102';

    const temDebitoIcms    = totalIcmsDebito    > 0;
    const temDebitoIpi     = totalIpiDebito     > 0;
    const temDebitoPisCof  = totalPisDebito     > 0 || totalCofinsDebito > 0;

    return this.prisma.$transaction(async (tx) => {
      const obs = `NF-e ${nfeNumero} — ${person?.razaoSocial ?? ''}`;
      const base: any = {
        companyId,
        type: 'DEBITO',
        bookType: 'SAIDA',
        dataLancamento: dataEmissao,
        periodoReferencia: periodoRef,
        cfopCode: cfopPrincipal,
        naturezaOperacao: natOp,
        valorContabil: valorTotal,
        baseCalculo: totalBase || valorTotal,
        observations: obs,
      };

      const fiscalCreates: Promise<any>[] = [];

      // ICMS débito
      if (temDebitoIcms) fiscalCreates.push(
        tx.fiscalEntry.create({ data: { ...base, taxType: 'ICMS',
          aliquota: base.baseCalculo > 0 ? (totalIcmsDebito / base.baseCalculo) * 100 : 0,
          valorImposto: totalIcmsDebito } as any }));

      // IPI débito
      if (temDebitoIpi) fiscalCreates.push(
        tx.fiscalEntry.create({ data: { ...base, taxType: 'IPI',
          aliquota: base.baseCalculo > 0 ? (totalIpiDebito / base.baseCalculo) * 100 : 0,
          valorImposto: totalIpiDebito } as any }));

      // PIS débito
      if (totalPisDebito > 0) fiscalCreates.push(
        tx.fiscalEntry.create({ data: { ...base, taxType: 'PIS',
          aliquota: taxRegimeEmpresa === 'LUCRO_REAL' ? 1.65 : 0.65,
          valorImposto: totalPisDebito } as any }));

      // COFINS débito
      if (totalCofinsDebito > 0) fiscalCreates.push(
        tx.fiscalEntry.create({ data: { ...base, taxType: 'COFINS',
          aliquota: taxRegimeEmpresa === 'LUCRO_REAL' ? 7.6 : 3.0,
          valorImposto: totalCofinsDebito } as any }));

      // Registro mínimo para livro de saídas (isento/SN)
      if (!temDebitoIcms && !temDebitoIpi && !temDebitoPisCof) fiscalCreates.push(
        tx.fiscalEntry.create({ data: { ...base, taxType: 'ICMS', aliquota: 0, valorImposto: 0,
          observations: `${obs} — sem débito (isento/SN)` } as any }));

      await Promise.all(fiscalCreates);

      // ── Contas a Receber ────────────────────────────────────────────────────
      let financialMovementId: string | null = null;
      if ((nfe as any).personId) {
        const dataVencimento = new Date(dataEmissao.getTime() + 30 * 24 * 60 * 60 * 1000);
        const fm = await tx.financialMovement.create({
          data: {
            companyId,
            type: 'RECEIVABLE' as any,
            personId: (nfe as any).personId,
            description: `NF-e ${nfeNumero} — ${natOp}`,
            numero: `NFE-${nfeNumero}`,
            valor: valorTotal,
            dataEmissao,
            dataVencimento,
            status: 'PENDENTE' as any,
            observations: `NF-e ${nfeNumero} — Chave: ${(nfe as any).chaveAcesso ?? ''}`,
          },
        });
        financialMovementId = fm.id;
      }

      // ── Lançamento contábil ─────────────────────────────────────────────────
      const [ctaReceita, ctaCliente, ctaImpostos] = await Promise.all([
        tx.chartOfAccount.findFirst({ where: { companyId, code: { startsWith: '3' }, nature: 'CREDORA'  }, select: { id: true } }),
        tx.chartOfAccount.findFirst({ where: { companyId, code: { startsWith: '1' }, nature: 'DEVEDORA' }, select: { id: true } }),
        tx.chartOfAccount.findFirst({ where: { companyId, code: { startsWith: '2' }, nature: 'CREDORA'  }, select: { id: true } }),
      ]);

      const journalLines: any[] = [
        { type: 'DEVEDORA', value: valorTotal,       description: `A receber — NF-e ${nfeNumero}`, accountId: ctaCliente?.id },
        { type: 'CREDORA',  value: valorTotal,       description: `Receita — ${natOp}`,            accountId: ctaReceita?.id },
      ];
      if (temDebitoIcms && totalIcmsDebito > 0) {
        journalLines.push({ type: 'DEVEDORA', value: totalIcmsDebito, description: 'ICMS s/ venda',    accountId: ctaImpostos?.id });
        journalLines.push({ type: 'CREDORA',  value: totalIcmsDebito, description: 'ICMS a recolher',  accountId: ctaImpostos?.id });
      }

      await tx.journalEntry.create({
        data: {
          companyId,
          numero: `NFE-${nfeNumero}`,
          date: dataEmissao,
          description: `NF-e ${nfeNumero} — ${natOp} — ${person?.razaoSocial ?? ''}`,
          totalValue: valorTotal,
          userId,
          items: { create: journalLines.filter(l => l.accountId) },
        },
      });

      // Status → ESCRITURADA
      await tx.nFeDocument.update({ where: { id: nfeId }, data: { status: 'ESCRITURADA' as any } });

      return {
        itens: itensFiscais.length,
        fiscalEntries: fiscalCreates.length,
        financialMovementId,
        message: `NF-e de saída escriturada com sucesso — ${itensFiscais.length} item(ns) processado(s) pelo motor fiscal.`,
      };
    });
  }
}
