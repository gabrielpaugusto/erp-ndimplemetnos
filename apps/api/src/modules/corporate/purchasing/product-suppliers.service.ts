import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';
import { CreateProductSupplierDto } from './dto/create-product-supplier.dto';
import { UpdateProductSupplierDto } from './dto/update-product-supplier.dto';

@Injectable()
export class ProductSuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    companyId: string,
    query: {
      productId?: string;
      personId?: string;
      search?: string;
      page?: string;
      limit?: string;
    },
  ) {
    const page = parseInt(query.page || '1', 10);
    const limit = parseInt(query.limit || '20', 10);
    const skip = (page - 1) * limit;

    const where: any = { companyId };

    if (query.productId) {
      where.productId = query.productId;
    }

    if (query.personId) {
      where.personId = query.personId;
    }

    if (query.search) {
      where.OR = [
        { codigoFornecedor: { contains: query.search, mode: 'insensitive' } },
        { descricaoFornecedor: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.productSupplier.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ preferred: 'desc' }, { createdAt: 'desc' }],
        include: {
          product: {
            select: { id: true, code: true, description: true, unit: true },
          },
          person: {
            select: { id: true, razaoSocial: true, nomeFantasia: true, cpfCnpj: true },
          },
        },
      }),
      this.prisma.productSupplier.count({ where }),
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

  async findBySupplierCode(
    companyId: string,
    personId: string,
    codigoFornecedor: string,
  ) {
    return this.prisma.productSupplier.findFirst({
      where: { companyId, personId, codigoFornecedor },
      include: {
        product: {
          select: { id: true, code: true, description: true, unit: true },
        },
        person: {
          select: { id: true, razaoSocial: true, nomeFantasia: true },
        },
      },
    });
  }

  async findByProduct(companyId: string, productId: string) {
    return this.prisma.productSupplier.findMany({
      where: { companyId, productId },
      orderBy: [{ preferred: 'desc' }, { precoUltCompra: 'asc' }],
      include: {
        person: {
          select: {
            id: true,
            razaoSocial: true,
            nomeFantasia: true,
            cpfCnpj: true,
          },
        },
      },
    });
  }

  async create(companyId: string, dto: CreateProductSupplierDto) {
    // Upsert on [companyId, productId, personId] unique
    return this.prisma.productSupplier.upsert({
      where: {
        companyId_productId_personId: {
          companyId,
          productId: dto.productId,
          personId: dto.personId,
        },
      },
      create: {
        companyId,
        productId: dto.productId,
        personId: dto.personId,
        codigoFornecedor: dto.codigoFornecedor,
        descricaoFornecedor: dto.descricaoFornecedor,
        unidadeFornecedor: dto.unidadeFornecedor,
        fatorConversao: dto.fatorConversao ?? 1,
        precoUltCompra: dto.precoUltCompra,
        prazoEntregaDias: dto.prazoEntregaDias,
        preferred: dto.preferred ?? false,
      },
      update: {
        codigoFornecedor: dto.codigoFornecedor,
        descricaoFornecedor: dto.descricaoFornecedor,
        unidadeFornecedor: dto.unidadeFornecedor,
        fatorConversao: dto.fatorConversao,
        precoUltCompra: dto.precoUltCompra,
        prazoEntregaDias: dto.prazoEntregaDias,
        preferred: dto.preferred,
      },
      include: {
        product: {
          select: { id: true, code: true, description: true, unit: true },
        },
        person: {
          select: { id: true, razaoSocial: true, nomeFantasia: true },
        },
      },
    });
  }

  async update(id: string, dto: UpdateProductSupplierDto) {
    const existing = await this.prisma.productSupplier.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`ProductSupplier ${id} not found`);
    }

    const updateData: any = {};
    if (dto.codigoFornecedor !== undefined) updateData.codigoFornecedor = dto.codigoFornecedor;
    if (dto.descricaoFornecedor !== undefined) updateData.descricaoFornecedor = dto.descricaoFornecedor;
    if (dto.unidadeFornecedor !== undefined) updateData.unidadeFornecedor = dto.unidadeFornecedor;
    if (dto.fatorConversao !== undefined) updateData.fatorConversao = dto.fatorConversao;
    if (dto.precoUltCompra !== undefined) updateData.precoUltCompra = dto.precoUltCompra;
    if (dto.prazoEntregaDias !== undefined) updateData.prazoEntregaDias = dto.prazoEntregaDias;
    if (dto.preferred !== undefined) updateData.preferred = dto.preferred;

    return this.prisma.productSupplier.update({
      where: { id },
      data: updateData,
      include: {
        product: {
          select: { id: true, code: true, description: true, unit: true },
        },
        person: {
          select: { id: true, razaoSocial: true, nomeFantasia: true },
        },
      },
    });
  }

  async remove(id: string) {
    const existing = await this.prisma.productSupplier.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`ProductSupplier ${id} not found`);
    }

    await this.prisma.productSupplier.delete({ where: { id } });
    return { success: true, id };
  }
}
