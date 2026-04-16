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
import { SefazClientService } from '../government/sefaz/sefaz-client.service';
import { CertificadoService } from '@/modules/core/company/certificado.service';
import { CreateNfeDto } from './dto/create-nfe.dto';
import { UpdateNfeDto } from './dto/update-nfe.dto';

@Injectable()
export class NfeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly integration: IntegrationService,
    private readonly taxEngine: TaxEngineService,
    private readonly xmlBuilder: NfeXmlBuilderService,
    private readonly signer: NfeSignerService,
    private readonly difalService: DifalService,
    private readonly sefazClient: SefazClientService,
    private readonly certificadoService: CertificadoService,
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
   * Calculate taxes for all items on the NF-e using the TaxEngine.
   */
  async calculateTaxes(id: string) {
    const nfe = await this.prisma.nFeDocument.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!nfe) {
      throw new NotFoundException(`NF-e ${id} not found`);
    }

    const taxItems = nfe.items.map((item) => ({
      productId: item.productId || undefined,
      description: item.description,
      ncmCode: item.ncmCode,
      cfopCode: item.cfopCode,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      unit: item.unit,
    }));

    const taxResults = await this.taxEngine.calculateTax(
      nfe.companyId,
      taxItems,
      nfe.operation,
      nfe.items[0]?.cfopCode || '',
      nfe.dataEmissao || new Date(),
    );

    // Update each item with calculated taxes
    const totals = {
      valorIcms: 0,
      valorIcmsSt: 0,
      valorIpi: 0,
      valorPis: 0,
      valorCofins: 0,
      valorIbs: 0,
      valorCbs: 0,
      valorIs: 0,
    };

    for (let i = 0; i < nfe.items.length; i++) {
      const item = nfe.items[i];
      const tax = taxResults[i];

      await this.prisma.nFeItem.update({
        where: { id: item.id },
        data: {
          cstIcms: tax.cstIcms,
          bcIcms: tax.bcIcms,
          aliqIcms: tax.aliqIcms,
          valorIcms: tax.valorIcms,
          bcIcmsSt: tax.bcIcmsSt,
          aliqIcmsSt: tax.aliqIcmsSt,
          valorIcmsSt: tax.valorIcmsSt,
          cstIpi: tax.cstIpi,
          bcIpi: tax.bcIpi,
          aliqIpi: tax.aliqIpi,
          valorIpi: tax.valorIpi,
          cstPis: tax.cstPis,
          bcPis: tax.bcPis,
          aliqPis: tax.aliqPis,
          valorPis: tax.valorPis,
          cstCofins: tax.cstCofins,
          bcCofins: tax.bcCofins,
          aliqCofins: tax.aliqCofins,
          valorCofins: tax.valorCofins,
          bcIbs: tax.bcIbs,
          aliqIbs: tax.aliqIbs,
          valorIbs: tax.valorIbs,
          bcCbs: tax.bcCbs,
          aliqCbs: tax.aliqCbs,
          valorCbs: tax.valorCbs,
          bcIs: tax.bcIs,
          aliqIs: tax.aliqIs,
          valorIs: tax.valorIs,
        },
      });

      totals.valorIcms += tax.valorIcms;
      totals.valorIcmsSt += tax.valorIcmsSt;
      totals.valorIpi += tax.valorIpi;
      totals.valorPis += tax.valorPis;
      totals.valorCofins += tax.valorCofins;
      totals.valorIbs += tax.valorIbs;
      totals.valorCbs += tax.valorCbs;
      totals.valorIs += tax.valorIs;
    }

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
    const sefazResponse = await this.sefazClient.autorizarNfe(nfe.companyId, uf, xmlAssinado);

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

    const cceNumero = (nfe.cceNumero || 0) + 1;

    if (cceNumero > 20) {
      throw new BadRequestException(
        'Limite de 20 Cartas de Correção por NF-e atingido (norma SEFAZ).',
      );
    }

    // Em produção: aqui seria feita a transmissão do XML CC-e para a SEFAZ
    // e armazenado o protocolo de autorização retornado.
    // Por hora gravamos localmente e geramos número sequencial.
    const updated = await this.prisma.nFeDocument.update({
      where: { id },
      data: {
        cceNumero,
        cceDataEvento: new Date(),
        cceDescricao: descricaoCorrecao,
        // cceProtocolo: seria preenchido após retorno SEFAZ
        // cceXml: seria o XML retornado pela SEFAZ
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
        status: 'REGISTRADA',
        observacao: 'CC-e registrada localmente. Para envio à SEFAZ, configure o certificado digital.',
      },
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
}
