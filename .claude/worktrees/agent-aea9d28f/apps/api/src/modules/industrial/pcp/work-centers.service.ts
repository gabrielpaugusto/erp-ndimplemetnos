import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';
import { CreateWorkCenterDto } from './dto/create-work-center.dto';
import { UpdateWorkCenterDto } from './dto/update-work-center.dto';

@Injectable()
export class WorkCentersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    companyId: string,
    query: {
      search?: string;
      type?: string;
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
        { code: { contains: query.search, mode: 'insensitive' } },
        { name: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.type) {
      where.type = query.type;
    }

    const [data, total] = await Promise.all([
      this.prisma.workCenter.findMany({
        where,
        skip,
        take: limit,
        orderBy: { code: 'asc' },
      }),
      this.prisma.workCenter.count({ where }),
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
    const workCenter = await this.prisma.workCenter.findUnique({
      where: { id },
    });

    if (!workCenter) {
      throw new NotFoundException(`WorkCenter ${id} not found`);
    }

    return workCenter;
  }

  async create(companyId: string, data: CreateWorkCenterDto) {
    return this.prisma.workCenter.create({
      data: {
        companyId,
        code: data.code,
        name: data.name,
        type: data.type as any,
        description: data.description,
        capacidadeHora: data.capacidadeHora,
        custoHora: data.custoHora,
      },
    });
  }

  async update(id: string, data: UpdateWorkCenterDto) {
    const existing = await this.prisma.workCenter.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`WorkCenter ${id} not found`);
    }

    return this.prisma.workCenter.update({
      where: { id },
      data,
    });
  }

  async remove(id: string) {
    const existing = await this.prisma.workCenter.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`WorkCenter ${id} not found`);
    }

    return this.prisma.workCenter.delete({ where: { id } });
  }
}
