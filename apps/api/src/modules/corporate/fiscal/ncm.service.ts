import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';
import { CreateNcmDto } from './dto/create-ncm.dto';
import { UpdateNcmDto } from './dto/update-ncm.dto';

@Injectable()
export class NcmService {
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
      this.prisma.ncm.findMany({
        where,
        skip,
        take: limit,
        orderBy: { code: 'asc' },
      }),
      this.prisma.ncm.count({ where }),
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
    return this.prisma.ncm.findUniqueOrThrow({
      where: { id },
    });
  }

  async create(data: CreateNcmDto) {
    return this.prisma.ncm.create({ data });
  }

  async update(id: string, data: UpdateNcmDto) {
    return this.prisma.ncm.update({
      where: { id },
      data,
    });
  }

  async produtosSemCest() {
    return this.prisma.product.findMany({
      where: {
        ncm: { temSt: true },
        OR: [
          { cestCode: null },
          { cestCode: '' },
        ],
      },
      select: {
        id: true,
        code: true,
        description: true,
        cestCode: true,
        ncm: { select: { code: true, description: true, cestCode: true } },
      },
      take: 100,
    });
  }
}
