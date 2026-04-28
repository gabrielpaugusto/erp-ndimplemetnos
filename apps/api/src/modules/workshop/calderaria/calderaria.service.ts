import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';
import { CreateCalderariaOrderDto } from './dto/create-calderaria-order.dto';
import { UpdateCalderariaOrderDto } from './dto/update-calderaria-order.dto';

@Injectable()
export class CalderariaService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    companyId: string,
    query: {
      search?: string;
      status?: string;
      serviceType?: string;
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
        { description: { contains: query.search, mode: 'insensitive' } },
        { materialDescription: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.serviceType) {
      where.serviceType = query.serviceType;
    }

    const [data, total] = await Promise.all([
      this.prisma.calderariaOrder.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ createdAt: 'desc' }],
        include: {
          serviceOrder: {
            select: { id: true, numero: true, status: true },
          },
          productionOrder: {
            select: { id: true, numero: true, status: true },
          },
          responsavel: {
            select: { id: true, name: true },
          },
        },
      }),
      this.prisma.calderariaOrder.count({ where }),
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
    const order = await this.prisma.calderariaOrder.findUnique({
      where: { id },
      include: {
        serviceOrder: {
          select: { id: true, numero: true, status: true, equipamento: { select: { placa: true, tipo: true } } },
        },
        productionOrder: {
          select: { id: true, numero: true, status: true },
        },
        responsavel: {
          select: { id: true, name: true },
        },
        requisitions: {
          select: { id: true, numero: true, status: true, type: true, createdAt: true },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Calderaria Order ${id} not found`);
    }

    return order;
  }

  async create(companyId: string, data: CreateCalderariaOrderDto) {
    const numero = await this.generateNumero(companyId);

    return this.prisma.calderariaOrder.create({
      data: {
        companyId,
        numero,
        serviceOrderId: data.serviceOrderId || null,
        productionOrderId: data.productionOrderId || null,
        serviceType: data.serviceType as any,
        description: data.description,
        materialDescription: data.materialDescription,
        tempoEstimado: data.tempoEstimado,
        especificacoesTecnicas: data.especificacoesTecnicas,
        observations: data.observations,
        status: 'ABERTA' as any,
      },
      include: {
        serviceOrder: {
          select: { id: true, numero: true, status: true },
        },
        productionOrder: {
          select: { id: true, numero: true, status: true },
        },
      },
    });
  }

  async update(id: string, data: UpdateCalderariaOrderDto) {
    const existing = await this.prisma.calderariaOrder.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Calderaria Order ${id} not found`);
    }

    const updateData: any = { ...data };

    if (data.dataInicio) {
      updateData.dataInicio = new Date(data.dataInicio);
    }
    if (data.dataFim) {
      updateData.dataFim = new Date(data.dataFim);
    }

    return this.prisma.calderariaOrder.update({
      where: { id },
      data: updateData,
      include: {
        serviceOrder: {
          select: { id: true, numero: true, status: true },
        },
        productionOrder: {
          select: { id: true, numero: true, status: true },
        },
        responsavel: {
          select: { id: true, name: true },
        },
      },
    });
  }

  /**
   * Start: ABERTA -> EM_EXECUCAO
   */
  async start(id: string) {
    const order = await this.prisma.calderariaOrder.findUnique({ where: { id } });

    if (!order) {
      throw new NotFoundException(`Calderaria Order ${id} not found`);
    }

    if (order.status !== 'ABERTA') {
      throw new BadRequestException(
        `Cannot start order with status ${order.status}. Expected ABERTA.`,
      );
    }

    return this.prisma.calderariaOrder.update({
      where: { id },
      data: {
        status: 'EM_EXECUCAO' as any,
        dataInicio: new Date(),
      },
      include: {
        responsavel: { select: { id: true, name: true } },
      },
    });
  }

  /**
   * Complete: EM_EXECUCAO -> CONCLUIDA
   */
  async complete(id: string) {
    const order = await this.prisma.calderariaOrder.findUnique({ where: { id } });

    if (!order) {
      throw new NotFoundException(`Calderaria Order ${id} not found`);
    }

    if (order.status !== 'EM_EXECUCAO') {
      throw new BadRequestException(
        `Cannot complete order with status ${order.status}. Expected EM_EXECUCAO.`,
      );
    }

    return this.prisma.calderariaOrder.update({
      where: { id },
      data: {
        status: 'CONCLUIDA' as any,
        dataFim: new Date(),
      },
      include: {
        responsavel: { select: { id: true, name: true } },
      },
    });
  }

  /**
   * Cancel: ABERTA | EM_EXECUCAO -> CANCELADA
   */
  async cancel(id: string) {
    const order = await this.prisma.calderariaOrder.findUnique({ where: { id } });

    if (!order) {
      throw new NotFoundException(`Calderaria Order ${id} not found`);
    }

    if (order.status === 'CONCLUIDA' || order.status === 'CANCELADA') {
      throw new BadRequestException(
        `Cannot cancel order with status ${order.status}.`,
      );
    }

    return this.prisma.calderariaOrder.update({
      where: { id },
      data: { status: 'CANCELADA' as any },
      include: {
        responsavel: { select: { id: true, name: true } },
      },
    });
  }

  async getStats(companyId: string) {
    const [byStatus, byServiceType] = await Promise.all([
      this.prisma.calderariaOrder.groupBy({
        by: ['status'],
        where: { companyId },
        _count: { id: true },
      }),
      this.prisma.calderariaOrder.groupBy({
        by: ['serviceType'],
        where: { companyId },
        _count: { id: true },
      }),
    ]);

    return {
      byStatus: byStatus.map((s) => ({
        status: s.status,
        count: s._count.id,
      })),
      byServiceType: byServiceType.map((t) => ({
        serviceType: t.serviceType,
        count: t._count.id,
      })),
    };
  }

  private async generateNumero(companyId: string): Promise<string> {
    const today = new Date();
    const dateStr =
      today.getFullYear().toString() +
      (today.getMonth() + 1).toString().padStart(2, '0') +
      today.getDate().toString().padStart(2, '0');

    const prefix = `CLD-${dateStr}-`;

    const lastOrder = await this.prisma.calderariaOrder.findFirst({
      where: {
        companyId,
        numero: { startsWith: prefix },
      },
      orderBy: { numero: 'desc' },
    });

    let sequence = 1;
    if (lastOrder && lastOrder.numero) {
      const lastSequence = parseInt(
        lastOrder.numero.replace(prefix, ''),
        10,
      );
      if (!isNaN(lastSequence)) {
        sequence = lastSequence + 1;
      }
    }

    return `${prefix}${sequence.toString().padStart(3, '0')}`;
  }
}
