import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';
import { PRODUCT_GROUPS_SEED } from './product-groups.seed';

@Injectable()
export class ProductGroupsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllGroups(companyId: string) {
    return this.prisma.productGroup.findMany({
      where: { companyId, active: true },
      include: {
        subgroups: {
          where: { active: true },
          orderBy: { code: 'asc' },
        },
        _count: { select: { products: true } },
      },
      orderBy: { code: 'asc' },
    });
  }

  async findSubgroupsByGroup(groupId: string, companyId: string) {
    return this.prisma.productSubgroup.findMany({
      where: { groupId, companyId, active: true },
      orderBy: { code: 'asc' },
    });
  }

  async createGroup(companyId: string, data: { code: string; name: string; description?: string }) {
    return this.prisma.productGroup.create({
      data: { companyId, ...data },
    });
  }

  async createSubgroup(companyId: string, data: { groupId: string; code: string; name: string; description?: string }) {
    return this.prisma.productSubgroup.create({
      data: { companyId, ...data },
    });
  }

  async updateGroup(id: string, data: { name?: string; description?: string; active?: boolean }) {
    return this.prisma.productGroup.update({ where: { id }, data });
  }

  async updateSubgroup(id: string, data: { name?: string; description?: string; active?: boolean }) {
    return this.prisma.productSubgroup.update({ where: { id }, data });
  }

  async deleteGroup(id: string, companyId: string) {
    const group = await this.prisma.productGroup.findFirst({ where: { id, companyId } });
    if (!group) throw new NotFoundException('Grupo não encontrado');
    const productCount = await this.prisma.product.count({ where: { groupId: id, active: true } });
    if (productCount > 0) {
      throw new BadRequestException(
        `Este grupo possui ${productCount} produto(s) ativo(s) vinculado(s). Desvincule ou inative os produtos antes de excluir o grupo.`,
      );
    }
    // Soft-delete: inativa grupo e todos os subgrupos
    await this.prisma.productSubgroup.updateMany({ where: { groupId: id }, data: { active: false } });
    return this.prisma.productGroup.update({ where: { id }, data: { active: false } });
  }

  async deleteSubgroup(id: string, companyId: string) {
    const sub = await this.prisma.productSubgroup.findFirst({ where: { id, companyId } });
    if (!sub) throw new NotFoundException('Subgrupo não encontrado');
    const productCount = await this.prisma.product.count({ where: { subgroupId: id, active: true } });
    if (productCount > 0) {
      throw new BadRequestException(
        `Este subgrupo possui ${productCount} produto(s) ativo(s) vinculado(s). Desvincule ou inative os produtos antes de excluir o subgrupo.`,
      );
    }
    return this.prisma.productSubgroup.update({ where: { id }, data: { active: false } });
  }

  // Gera o próximo código GG.SS.NNNN para um subgrupo
  async generateProductCode(subgroupId: string, companyId: string): Promise<{ code: string }> {
    const subgroup = await this.prisma.productSubgroup.findUnique({
      where: { id: subgroupId },
      include: { group: true },
    });
    if (!subgroup) throw new NotFoundException('Subgrupo não encontrado');

    const gg = subgroup.group.code.padStart(2, '0');
    const ss = subgroup.code.padStart(2, '0');
    const prefix = `${gg}.${ss}.`;

    // Busca o maior sequencial existente para este prefixo nesta empresa
    const last = await this.prisma.product.findFirst({
      where: {
        companyId,
        code: { startsWith: prefix },
      },
      orderBy: { code: 'desc' },
    });

    let seq = 1;
    if (last) {
      const parts = last.code.split('.');
      const lastSeq = parseInt(parts[2] || '0', 10);
      if (!isNaN(lastSeq)) seq = lastSeq + 1;
    }

    return { code: `${prefix}${seq.toString().padStart(4, '0')}` };
  }

  // Seed de produtos genéricos do grupo 08
  async seedGenericProducts(companyId: string) {
    const { GENERIC_PRODUCTS_SEED } = await import('./generic-products.seed');
    let created = 0;

    for (const item of GENERIC_PRODUCTS_SEED) {
      const group = await this.prisma.productGroup.findFirst({
        where: { companyId, code: item.groupCode },
      });
      if (!group) continue;

      const subgroup = await this.prisma.productSubgroup.findFirst({
        where: { groupId: group.id, code: item.subgroupCode },
      });
      if (!subgroup) continue;

      const code = `${item.groupCode}.${item.subgroupCode}.${item.seq}`;
      const exists = await this.prisma.product.findFirst({ where: { companyId, code } });
      if (exists) continue;

      await this.prisma.product.create({
        data: {
          companyId,
          code,
          description: item.description,
          type: 'CONSUMIVEL' as any,
          unit: 'UN' as any,
          groupId: group.id,
          subgroupId: subgroup.id,
          controlaEstoque: false,
          usoConsumo: true,
          costCenterCode: item.costCenterCode as any,
          active: true,
        },
      });
      created++;
    }
    return { message: `${created} produtos genéricos do grupo 08 criados.` };
  }

  // Seed inicial dos grupos/subgrupos para uma empresa
  async seedForCompany(companyId: string) {
    for (const g of PRODUCT_GROUPS_SEED) {
      const existing = await this.prisma.productGroup.findFirst({
        where: { companyId, code: g.code },
      });
      if (existing) continue;

      const group = await this.prisma.productGroup.create({
        data: { companyId, code: g.code, name: g.name, description: g.description },
      });

      for (const s of g.subgroups) {
        await this.prisma.productSubgroup.create({
          data: { companyId, groupId: group.id, code: s.code, name: s.name },
        });
      }
    }
    return { message: 'Grupos e subgrupos inicializados com sucesso' };
  }
}
