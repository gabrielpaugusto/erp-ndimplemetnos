import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '@/modules/core/database/prisma.service';

export interface CreateUserDto {
  name: string;
  email: string;
  cpf?: string;
  password: string;
  roleIds: string[];
}

export interface UpdateUserDto {
  name?: string;
  email?: string;
  cpf?: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'BLOCKED';
  roleIds?: string[];
}

const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  cpf: true,
  status: true,
  lastLoginAt: true,
  failedAttempts: true,
  lockedUntil: true,
  createdAt: true,
  updatedAt: true,
  roles: {
    include: {
      role: {
        select: { id: true, name: true, description: true, isSystem: true },
      },
    },
  },
};

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  // -----------------------------------------------------------------------
  // List
  // -----------------------------------------------------------------------

  async findAll(
    companyId: string,
    opts: { search?: string; status?: string; page?: string; limit?: string },
  ) {
    const take = Math.min(Number(opts.limit) || 50, 200);
    const skip = (Math.max(Number(opts.page) || 1, 1) - 1) * take;

    const where: Record<string, unknown> = { companyId };
    if (opts.status) where.status = opts.status;
    if (opts.search) {
      where.OR = [
        { name: { contains: opts.search, mode: 'insensitive' } },
        { email: { contains: opts.search, mode: 'insensitive' } },
        { cpf: { contains: opts.search } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: USER_SELECT,
        orderBy: { name: 'asc' },
        skip,
        take,
      }),
      this.prisma.user.count({ where }),
    ]);

    return { data, total, page: Number(opts.page) || 1, limit: take };
  }

  // -----------------------------------------------------------------------
  // Get one
  // -----------------------------------------------------------------------

  async findOne(companyId: string, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, companyId },
      select: USER_SELECT,
    });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    return user;
  }

  // -----------------------------------------------------------------------
  // Create
  // -----------------------------------------------------------------------

  async create(companyId: string, dto: CreateUserDto) {
    if (!dto.name?.trim()) throw new BadRequestException('Nome é obrigatório');
    if (!dto.email?.trim()) throw new BadRequestException('E-mail é obrigatório');
    if (!dto.password || dto.password.length < 6)
      throw new BadRequestException('Senha deve ter no mínimo 6 caracteres');

    // Verifica duplicata de e-mail
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    if (existing) throw new ConflictException('E-mail já cadastrado');

    // Verifica duplicata de CPF
    if (dto.cpf) {
      const cpfOnly = dto.cpf.replace(/\D/g, '');
      const existingCpf = await this.prisma.user.findUnique({ where: { cpf: cpfOnly } });
      if (existingCpf) throw new ConflictException('CPF já cadastrado');
    }

    // Valida roles
    if (dto.roleIds?.length) {
      const roles = await this.prisma.role.findMany({ where: { id: { in: dto.roleIds } } });
      if (roles.length !== dto.roleIds.length)
        throw new BadRequestException('Uma ou mais permissões (roles) não encontradas');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.user.create({
      data: {
        companyId,
        name: dto.name.trim(),
        email: dto.email.toLowerCase().trim(),
        cpf: dto.cpf ? dto.cpf.replace(/\D/g, '') : undefined,
        passwordHash,
        status: 'ACTIVE',
        roles: dto.roleIds?.length
          ? { create: dto.roleIds.map((roleId) => ({ role: { connect: { id: roleId } } })) }
          : undefined,
      },
      select: USER_SELECT,
    });

    return user;
  }

  // -----------------------------------------------------------------------
  // Update
  // -----------------------------------------------------------------------

  async update(companyId: string, userId: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.findFirst({ where: { id: userId, companyId } });
    if (!user) throw new NotFoundException('Usuário não encontrado');

    // Verifica duplicata de e-mail
    if (dto.email && dto.email.toLowerCase() !== user.email) {
      const existing = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
      if (existing) throw new ConflictException('E-mail já cadastrado por outro usuário');
    }

    // Verifica duplicata de CPF
    if (dto.cpf) {
      const cpfOnly = dto.cpf.replace(/\D/g, '');
      if (cpfOnly !== user.cpf) {
        const existingCpf = await this.prisma.user.findUnique({ where: { cpf: cpfOnly } });
        if (existingCpf) throw new ConflictException('CPF já cadastrado por outro usuário');
      }
    }

    // Atualiza roles se informado
    if (dto.roleIds !== undefined) {
      // Apaga todas e recria
      await this.prisma.userRole.deleteMany({ where: { userId } });
      if (dto.roleIds.length) {
        await this.prisma.userRole.createMany({
          data: dto.roleIds.map((roleId) => ({ userId, roleId })),
        });
      }
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.name && { name: dto.name.trim() }),
        ...(dto.email && { email: dto.email.toLowerCase().trim() }),
        ...(dto.cpf !== undefined && { cpf: dto.cpf ? dto.cpf.replace(/\D/g, '') : null }),
        ...(dto.status && { status: dto.status }),
        // Reset lock on manual activation
        ...(dto.status === 'ACTIVE' && { failedAttempts: 0, lockedUntil: null }),
      },
      select: USER_SELECT,
    });

    return updated;
  }

  // -----------------------------------------------------------------------
  // Reset password
  // -----------------------------------------------------------------------

  async resetPassword(companyId: string, userId: string, newPassword: string) {
    if (!newPassword || newPassword.length < 6)
      throw new BadRequestException('Senha deve ter no mínimo 6 caracteres');

    const user = await this.prisma.user.findFirst({ where: { id: userId, companyId } });
    if (!user) throw new NotFoundException('Usuário não encontrado');

    const passwordHash = await bcrypt.hash(newPassword, 12);

    // Revoga todos os refresh tokens ativos
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, failedAttempts: 0, lockedUntil: null },
    });

    return { ok: true, message: 'Senha redefinida com sucesso. O usuário precisará fazer login novamente.' };
  }

  // -----------------------------------------------------------------------
  // Roles disponíveis para atribuição
  // -----------------------------------------------------------------------

  async findRoles() {
    return this.prisma.role.findMany({
      select: { id: true, name: true, description: true, isSystem: true },
      orderBy: { name: 'asc' },
    });
  }
}
