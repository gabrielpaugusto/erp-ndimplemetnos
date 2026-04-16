import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';
import { CreateSupplierQuotationDto } from './dto/create-supplier-quotation.dto';
import { UpdateSupplierQuotationDto } from './dto/update-supplier-quotation.dto';

@Injectable()
export class SupplierQuotationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    companyId: string,
    query: {
      search?: string;
      status?: string;
      purchaseRequestId?: string;
      supplierId?: string;
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
        { numero: { contains: query.search, mode: 'insensitive' } },
        {
          supplier: {
            razaoSocial: { contains: query.search, mode: 'insensitive' },
          },
        },
      ];
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.purchaseRequestId) {
      where.purchaseRequestId = query.purchaseRequestId;
    }

    if (query.supplierId) {
      where.supplierId = query.supplierId;
    }

    const [data, total] = await Promise.all([
      this.prisma.supplierQuotation.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          supplier: {
            select: { id: true, razaoSocial: true, nomeFantasia: true },
          },
          purchaseRequest: {
            select: { id: true, numero: true, description: true },
          },
          _count: {
            select: { items: true },
          },
        },
      }),
      this.prisma.supplierQuotation.count({ where }),
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
    const quotation = await this.prisma.supplierQuotation.findUnique({
      where: { id },
      include: {
        supplier: {
          select: { id: true, razaoSocial: true, nomeFantasia: true, cpfCnpj: true },
        },
        purchaseRequest: {
          select: { id: true, numero: true, description: true, status: true },
        },
        items: {
          include: {
            product: {
              select: { id: true, code: true, description: true, unit: true },
            },
          },
        },
      },
    });

    if (!quotation) {
      throw new NotFoundException(`Supplier quotation ${id} not found`);
    }

    return quotation;
  }

  async create(companyId: string, data: CreateSupplierQuotationDto) {
    const totalValue = data.items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0,
    );

    return this.prisma.supplierQuotation.create({
      data: {
        companyId,
        purchaseRequestId: data.purchaseRequestId,
        supplierId: data.supplierId,
        dataValidade: data.dataValidade ? new Date(data.dataValidade) : null,
        condicaoPagamento: data.condicaoPagamento,
        observations: data.observations,
        status: 'PENDENTE' as any,
        totalValue,
        dataEnvio: new Date(),
        items: {
          create: data.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.quantity * item.unitPrice,
            prazoEntrega: item.prazoEntrega,
            observations: item.observations,
          })),
        },
      },
      include: {
        supplier: {
          select: { id: true, razaoSocial: true, nomeFantasia: true },
        },
        purchaseRequest: {
          select: { id: true, numero: true },
        },
        items: {
          include: {
            product: {
              select: { id: true, code: true, description: true, unit: true },
            },
          },
        },
      },
    });
  }

  async update(id: string, data: UpdateSupplierQuotationDto) {
    const existing = await this.prisma.supplierQuotation.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Supplier quotation ${id} not found`);
    }

    const updateData: any = {};
    if (data.dataValidade !== undefined) updateData.dataValidade = data.dataValidade ? new Date(data.dataValidade) : null;
    if (data.condicaoPagamento !== undefined) updateData.condicaoPagamento = data.condicaoPagamento;
    if (data.observations !== undefined) updateData.observations = data.observations;

    return this.prisma.supplierQuotation.update({
      where: { id },
      data: updateData,
      include: {
        supplier: {
          select: { id: true, razaoSocial: true, nomeFantasia: true },
        },
        items: {
          include: {
            product: {
              select: { id: true, code: true, description: true, unit: true },
            },
          },
        },
      },
    });
  }

  async respond(id: string) {
    const quotation = await this.prisma.supplierQuotation.findUnique({
      where: { id },
    });

    if (!quotation) {
      throw new NotFoundException(`Supplier quotation ${id} not found`);
    }

    if (quotation.status !== 'PENDENTE') {
      throw new BadRequestException(
        `Cannot respond to quotation with status ${quotation.status}. Expected PENDENTE.`,
      );
    }

    return this.prisma.supplierQuotation.update({
      where: { id },
      data: {
        status: 'RECEBIDA' as any,
        dataResposta: new Date(),
      },
      include: {
        supplier: {
          select: { id: true, razaoSocial: true, nomeFantasia: true },
        },
      },
    });
  }

  async approve(id: string, companyId: string) {
    const quotation = await this.prisma.supplierQuotation.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!quotation) {
      throw new NotFoundException(`Supplier quotation ${id} not found`);
    }

    if (quotation.status !== 'RECEBIDA') {
      throw new BadRequestException(
        `Cannot approve quotation with status ${quotation.status}. Expected RECEBIDA.`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // Approve the quotation
      const updated = await tx.supplierQuotation.update({
        where: { id },
        data: { status: 'APROVADA' as any },
        include: {
          supplier: {
            select: { id: true, razaoSocial: true, nomeFantasia: true },
          },
          items: {
            include: {
              product: {
                select: { id: true, code: true, description: true, unit: true },
              },
            },
          },
        },
      });

      // Auto-generate purchase order number
      const today = new Date();
      const dateStr =
        today.getFullYear().toString() +
        (today.getMonth() + 1).toString().padStart(2, '0') +
        today.getDate().toString().padStart(2, '0');
      const pcPrefix = `PC-${dateStr}-`;

      const lastPO = await tx.purchaseOrder.findFirst({
        where: {
          companyId,
          numero: { startsWith: pcPrefix },
        },
        orderBy: { numero: 'desc' },
      });

      let sequence = 1;
      if (lastPO && lastPO.numero) {
        const lastSeq = parseInt(lastPO.numero.replace(pcPrefix, ''), 10);
        if (!isNaN(lastSeq)) {
          sequence = lastSeq + 1;
        }
      }
      const pcNumero = `${pcPrefix}${sequence.toString().padStart(3, '0')}`;

      const subtotal = quotation.items.reduce(
        (sum, item) => sum + Number(item.totalPrice),
        0,
      );

      // Create purchase order from quotation
      await tx.purchaseOrder.create({
        data: {
          companyId,
          numero: pcNumero,
          supplierId: quotation.supplierId,
          purchaseRequestId: quotation.purchaseRequestId,
          condicaoPagamento: quotation.condicaoPagamento,
          status: 'RASCUNHO' as any,
          subtotal,
          totalValue: subtotal,
          items: {
            create: quotation.items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              quantityReceived: 0,
              unit: 'UN',
              unitPrice: item.unitPrice,
              totalPrice: item.totalPrice,
            })),
          },
        },
      });

      return updated;
    });
  }

  async reject(id: string) {
    const quotation = await this.prisma.supplierQuotation.findUnique({
      where: { id },
    });

    if (!quotation) {
      throw new NotFoundException(`Supplier quotation ${id} not found`);
    }

    if (quotation.status !== 'RECEBIDA' && quotation.status !== 'PENDENTE') {
      throw new BadRequestException(
        `Cannot reject quotation with status ${quotation.status}.`,
      );
    }

    return this.prisma.supplierQuotation.update({
      where: { id },
      data: { status: 'REJEITADA' as any },
      include: {
        supplier: {
          select: { id: true, razaoSocial: true, nomeFantasia: true },
        },
      },
    });
  }

  async compare(purchaseRequestId: string) {
    const quotations = await this.prisma.supplierQuotation.findMany({
      where: { purchaseRequestId },
      include: {
        supplier: {
          select: { id: true, razaoSocial: true, nomeFantasia: true },
        },
        items: {
          include: {
            product: {
              select: { id: true, code: true, description: true, unit: true },
            },
          },
          orderBy: { productId: 'asc' },
        },
      },
      orderBy: { totalValue: 'asc' },
    });

    return { quotations };
  }
}
