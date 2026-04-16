import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';
import { CreatePointingDto } from './dto/create-pointing.dto';
import { UpdatePointingDto } from './dto/update-pointing.dto';

@Injectable()
export class PointingService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    companyId: string,
    query: {
      productionOrderId?: string;
      workCenterId?: string;
      type?: string;
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

    if (query.productionOrderId) {
      where.productionOrderId = query.productionOrderId;
    }

    if (query.workCenterId) {
      where.workCenterId = query.workCenterId;
    }

    if (query.type) {
      where.type = query.type;
    }

    if (query.startDate || query.endDate) {
      where.dataInicio = {};
      if (query.startDate) {
        where.dataInicio.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        where.dataInicio.lte = new Date(query.endDate);
      }
    }

    const [data, total] = await Promise.all([
      this.prisma.productionPointing.findMany({
        where,
        skip,
        take: limit,
        orderBy: { dataInicio: 'desc' },
        include: {
          productionOrder: {
            select: { id: true, numero: true, status: true },
          },
          workCenter: {
            select: { id: true, code: true, name: true },
          },
          user: {
            select: { id: true, name: true },
          },
        },
      }),
      this.prisma.productionPointing.count({ where }),
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
    const pointing = await this.prisma.productionPointing.findUnique({
      where: { id },
      include: {
        productionOrder: {
          select: { id: true, numero: true, status: true, quantity: true },
        },
        workCenter: {
          select: { id: true, code: true, name: true, type: true },
        },
        user: {
          select: { id: true, name: true },
        },
      },
    });

    if (!pointing) {
      throw new NotFoundException(`Pointing ${id} not found`);
    }

    return pointing;
  }

  async create(companyId: string, userId: string, data: CreatePointingDto) {
    return this.prisma.productionPointing.create({
      data: {
        companyId,
        userId,
        productionOrderId: data.productionOrderId,
        workCenterId: data.workCenterId,
        type: data.type as any,
        dataInicio: new Date(data.dataInicio),
        dataFim: data.dataFim ? new Date(data.dataFim) : undefined,
        quantityProduced: data.quantityProduced,
        quantityRejected: data.quantityRejected,
        observations: data.observations,
        motivoParada: data.motivoParada,
      },
      include: {
        productionOrder: {
          select: { id: true, numero: true, status: true },
        },
        workCenter: {
          select: { id: true, code: true, name: true },
        },
      },
    });
  }

  async update(id: string, data: UpdatePointingDto) {
    const existing = await this.prisma.productionPointing.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Pointing ${id} not found`);
    }

    const updateData: any = { ...data };

    if (data.dataInicio) {
      updateData.dataInicio = new Date(data.dataInicio);
    }
    if (data.dataFim) {
      updateData.dataFim = new Date(data.dataFim);
    }

    const pointing = await this.prisma.productionPointing.update({
      where: { id },
      data: updateData,
      include: {
        productionOrder: {
          select: { id: true, numero: true, status: true },
        },
        workCenter: {
          select: { id: true, code: true, name: true },
        },
      },
    });

    // If pointing is completed (has dataFim and quantityProduced),
    // update the production order's quantityProduced
    if (pointing.dataFim && pointing.quantityProduced != null) {
      const totalProduced = await this.prisma.productionPointing.aggregate({
        where: {
          productionOrderId: pointing.productionOrderId,
          dataFim: { not: null },
          type: 'MAO_DE_OBRA',
        },
        _sum: { quantityProduced: true },
      });

      await this.prisma.productionOrder.update({
        where: { id: pointing.productionOrderId },
        data: {
          quantityProduced: totalProduced._sum.quantityProduced || 0,
        },
      });
    }

    return pointing;
  }

  async remove(id: string) {
    const existing = await this.prisma.productionPointing.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Pointing ${id} not found`);
    }

    return this.prisma.productionPointing.delete({ where: { id } });
  }
}
