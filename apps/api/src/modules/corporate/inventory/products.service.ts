import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductGroupsService } from './product-groups.service';

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly productGroupsService: ProductGroupsService,
  ) {}

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
        { description: { contains: query.search, mode: 'insensitive' } },
        { code: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.type) {
      where.type = query.type;
    }

    if (query.active !== undefined) {
      where.active = query.active === 'true';
    }

    const [data, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { description: 'asc' },
        include: {
          group: { select: { id: true, code: true, name: true } },
          subgroup: { select: { id: true, code: true, name: true } },
        },
      }),
      this.prisma.product.count({ where }),
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
    return this.prisma.product.findUniqueOrThrow({
      where: { id },
      include: {
        ncm: true,
        group: { select: { id: true, code: true, name: true } },
        subgroup: { select: { id: true, code: true, name: true } },
      },
    });
  }

  async create(companyId: string, data: CreateProductDto) {
    let code = data.code;

    // Auto-generate code if subgroupId is provided and code is not
    if (!code && data.subgroupId) {
      const result = await this.productGroupsService.generateProductCode(data.subgroupId, companyId);
      code = result.code;
    }

    if (!code) {
      throw new BadRequestException('Código do produto é obrigatório quando não há subgrupo selecionado');
    }

    return this.prisma.product.create({
      data: {
        ...data,
        code,
        type: data.type as any,
        origin: data.origin as any,
        unit: data.unit as any,
        costCenterCode: data.costCenterCode as any,
        companyId,
      },
    });
  }

  async update(id: string, data: UpdateProductDto) {
    const updateData: any = { ...data };
    return this.prisma.product.update({
      where: { id },
      data: updateData,
    });
  }

  async remove(id: string) {
    return this.prisma.product.update({
      where: { id },
      data: { active: false },
    });
  }

  async whereUsed(productId: string, companyId: string) {
    const bomItems = await this.prisma.bomItem.findMany({
      where: { productId },
      include: {
        bom: {
          include: {
            product: {
              select: {
                id: true,
                code: true,
                description: true,
                type: true,
                group: { select: { code: true, name: true } },
              },
            },
          },
        },
      },
    });

    return bomItems.map(item => ({
      bomId: item.bomId,
      bomVersion: item.bom.version,
      productoPai: item.bom.product,
      quantidade: item.quantity,
      unidade: item.unit,
      perdaPercent: item.wastagePercent,
    }));
  }
}
