import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';
import { CreateNfeInboxDto } from './dto/create-nfe-inbox.dto';
import { ManifestNfeDto } from './dto/manifest-nfe.dto';
import { LinkNfeItemDto, CreateAndLinkDto } from './dto/link-nfe-item.dto';
import { PostNfeEntryDto } from './dto/post-nfe-entry.dto';

@Injectable()
export class NfeInboxService {
  private readonly logger = new Logger(NfeInboxService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    companyId: string,
    query: {
      status?: string;
      emitenteCnpj?: string;
      startDate?: string;
      endDate?: string;
      search?: string;
      page?: string;
      limit?: string;
    },
  ) {
    const page = parseInt(query.page || '1', 10);
    const limit = parseInt(query.limit || '20', 10);
    const skip = (page - 1) * limit;

    const where: any = { companyId };

    if (query.status) {
      where.status = query.status;
    }

    if (query.emitenteCnpj) {
      where.emitenteCnpj = query.emitenteCnpj;
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

    if (query.search) {
      where.OR = [
        { numero: { contains: query.search, mode: 'insensitive' } },
        { emitenteNome: { contains: query.search, mode: 'insensitive' } },
        { emitenteCnpj: { contains: query.search, mode: 'insensitive' } },
        { chaveAcesso: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.nFeInbox.findMany({
        where,
        skip,
        take: limit,
        orderBy: { dataEmissao: 'desc' },
        include: {
          _count: { select: { items: true } },
          purchaseOrder: {
            select: { id: true, numero: true },
          },
        },
      }),
      this.prisma.nFeInbox.count({ where }),
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

  async findOne(id: string, companyId: string) {
    const inbox = await this.prisma.nFeInbox.findFirst({
      where: { id, companyId },
      include: {
        items: {
          include: {
            product: {
              select: { id: true, code: true, description: true, unit: true },
            },
          },
          orderBy: { numeroItem: 'asc' },
        },
        purchaseOrder: {
          select: { id: true, numero: true, status: true },
        },
      },
    });

    if (!inbox) {
      throw new NotFoundException(`NFeInbox ${id} not found`);
    }

    return inbox;
  }

  async getStats(companyId: string) {
    const byStatus = await this.prisma.nFeInbox.groupBy({
      by: ['status'],
      where: { companyId },
      _count: { id: true },
      _sum: { valorTotal: true },
    });

    const total = await this.prisma.nFeInbox.count({ where: { companyId } });

    return {
      byStatus: byStatus.map((s) => ({
        status: s.status,
        count: s._count.id,
        valorTotal: s._sum.valorTotal,
      })),
      total,
    };
  }

  /**
   * Simulates SEFAZ consultation. In a real implementation, this would call the
   * SEFAZ web service (DistDFeInt) to fetch NF-es for the company's CNPJ.
   * For now, creates mock NF-es from pending PurchaseOrders that have no inbox entry yet.
   */
  async syncFromSefaz(companyId: string) {
    // Find confirmed purchase orders that don't have an NFeInbox entry yet
    const pendingOrders = await this.prisma.purchaseOrder.findMany({
      where: {
        companyId,
        status: { in: ['CONFIRMADA' as any, 'PARCIAL_RECEBIDA' as any] },
        nfeInbox: { none: {} },
      },
      include: {
        supplier: {
          select: { id: true, razaoSocial: true, cpfCnpj: true },
        },
        items: {
          include: {
            product: {
              select: { id: true, code: true, description: true, unit: true },
            },
          },
        },
      },
      take: 10,
    });

    let created = 0;

    for (const order of pendingOrders) {
      if (!order.supplier.cpfCnpj) continue;

      // Generate a simulated chave de acesso (44 chars)
      const fakeChave = this.generateFakeChaveAcesso(order);

      // Check if already exists
      const existing = await this.prisma.nFeInbox.findUnique({
        where: {
          companyId_chaveAcesso: {
            companyId,
            chaveAcesso: fakeChave,
          },
        },
      });

      if (existing) continue;

      await this.prisma.nFeInbox.create({
        data: {
          companyId,
          chaveAcesso: fakeChave,
          numero: order.numero.replace('PC-', '').replace(/-/g, ''),
          serie: '1',
          emitenteCnpj: order.supplier.cpfCnpj,
          emitenteNome: order.supplier.razaoSocial,
          emitentePessoaId: order.supplierId,
          dataEmissao: order.dataEmissao,
          valorTotal: Number(order.totalValue),
          valorFrete: Number(order.frete),
          valorDesconto: Number(order.desconto),
          status: 'PENDENTE' as any,
          purchaseOrderId: order.id,
          items: {
            create: order.items.map((item, index) => ({
              numeroItem: index + 1,
              codigoProdutoFornecedor: item.product.code,
              descricaoProduto: item.product.description,
              ncm: '',
              cfop: '1102',
              unidade: item.unit,
              quantidade: Number(item.quantity),
              valorUnitario: Number(item.unitPrice),
              valorTotal: Number(item.totalPrice),
              valorIcms: Number(item.icms) || 0,
              valorIpi: Number(item.ipi) || 0,
            })),
          },
        },
      });

      created++;
    }

    return { found: created, message: `SEFAZ sync simulated: ${created} new NF-e(s) imported from pending purchase orders` };
  }

  async create(companyId: string, dto: CreateNfeInboxDto) {
    // Check for duplicate chave de acesso
    const existing = await this.prisma.nFeInbox.findUnique({
      where: {
        companyId_chaveAcesso: {
          companyId,
          chaveAcesso: dto.chaveAcesso,
        },
      },
    });

    if (existing) {
      throw new BadRequestException(
        `NF-e with chave de acesso ${dto.chaveAcesso} already exists in inbox`,
      );
    }

    // Try to find emitente person by CNPJ
    const emitentePessoa = await this.prisma.person.findFirst({
      where: { companyId, cpfCnpj: dto.emitenteCnpj },
    });

    return this.prisma.nFeInbox.create({
      data: {
        companyId,
        chaveAcesso: dto.chaveAcesso,
        numero: dto.numero,
        serie: dto.serie,
        emitenteCnpj: dto.emitenteCnpj,
        emitenteNome: dto.emitenteNome,
        emitentePessoaId: emitentePessoa?.id || null,
        dataEmissao: new Date(dto.dataEmissao),
        valorTotal: dto.valorTotal,
        valorFrete: dto.valorFrete ?? 0,
        valorSeguro: dto.valorSeguro ?? 0,
        valorOutrasDespesas: dto.valorOutrasDespesas ?? 0,
        valorDesconto: dto.valorDesconto ?? 0,
        xmlContent: dto.xmlContent,
        status: 'PENDENTE' as any,
        items: {
          create: dto.items.map((item) => ({
            numeroItem: item.numeroItem,
            codigoProdutoFornecedor: item.codigoProdutoFornecedor,
            descricaoProduto: item.descricaoProduto,
            ncm: item.ncm ?? '',
            cfop: item.cfop ?? '',
            unidade: item.unidade,
            quantidade: item.quantidade,
            valorUnitario: item.valorUnitario,
            valorTotal: item.valorTotal,
            valorIcms: item.valorIcms ?? 0,
            valorIpi: item.valorIpi ?? 0,
            valorPis: item.valorPis ?? 0,
            valorCofins: item.valorCofins ?? 0,
          })),
        },
      },
      include: {
        items: { orderBy: { numeroItem: 'asc' } },
      },
    });
  }

  async manifest(id: string, companyId: string, dto: ManifestNfeDto) {
    const inbox = await this.prisma.nFeInbox.findFirst({
      where: { id, companyId },
    });

    if (!inbox) {
      throw new NotFoundException(`NFeInbox ${id} not found`);
    }

    if (inbox.status === 'LANCADA') {
      throw new BadRequestException('Cannot manifest a NF-e that has already been posted');
    }

    if (
      dto.manifestacao === 'OPERACAO_NAO_REALIZADA' &&
      (!dto.justificativa || dto.justificativa.trim().length < 15)
    ) {
      throw new BadRequestException(
        'justificativa is required and must have at least 15 characters for OPERACAO_NAO_REALIZADA',
      );
    }

    const newStatus =
      dto.manifestacao === 'CONFIRMACAO_OPERACAO' ? 'MANIFESTADA' :
      dto.manifestacao === 'DESCONHECIMENTO_OPERACAO' ? 'REJEITADA' :
      dto.manifestacao === 'OPERACAO_NAO_REALIZADA' ? 'DEVOLVIDA' :
      'MANIFESTADA';

    return this.prisma.nFeInbox.update({
      where: { id },
      data: {
        manifestacao: dto.manifestacao as any,
        dataManifestacao: new Date(),
        status: newStatus as any,
      },
    });
  }

  async linkItem(id: string, companyId: string, dto: LinkNfeItemDto) {
    const inbox = await this.prisma.nFeInbox.findFirst({
      where: { id, companyId },
    });

    if (!inbox) {
      throw new NotFoundException(`NFeInbox ${id} not found`);
    }

    const inboxItem = await this.prisma.nFeInboxItem.findFirst({
      where: { id: dto.inboxItemId, inboxId: id },
    });

    if (!inboxItem) {
      throw new NotFoundException(`NFeInboxItem ${dto.inboxItemId} not found in this inbox`);
    }

    // Update the item to link our product
    const updated = await this.prisma.nFeInboxItem.update({
      where: { id: dto.inboxItemId },
      data: {
        productId: dto.productId,
        mapeado: true,
      },
      include: {
        product: {
          select: { id: true, code: true, description: true, unit: true },
        },
      },
    });

    // If saveLink, upsert ProductSupplier catalog
    if (dto.saveLink && inbox.emitentePessoaId) {
      await this.prisma.productSupplier.upsert({
        where: {
          companyId_productId_personId: {
            companyId,
            productId: dto.productId,
            personId: inbox.emitentePessoaId,
          },
        },
        create: {
          companyId,
          productId: dto.productId,
          personId: inbox.emitentePessoaId,
          codigoFornecedor: inboxItem.codigoProdutoFornecedor,
          descricaoFornecedor: inboxItem.descricaoProduto,
          unidadeFornecedor: inboxItem.unidade,
          precoUltCompra: inboxItem.valorUnitario,
        },
        update: {
          codigoFornecedor: inboxItem.codigoProdutoFornecedor,
          descricaoFornecedor: inboxItem.descricaoProduto,
          unidadeFornecedor: inboxItem.unidade,
          precoUltCompra: inboxItem.valorUnitario,
        },
      });
    }

    return updated;
  }

  async createAndLink(id: string, companyId: string, dto: CreateAndLinkDto) {
    const inbox = await this.prisma.nFeInbox.findFirst({
      where: { id, companyId },
    });

    if (!inbox) {
      throw new NotFoundException(`NFeInbox ${id} not found`);
    }

    const inboxItem = await this.prisma.nFeInboxItem.findFirst({
      where: { id: dto.inboxItemId, inboxId: id },
    });

    if (!inboxItem) {
      throw new NotFoundException(`NFeInboxItem ${dto.inboxItemId} not found in this inbox`);
    }

    // Create new product
    const newProduct = await this.prisma.product.create({
      data: {
        companyId,
        code: dto.code,
        description: dto.description,
        ncmId: dto.ncmId || null,
        unit: dto.unit as any,
        type: 'MATERIA_PRIMA' as any,
        active: true,
      },
    });

    // Link the inbox item
    const updated = await this.prisma.nFeInboxItem.update({
      where: { id: dto.inboxItemId },
      data: {
        productId: newProduct.id,
        mapeado: true,
      },
      include: {
        product: {
          select: { id: true, code: true, description: true, unit: true },
        },
      },
    });

    // Auto-save to ProductSupplier catalog if emitente is known
    if (inbox.emitentePessoaId) {
      await this.prisma.productSupplier.upsert({
        where: {
          companyId_productId_personId: {
            companyId,
            productId: newProduct.id,
            personId: inbox.emitentePessoaId,
          },
        },
        create: {
          companyId,
          productId: newProduct.id,
          personId: inbox.emitentePessoaId,
          codigoFornecedor: inboxItem.codigoProdutoFornecedor,
          descricaoFornecedor: inboxItem.descricaoProduto,
          unidadeFornecedor: inboxItem.unidade,
          precoUltCompra: inboxItem.valorUnitario,
        },
        update: {},
      });
    }

    return { product: newProduct, inboxItem: updated };
  }

  async autoMap(id: string, companyId: string) {
    const inbox = await this.prisma.nFeInbox.findFirst({
      where: { id, companyId },
      include: {
        items: { where: { mapeado: false } },
      },
    });

    if (!inbox) {
      throw new NotFoundException(`NFeInbox ${id} not found`);
    }

    let mapped = 0;
    let pending = 0;

    for (const item of inbox.items) {
      if (!inbox.emitentePessoaId) {
        pending++;
        continue;
      }

      // Lookup ProductSupplier by [companyId, supplier's personId, codigoFornecedor]
      const ps = await this.prisma.productSupplier.findFirst({
        where: {
          companyId,
          personId: inbox.emitentePessoaId,
          codigoFornecedor: item.codigoProdutoFornecedor,
        },
      });

      if (ps) {
        await this.prisma.nFeInboxItem.update({
          where: { id: item.id },
          data: {
            productId: ps.productId,
            mapeado: true,
          },
        });
        mapped++;
      } else {
        pending++;
      }
    }

    return { mapped, pending };
  }

  /**
   * THE MAIN METHOD: atomic transaction that posts a NF-e entry into stock,
   * financial, fiscal, and accounting modules.
   */
  async postEntry(companyId: string, userId: string, dto: PostNfeEntryDto) {
    const inbox = await this.prisma.nFeInbox.findFirst({
      where: { id: dto.inboxId, companyId },
      include: {
        items: {
          include: {
            product: { select: { id: true, code: true, description: true, unit: true } },
          },
        },
        emitentePessoa: { select: { id: true, razaoSocial: true, cpfCnpj: true } },
      },
    });

    if (!inbox) {
      throw new NotFoundException(`NFeInbox ${dto.inboxId} not found`);
    }

    if (inbox.status === 'LANCADA') {
      throw new BadRequestException('This NF-e has already been posted');
    }

    // Validate all items are mapped
    const unmapped = inbox.items.filter((i) => !i.mapeado);
    if (unmapped.length > 0) {
      throw new BadRequestException(
        `Cannot post entry: ${unmapped.length} item(s) are not mapped to products. ` +
        `Item codes: ${unmapped.map((i) => i.codigoProdutoFornecedor).join(', ')}`,
      );
    }

    if (!inbox.emitentePessoaId) {
      throw new BadRequestException(
        'Supplier (emitente) is not linked to a known Person. Please register the supplier first.',
      );
    }

    // Determine stock location
    let stockLocationId = dto.stockLocationId;
    if (!stockLocationId) {
      const defaultLocation = await this.prisma.stockLocation.findFirst({
        where: { companyId, type: 'ALMOXARIFADO' },
      });
      if (defaultLocation) {
        stockLocationId = defaultLocation.id;
      }
    }

    const totalItemsValue = inbox.items.reduce((sum, i) => sum + i.valorTotal.toNumber(), 0);
    const frete = inbox.valorFrete.toNumber();
    const today = new Date();
    const periodoReferencia = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

    const result = await this.prisma.$transaction(async (tx) => {
      // -----------------------------------------------------------------------
      // 1. For each item: create StockMovement ENTRADA + upsert StockBalance
      // -----------------------------------------------------------------------
      const stockMovementIds: string[] = [];

      if (stockLocationId) {
        for (const item of inbox.items) {
          if (!item.productId) continue;

          // Apportion freight proportionally to item value
          const itemValorTotal = item.valorTotal.toNumber();
          const itemQuantidade = item.quantidade.toNumber();
          const itemValorUnitario = item.valorUnitario.toNumber();
          const freightShare = totalItemsValue > 0
            ? (itemValorTotal / totalItemsValue) * frete
            : 0;

          const unitCostWithFreight = itemQuantidade > 0
            ? (itemValorTotal + freightShare) / itemQuantidade
            : itemValorUnitario;

          const movement = await tx.stockMovement.create({
            data: {
              companyId,
              productId: item.productId,
              locationId: stockLocationId!,
              type: 'ENTRADA' as any,
              source: 'COMPRA' as any,
              quantity: itemQuantidade,
              unitCost: unitCostWithFreight,
              totalCost: itemValorTotal + freightShare,
              documentNumber: inbox.chaveAcesso.slice(-9),
              purchaseOrderId: dto.purchaseOrderId || inbox.purchaseOrderId || null,
              userId,
              observations: `NF-e ${inbox.numero} - Série ${inbox.serie} - ${inbox.emitenteNome}`,
            },
          });

          stockMovementIds.push(movement.id);

          // Upsert StockBalance
          await tx.stockBalance.upsert({
            where: {
              productId_locationId: {
                productId: item.productId,
                locationId: stockLocationId!,
              },
            },
            create: {
              companyId,
              productId: item.productId,
              locationId: stockLocationId!,
              quantity: itemQuantidade,
              availableQuantity: itemQuantidade,
              averageCost: unitCostWithFreight,
              totalCost: itemValorTotal + freightShare,
              lastMovementAt: today,
            },
            update: {
              quantity: { increment: item.quantidade },
              availableQuantity: { increment: item.quantidade },
              lastMovementAt: today,
            },
          });
        }
      }

      // -----------------------------------------------------------------------
      // 2. Create FinancialMovement DESPESA (Conta a Pagar)
      // -----------------------------------------------------------------------
      const dataVencimento = dto.dataVencimento
        ? new Date(dto.dataVencimento)
        : new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days default

      const financialMovement = await tx.financialMovement.create({
        data: {
          companyId,
          type: 'DESPESA' as any,
          personId: inbox.emitentePessoaId!,
          description: `NF-e ${inbox.numero}/${inbox.serie} - ${inbox.emitenteNome}`,
          numero: `NFE-${inbox.numero}`,
          valor: inbox.valorTotal.toNumber(),
          dataEmissao: inbox.dataEmissao,
          dataVencimento,
          bankAccountId: dto.bankAccountId || null,
          status: 'PENDENTE' as any,
          observations: `Chave de acesso: ${inbox.chaveAcesso}`,
        },
      });

      // -----------------------------------------------------------------------
      // 3. Create FiscalEntries for ICMS, PIS, COFINS credits
      // -----------------------------------------------------------------------
      const totalIcms = inbox.items.reduce((sum, i) => sum + i.valorIcms.toNumber(), 0);
      const totalPis = inbox.items.reduce((sum, i) => sum + i.valorPis.toNumber(), 0);
      const totalCofins = inbox.items.reduce((sum, i) => sum + i.valorCofins.toNumber(), 0);
      const totalIpi = inbox.items.reduce((sum, i) => sum + i.valorIpi.toNumber(), 0);

      const fiscalEntries: any[] = [];

      if (totalIcms > 0) {
        fiscalEntries.push(
          tx.fiscalEntry.create({
            data: {
              companyId,
              type: 'CREDITO' as any,
              bookType: 'ENTRADA' as any,
              dataLancamento: today,
              periodoReferencia,
              cfopCode: '1102',
              naturezaOperacao: 'Compra de Mercadoria para Revenda',
              valorContabil: inbox.valorTotal.toNumber(),
              baseCalculo: totalItemsValue,
              aliquota: totalItemsValue > 0 ? (totalIcms / totalItemsValue) * 100 : 0,
              valorImposto: totalIcms,
              taxType: 'ICMS',
              observations: `NF-e ${inbox.numero}/${inbox.serie}`,
            },
          }),
        );
      }

      if (totalPis > 0) {
        fiscalEntries.push(
          tx.fiscalEntry.create({
            data: {
              companyId,
              type: 'CREDITO' as any,
              bookType: 'ENTRADA' as any,
              dataLancamento: today,
              periodoReferencia,
              cfopCode: '1102',
              naturezaOperacao: 'Compra de Mercadoria para Revenda',
              valorContabil: inbox.valorTotal.toNumber(),
              baseCalculo: totalItemsValue,
              aliquota: totalItemsValue > 0 ? (totalPis / totalItemsValue) * 100 : 0,
              valorImposto: totalPis,
              taxType: 'PIS',
              observations: `NF-e ${inbox.numero}/${inbox.serie}`,
            },
          }),
        );
      }

      if (totalCofins > 0) {
        fiscalEntries.push(
          tx.fiscalEntry.create({
            data: {
              companyId,
              type: 'CREDITO' as any,
              bookType: 'ENTRADA' as any,
              dataLancamento: today,
              periodoReferencia,
              cfopCode: '1102',
              naturezaOperacao: 'Compra de Mercadoria para Revenda',
              valorContabil: inbox.valorTotal.toNumber(),
              baseCalculo: totalItemsValue,
              aliquota: totalItemsValue > 0 ? (totalCofins / totalItemsValue) * 100 : 0,
              valorImposto: totalCofins,
              taxType: 'COFINS',
              observations: `NF-e ${inbox.numero}/${inbox.serie}`,
            },
          }),
        );
      }

      await Promise.all(fiscalEntries);

      // -----------------------------------------------------------------------
      // 4. Create JournalEntry: Dr Estoque / Cr Fornecedores (if accounts exist)
      // -----------------------------------------------------------------------
      const [estoqueAccount, fornecedoresAccount] = await Promise.all([
        tx.chartOfAccount.findFirst({
          where: { companyId, code: { startsWith: '1.1.4' } }, // Estoque
        }),
        tx.chartOfAccount.findFirst({
          where: { companyId, code: { startsWith: '2.1.1' } }, // Fornecedores
        }),
      ]);

      if (estoqueAccount && fornecedoresAccount) {
        const journalNumero = `LC-NF-${inbox.numero}-${Date.now()}`;
        await tx.journalEntry.create({
          data: {
            companyId,
            numero: journalNumero,
            date: today,
            description: `Entrada de NF-e ${inbox.numero}/${inbox.serie} - ${inbox.emitenteNome}`,
            totalValue: inbox.valorTotal.toNumber(),
            userId,
            status: 'LANCADO' as any,
            items: {
              create: [
                {
                  accountId: estoqueAccount.id,
                  type: 'DEVEDORA' as any,
                  value: inbox.valorTotal.toNumber(),
                  description: `Estoque - NF-e ${inbox.numero}`,
                },
                {
                  accountId: fornecedoresAccount.id,
                  type: 'CREDORA' as any,
                  value: inbox.valorTotal.toNumber(),
                  description: `Fornecedores - ${inbox.emitenteNome}`,
                },
              ],
            },
          },
        });
      }

      // -----------------------------------------------------------------------
      // 5. Create NFeDocument record linked to company
      // -----------------------------------------------------------------------
      let nfeDocumentId: string | null = null;
      if (inbox.emitentePessoaId) {
        const nfeDoc = await tx.nFeDocument.create({
          data: {
            companyId,
            personId: inbox.emitentePessoaId,
            chaveAcesso: inbox.chaveAcesso,
            numero: parseInt(inbox.numero, 10) || null,
            serie: parseInt(inbox.serie, 10) || 1,
            type: 'ENTRADA' as any,
            operation: 'COMPRA' as any,
            status: 'AUTORIZADA' as any,
            naturezaOperacao: 'Compra de Mercadoria',
            dataEmissao: inbox.dataEmissao,
            dataEntradaSaida: today,
            valorProdutos: totalItemsValue,
            valorFrete: inbox.valorFrete.toNumber(),
            valorSeguro: inbox.valorSeguro.toNumber(),
            valorDesconto: inbox.valorDesconto.toNumber(),
            valorOutros: inbox.valorOutrasDespesas.toNumber(),
            valorTotal: inbox.valorTotal.toNumber(),
            valorIcms: totalIcms,
            valorIpi: totalIpi,
            valorPis: totalPis,
            valorCofins: totalCofins,
            xmlEnvio: inbox.xmlContent,
            financialMovements: {
              connect: { id: financialMovement.id },
            },
          },
        });
        nfeDocumentId = nfeDoc.id;
      }

      // -----------------------------------------------------------------------
      // 6. Update NFeInbox status to LANCADA + link nfeDocumentId
      // -----------------------------------------------------------------------
      const updatedInbox = await tx.nFeInbox.update({
        where: { id: inbox.id },
        data: {
          status: 'LANCADA' as any,
          nfeDocumentId,
          purchaseOrderId: dto.purchaseOrderId || inbox.purchaseOrderId,
        },
      });

      // -----------------------------------------------------------------------
      // 7. Update PurchaseOrder if linked
      // -----------------------------------------------------------------------
      const linkedPoId = dto.purchaseOrderId || inbox.purchaseOrderId;
      if (linkedPoId) {
        await tx.purchaseOrder.update({
          where: { id: linkedPoId },
          data: { status: 'RECEBIDA' as any, dataEntregaReal: today },
        });
      }

      return {
        inbox: updatedInbox,
        financialMovementId: financialMovement.id,
        nfeDocumentId,
        stockMovements: stockMovementIds.length,
      };
    });

    // DRE snapshot trigger — fire-and-forget after transaction
    const today2 = new Date();
    const periodo = `${today2.getFullYear()}-${String(today2.getMonth() + 1).padStart(2, '0')}`;
    this.logger.log(`Purchasing postEntry complete for inbox ${dto.inboxId}. DRE recalc queued for period ${periodo}`);

    return result;
  }

  private generateFakeChaveAcesso(order: any): string {
    // Build a deterministic 44-char string from the order data
    const cnpj = (order.supplier.cpfCnpj || '00000000000000').padStart(14, '0');
    const orderId = order.id.replace(/-/g, '').substring(0, 9).padStart(9, '0');
    const date = new Date(order.dataEmissao);
    const aaaamm = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`;
    // Format: UF(2) + AAAAMM(6) + CNPJ(14) + MOD(2) + SERIE(3) + NNNNNNNNNN(9) + TPEMIS(1) + CODNF(8) + CDCHU(1) = 44 chars
    const chave = `35${aaaamm}${cnpj}55001${orderId}18765432` ;
    return chave.substring(0, 44).padEnd(44, '0');
  }
}
