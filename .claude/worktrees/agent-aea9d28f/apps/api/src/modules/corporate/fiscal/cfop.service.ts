import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';
import { CreateCfopDto } from './dto/create-cfop.dto';
import { UpdateCfopDto } from './dto/update-cfop.dto';

@Injectable()
export class CfopService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: { search?: string; page?: string; limit?: string }) {
    const page = parseInt(query.page || '1', 10);
    const limit = parseInt(query.limit || '20', 10);
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.search) {
      where.OR = [
        { code: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.cfop.findMany({
        where,
        skip,
        take: limit,
        orderBy: { code: 'asc' },
      }),
      this.prisma.cfop.count({ where }),
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
    return this.prisma.cfop.findUniqueOrThrow({
      where: { id },
    });
  }

  async create(data: CreateCfopDto) {
    return this.prisma.cfop.create({ data });
  }

  async update(id: string, data: UpdateCfopDto) {
    return this.prisma.cfop.update({
      where: { id },
      data,
    });
  }
}
