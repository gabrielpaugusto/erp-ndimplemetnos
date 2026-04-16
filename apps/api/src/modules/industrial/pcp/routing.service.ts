import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';
import { CreateRoutingDto } from './dto/create-routing.dto';
import { UpdateRoutingDto } from './dto/update-routing.dto';

@Injectable()
export class RoutingService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    companyId: string,
    query: {
      search?: string;
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
        { description: { contains: query.search, mode: 'insensitive' } },
        {
          product: {
            description: { contains: query.search, mode: 'insensitive' },
          },
        },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.productionRouting.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          product: {
            select: { id: true, description: true, code: true },
          },
          _count: { select: { steps: true } },
        },
      }),
      this.prisma.productionRouting.count({ where }),
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
    const routing = await this.prisma.productionRouting.findUnique({
      where: { id },
      include: {
        product: {
          select: { id: true, description: true, code: true },
        },
        steps: {
          include: {
            workCenter: {
              select: { id: true, code: true, name: true, type: true },
            },
          },
          orderBy: { stepNumber: 'asc' },
        },
      },
    });

    if (!routing) {
      throw new NotFoundException(`Routing ${id} not found`);
    }

    return routing;
  }

  async create(companyId: string, data: CreateRoutingDto) {
    return this.prisma.$transaction(async (tx) => {
      const routing = await tx.productionRouting.create({
        data: {
          companyId,
          productId: data.productId,
          version: data.version,
          description: data.description,
          steps: {
            create: data.steps.map((step) => ({
              stepNumber: step.stepNumber,
              workCenter: { connect: { id: step.workCenterId } },
              description: step.description || '',
              tempoSetup: step.tempoSetup,
              tempoExecucao: step.tempoExecucao,
              tempoEspera: step.tempoEspera,
            })),
          },
        },
        include: {
          product: {
            select: { id: true, description: true, code: true },
          },
          steps: {
            include: {
              workCenter: {
                select: { id: true, code: true, name: true, type: true },
              },
            },
            orderBy: { stepNumber: 'asc' },
          },
        },
      });

      return routing;
    });
  }

  async update(id: string, data: UpdateRoutingDto) {
    const existing = await this.prisma.productionRouting.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Routing ${id} not found`);
    }

    return this.prisma.$transaction(async (tx) => {
      // If steps are provided, replace them
      if (data.steps) {
        await tx.routingStep.deleteMany({ where: { routingId: id } });
        await tx.routingStep.createMany({
          data: data.steps.map((step) => ({
            routingId: id,
            stepNumber: step.stepNumber,
            workCenterId: step.workCenterId,
            description: step.description || '',
            tempoSetup: step.tempoSetup,
            tempoExecucao: step.tempoExecucao,
            tempoEspera: step.tempoEspera,
          })),
        });
      }

      const updateData: any = {};
      if (data.productId !== undefined) updateData.productId = data.productId;
      if (data.version !== undefined) updateData.version = data.version;
      if (data.description !== undefined) updateData.description = data.description;

      return tx.productionRouting.update({
        where: { id },
        data: updateData,
        include: {
          product: {
            select: { id: true, description: true, code: true },
          },
          steps: {
            include: {
              workCenter: {
                select: { id: true, code: true, name: true, type: true },
              },
            },
            orderBy: { stepNumber: 'asc' },
          },
        },
      });
    });
  }

  async remove(id: string) {
    const existing = await this.prisma.productionRouting.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Routing ${id} not found`);
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.routingStep.deleteMany({ where: { routingId: id } });
      return tx.productionRouting.delete({ where: { id } });
    });
  }
}
