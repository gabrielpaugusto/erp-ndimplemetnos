import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';
import { CreateQuotationDto } from './dto/create-quotation.dto';
import { UpdateQuotationDto } from './dto/update-quotation.dto';
import { CreateQuotationItemDto } from './dto/create-quotation-item.dto';

@Injectable()
export class QuotationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    companyId: string,
    query: {
      search?: string;
      status?: string;
      saleType?: string;
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
        {
          person: {
            razaoSocial: { contains: query.search, mode: 'insensitive' },
          },
        },
        { numero: !isNaN(Number(query.search)) ? Number(query.search) : undefined },
      ].filter((condition) => {
        // Filter out undefined numero conditions
        if ('numero' in condition && condition.numero === undefined) return false;
        return true;
      });
      if (where.OR.length === 0) delete where.OR;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.saleType) {
      where.saleType = query.saleType;
    }

    const [data, total] = await Promise.all([
      this.prisma.quotation.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          person: {
            select: {
              id: true,
              razaoSocial: true,
              nomeFantasia: true,
              cpfCnpj: true,
            },
          },
          vendedor: {
            select: { id: true, name: true, email: true },
          },
          _count: { select: { items: true } },
        },
      }),
      this.prisma.quotation.count({ where }),
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
    const quotation = await this.prisma.quotation.findUnique({
      where: { id },
      include: {
        person: true,
        vendedor: {
          select: { id: true, name: true, email: true },
        },
        lead: {
          select: { id: true, title: true, status: true },
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                code: true,
                description: true,
                unit: true,
              },
            },
          },
        },
      },
    });

    if (!quotation) {
      throw new NotFoundException(`Quotation ${id} not found`);
    }

    return quotation;
  }

  async create(companyId: string, data: CreateQuotationDto) {
    // Auto-generate numero
    const maxNumero = await this.prisma.quotation.aggregate({
      where: { companyId },
      _max: { numero: true },
    });
    const nextNumero = (maxNumero._max.numero || 0) + 1;

    // Calculate item totals
    const items = (data.items || []).map((item) => {
      const desconto = item.desconto || 0;
      const subtotal =
        Number(item.quantidade) * Number(item.precoUnitario) - desconto;
      return { ...item, total: subtotal };
    });

    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    const descontoTotal = items.reduce(
      (sum, item) => sum + (item.desconto || 0),
      0,
    );

    return this.prisma.quotation.create({
      data: {
        companyId,
        numero: nextNumero,
        personId: data.personId,
        leadId: data.leadId,
        saleType: (data.saleType as any) || 'ESTOQUE_PROPRIO',
        condicaoPagamento: data.condicaoPagamento,
        validadeOrcamento: data.validadeOrcamento
          ? new Date(data.validadeOrcamento)
          : undefined,
        prazoEntrega: data.prazoEntrega,
        observacoes: data.observacoes,
        vendedorId: data.vendedorId,
        comissaoPercent: data.comissaoPercent,
        subtotal,
        desconto: descontoTotal,
        total: subtotal,
        items: items.length > 0
          ? {
              create: items.map((item) => ({
                productId: item.productId,
                quantidade: item.quantidade,
                precoUnitario: item.precoUnitario,
                desconto: item.desconto || 0,
                total: item.total,
              })),
            }
          : undefined,
      },
      include: {
        person: true,
        items: { include: { product: true } },
      },
    });
  }

  async update(id: string, data: UpdateQuotationDto) {
    const existing = await this.prisma.quotation.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Quotation ${id} not found`);
    }

    const { items, ...updateData } = data;

    const prismaData: any = { ...updateData };

    if (data.validadeOrcamento) {
      prismaData.validadeOrcamento = new Date(data.validadeOrcamento);
    }

    return this.prisma.quotation.update({
      where: { id },
      data: prismaData,
      include: {
        person: true,
        items: { include: { product: true } },
      },
    });
  }

  async addItem(quotationId: string, data: CreateQuotationItemDto) {
    const quotation = await this.prisma.quotation.findUnique({
      where: { id: quotationId },
    });
    if (!quotation) {
      throw new NotFoundException(`Quotation ${quotationId} not found`);
    }

    const desconto = data.desconto || 0;
    const total =
      Number(data.quantidade) * Number(data.precoUnitario) - desconto;

    const item = await this.prisma.quotationItem.create({
      data: {
        quotationId,
        productId: data.productId,
        quantidade: data.quantidade,
        precoUnitario: data.precoUnitario,
        desconto,
        total,
        observacoes: data.observacoes,
      },
      include: { product: true },
    });

    await this.recalculate(quotationId);

    return item;
  }

  async removeItem(itemId: string) {
    const item = await this.prisma.quotationItem.findUnique({
      where: { id: itemId },
    });
    if (!item) {
      throw new NotFoundException(`Quotation item ${itemId} not found`);
    }

    await this.prisma.quotationItem.delete({ where: { id: itemId } });
    await this.recalculate(item.quotationId);

    return { deleted: true };
  }

  async recalculate(quotationId: string) {
    const items = await this.prisma.quotationItem.findMany({
      where: { quotationId },
    });

    const subtotal = items.reduce(
      (sum, item) => sum + Number(item.total),
      0,
    );
    const descontoTotal = items.reduce(
      (sum, item) => sum + Number(item.desconto),
      0,
    );

    return this.prisma.quotation.update({
      where: { id: quotationId },
      data: {
        subtotal,
        desconto: descontoTotal,
        total: subtotal,
      },
    });
  }

  async convertToSaleOrder(quotationId: string) {
    const quotation = await this.prisma.quotation.findUnique({
      where: { id: quotationId },
      include: { items: true },
    });

    if (!quotation) {
      throw new NotFoundException(`Quotation ${quotationId} not found`);
    }

    if (quotation.status === 'ACEITO') {
      throw new BadRequestException('Quotation already converted');
    }

    // Get next sale order number
    const maxNumero = await this.prisma.saleOrder.aggregate({
      where: { companyId: quotation.companyId },
      _max: { numero: true },
    });
    const nextNumero = (maxNumero._max.numero || 0) + 1;

    // Create sale order in a transaction
    const saleOrder = await this.prisma.$transaction(async (tx) => {
      const order = await tx.saleOrder.create({
        data: {
          companyId: quotation.companyId,
          numero: nextNumero,
          personId: quotation.personId,
          quotationId: quotation.id,
          saleType: quotation.saleType,
          vendedorId: quotation.vendedorId,
          comissaoPercent: quotation.comissaoPercent,
          condicaoPagamento: quotation.condicaoPagamento,
          prazoEntrega: quotation.prazoEntrega,
          subtotal: quotation.subtotal,
          desconto: quotation.desconto,
          total: quotation.total,
          observacoes: quotation.observacoes,
          items: {
            create: quotation.items.map((item, index) => ({
              productId: item.productId,
              quantidade: item.quantidade,
              precoUnitario: item.precoUnitario,
              desconto: item.desconto,
              total: item.total,
              sequencia: index + 1,
              observacoes: item.observacoes,
            })),
          },
        },
        include: {
          person: true,
          items: { include: { product: true } },
        },
      });

      // Update quotation status
      await tx.quotation.update({
        where: { id: quotationId },
        data: { status: 'ACEITO' },
      });

      return order;
    });

    return saleOrder;
  }
}
