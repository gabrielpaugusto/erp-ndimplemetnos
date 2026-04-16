import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';
import { CreateBomDto } from './dto/create-bom.dto';
import { UpdateBomDto } from './dto/update-bom.dto';

@Injectable()
export class BomService {
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
      this.prisma.billOfMaterial.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          product: {
            select: { id: true, description: true, code: true },
          },
          _count: { select: { items: true } },
        },
      }),
      this.prisma.billOfMaterial.count({ where }),
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
    const bom = await this.prisma.billOfMaterial.findUnique({
      where: { id },
      include: {
        product: {
          select: { id: true, description: true, code: true },
        },
        items: {
          include: {
            product: {
              select: { id: true, description: true, code: true, unit: true },
            },
          },
        },
      },
    });

    if (!bom) {
      throw new NotFoundException(`BOM ${id} not found`);
    }

    return bom;
  }

  async create(companyId: string, data: CreateBomDto) {
    return this.prisma.$transaction(async (tx) => {
      const bom = await tx.billOfMaterial.create({
        data: {
          companyId,
          productId: data.productId,
          version: data.version,
          description: data.description,
          items: {
            create: data.items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              unit: item.unit,
              wastagePercent: item.wastagePercent,
            })),
          },
        },
        include: {
          product: {
            select: { id: true, description: true, code: true },
          },
          items: {
            include: {
              product: {
                select: { id: true, description: true, code: true, unit: true },
              },
            },
          },
        },
      });

      return bom;
    });
  }

  async update(id: string, data: UpdateBomDto) {
    const existing = await this.prisma.billOfMaterial.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`BOM ${id} not found`);
    }

    return this.prisma.$transaction(async (tx) => {
      // If items are provided, replace them
      if (data.items) {
        await tx.bomItem.deleteMany({ where: { bomId: id } });
        await tx.bomItem.createMany({
          data: data.items.map((item) => ({
            bomId: id,
            productId: item.productId,
            quantity: item.quantity,
            unit: item.unit,
            wastagePercent: item.wastagePercent,
          })),
        });
      }

      const updateData: any = {};
      if (data.productId !== undefined) updateData.productId = data.productId;
      if (data.version !== undefined) updateData.version = data.version;
      if (data.description !== undefined) updateData.description = data.description;

      return tx.billOfMaterial.update({
        where: { id },
        data: updateData,
        include: {
          product: {
            select: { id: true, description: true, code: true },
          },
          items: {
            include: {
              product: {
                select: { id: true, description: true, code: true, unit: true },
              },
            },
          },
        },
      });
    });
  }

  async remove(id: string) {
    const existing = await this.prisma.billOfMaterial.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`BOM ${id} not found`);
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.bomItem.deleteMany({ where: { bomId: id } });
      return tx.billOfMaterial.delete({ where: { id } });
    });
  }

  /**
   * Recursive BOM explosion — returns a flat list of all leaf-level
   * materials needed for production, with accumulated quantities.
   */
  async explode(id: string) {
    const bom = await this.prisma.billOfMaterial.findUnique({
      where: { id },
      include: {
        product: {
          select: { id: true, description: true, code: true },
        },
        items: {
          include: {
            product: {
              select: { id: true, description: true, code: true, unit: true },
            },
          },
        },
      },
    });

    if (!bom) {
      throw new NotFoundException(`BOM ${id} not found`);
    }

    const exploded: Array<{
      productId: string;
      productDescription: string;
      productCode: string;
      unit: string;
      quantity: number;
      level: number;
      path: string[];
    }> = [];

    await this.explodeRecursive(bom.items, 1, [bom.product.description], 1, exploded);

    return {
      bom: {
        id: bom.id,
        productId: bom.productId,
        productDescription: bom.product.description,
        version: bom.version,
      },
      items: exploded,
    };
  }

  private async explodeRecursive(
    items: any[],
    parentQuantity: number,
    path: string[],
    level: number,
    result: any[],
  ) {
    for (const item of items) {
      const effectiveQuantity =
        item.quantity * parentQuantity * (1 + (item.wastagePercent || 0) / 100);

      // Check if this item has its own BOM (sub-assembly)
      const childBom = await this.prisma.billOfMaterial.findFirst({
        where: { productId: item.productId },
        include: {
          items: {
            include: {
              product: {
                select: { id: true, description: true, code: true, unit: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      const currentPath = [...path, item.product.description];

      result.push({
        productId: item.productId,
        productDescription: item.product.description,
        productCode: item.product.code,
        unit: item.unit || item.product.unit,
        quantity: effectiveQuantity,
        level,
        path: currentPath,
      });

      if (childBom && childBom.items.length > 0) {
        await this.explodeRecursive(
          childBom.items,
          effectiveQuantity,
          currentPath,
          level + 1,
          result,
        );
      }
    }
  }
}
