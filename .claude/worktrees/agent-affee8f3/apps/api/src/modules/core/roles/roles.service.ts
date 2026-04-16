import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';

export interface CreateRoleDto {
  name: string;
  description?: string;
  permissionIds: string[];
}

export interface UpdateRoleDto {
  name?: string;
  description?: string;
  permissionIds?: string[];
}

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  // -----------------------------------------------------------------------
  // Listar todas as roles
  // -----------------------------------------------------------------------
  async findAll() {
    return this.prisma.role.findMany({
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
        _count: { select: { users: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  // -----------------------------------------------------------------------
  // Detalhe de uma role
  // -----------------------------------------------------------------------
  async findOne(roleId: string) {
    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
      include: {
        permissions: { include: { permission: true } },
        _count: { select: { users: true } },
      },
    });
    if (!role) throw new NotFoundException('Perfil não encontrado');
    return role;
  }

  // -----------------------------------------------------------------------
  // Listar todas as permissões disponíveis
  // -----------------------------------------------------------------------
  async findAllPermissions() {
    return this.prisma.permission.findMany({
      orderBy: [{ module: 'asc' }, { action: 'asc' }],
    });
  }

  // -----------------------------------------------------------------------
  // Criar nova role
  // -----------------------------------------------------------------------
  async create(dto: CreateRoleDto) {
    if (!dto.name?.trim()) throw new BadRequestException('Nome do perfil é obrigatório');

    const existing = await this.prisma.role.findUnique({ where: { name: dto.name.trim().toUpperCase() } });
    if (existing) throw new ConflictException('Já existe um perfil com este nome');

    // Valida permissões
    if (dto.permissionIds?.length) {
      const perms = await this.prisma.permission.findMany({ where: { id: { in: dto.permissionIds } } });
      if (perms.length !== dto.permissionIds.length)
        throw new BadRequestException('Uma ou mais permissões não encontradas');
    }

    return this.prisma.role.create({
      data: {
        name: dto.name.trim().toUpperCase(),
        description: dto.description?.trim(),
        isSystem: false,
        permissions: dto.permissionIds?.length
          ? { create: dto.permissionIds.map((permissionId) => ({ permission: { connect: { id: permissionId } } })) }
          : undefined,
      },
      include: {
        permissions: { include: { permission: true } },
        _count: { select: { users: true } },
      },
    });
  }

  // -----------------------------------------------------------------------
  // Atualizar role (nome, descrição, permissões)
  // -----------------------------------------------------------------------
  async update(roleId: string, dto: UpdateRoleDto) {
    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (!role) throw new NotFoundException('Perfil não encontrado');

    // Roles de sistema: não podem mudar o nome nem ser deletadas
    if (role.isSystem && dto.name && dto.name.trim().toUpperCase() !== role.name) {
      throw new ForbiddenException('Perfis de sistema não podem ter o nome alterado');
    }

    // Verifica duplicata de nome
    if (dto.name && dto.name.trim().toUpperCase() !== role.name) {
      const existing = await this.prisma.role.findUnique({ where: { name: dto.name.trim().toUpperCase() } });
      if (existing) throw new ConflictException('Já existe um perfil com este nome');
    }

    // Atualiza permissões se informadas
    if (dto.permissionIds !== undefined) {
      await this.prisma.rolePermission.deleteMany({ where: { roleId } });
      if (dto.permissionIds.length) {
        await this.prisma.rolePermission.createMany({
          data: dto.permissionIds.map((permissionId) => ({ roleId, permissionId })),
          skipDuplicates: true,
        });
      }
    }

    return this.prisma.role.update({
      where: { id: roleId },
      data: {
        ...(dto.name && { name: dto.name.trim().toUpperCase() }),
        ...(dto.description !== undefined && { description: dto.description?.trim() }),
      },
      include: {
        permissions: { include: { permission: true } },
        _count: { select: { users: true } },
      },
    });
  }

  // -----------------------------------------------------------------------
  // Deletar role (nunca as de sistema)
  // -----------------------------------------------------------------------
  async remove(roleId: string) {
    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
      include: { _count: { select: { users: true } } },
    });
    if (!role) throw new NotFoundException('Perfil não encontrado');
    if (role.isSystem) throw new ForbiddenException('Perfis de sistema não podem ser removidos');
    if (role._count.users > 0)
      throw new BadRequestException(
        `Este perfil está atribuído a ${role._count.users} usuário(s). Remova-o dos usuários antes de excluir.`,
      );

    await this.prisma.rolePermission.deleteMany({ where: { roleId } });
    await this.prisma.role.delete({ where: { id: roleId } });
    return { ok: true };
  }
}
