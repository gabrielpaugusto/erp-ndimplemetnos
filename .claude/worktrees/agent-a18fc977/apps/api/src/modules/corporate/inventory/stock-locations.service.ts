import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';
import { CreateStockLocationDto } from './dto/create-stock-location.dto';
import { UpdateStockLocationDto } from './dto/update-stock-location.dto';

@Injectable()
export class StockLocationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    companyId: string,
    query: {
      search?: string;
      type?: string;
      active?: string;
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

    if (query.active !== undefined) {
      where.active = query.active === 'true';
    }

    const [data, total] = await Promise.all([
      this.prisma.stockLocation.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        include: {
          _count: {
            select: { stockBalances: true },
          },
        },
      }),
      this.prisma.stockLocation.count({ where }),
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
    const location = await this.prisma.stockLocation.findUnique({
      where: { id },
      include: {
        stockBalances: {
          include: {
            product: {
              select: { id: true, code: true, description: true, unit: true },
            },
          },
        },
      },
    });

    if (!location) {
      throw new NotFoundException(`Stock location ${id} not found`);
    }

    return location;
  }

  async create(companyId: string, data: CreateStockLocationDto) {
    return this.prisma.stockLocation.create({
      data: {
        companyId,
        code: data.code,
        name: data.name,
        description: data.description,
        type: data.type,
      },
    });
  }

  async update(id: string, data: UpdateStockLocationDto) {
    const existing = await this.prisma.stockLocation.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Stock location ${id} not found`);
    }

    return this.prisma.stockLocation.update({
      where: { id },
      data,
    });
  }

  async remove(id: string) {
    const existing = await this.prisma.stockLocation.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Stock location ${id} not found`);
    }

    return this.prisma.stockLocation.update({
      where: { id },
      data: { active: false },
    });
  }
}
