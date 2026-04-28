import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../database/prisma.service';
import { JwtPayload } from './strategies/jwt.strategy';
import { randomBytes } from 'crypto';

@Injectable()
export class AuthService {
  private readonly jwtRefreshSecret: string;
  private readonly accessTokenExpiry: string;
  private readonly refreshTokenExpiry: number; // days

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    this.jwtRefreshSecret =
      this.configService.getOrThrow<string>('JWT_REFRESH_SECRET');
    this.accessTokenExpiry = this.configService.get<string>(
      'JWT_ACCESS_EXPIRY',
      '15m',
    );
    this.refreshTokenExpiry = this.configService.get<number>(
      'JWT_REFRESH_EXPIRY_DAYS',
      7,
    );
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: { permission: true },
                },
              },
            },
          },
        },
        company: { select: { id: true, razaoSocial: true, nomeFantasia: true, cnpj: true } },
        userCompanies: {
          include: { company: { select: { id: true, razaoSocial: true, nomeFantasia: true, cnpj: true } } },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.status === 'BLOCKED') {
      throw new ForbiddenException('Account is blocked');
    }

    if (user.status === 'INACTIVE') {
      throw new ForbiddenException('Account is inactive');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new ForbiddenException(
        'Account is temporarily locked. Try again later.',
      );
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedAttempts: { increment: 1 },
          ...(user.failedAttempts + 1 >= 5 && {
            lockedUntil: new Date(Date.now() + 30 * 60 * 1000), // 30 min lockout
          }),
        },
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    // Reset failed attempts on successful login
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      },
    });

    const tokens = await this.generateTokens(user.id, user.email);

    // Flatten permissions
    const permissions = user.roles.flatMap((ur) =>
      ur.role.permissions.map((rp) => ({
        module: rp.permission.module,
        action: rp.permission.action,
      })),
    );

    const empresas = user.userCompanies.map((uc) => uc.company);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        status: user.status,
        company: user.company,
        empresas,
        roles: user.roles.map((ur) => ({
          id: ur.role.id,
          name: ur.role.name,
        })),
        permissions,
      },
    };
  }

  async switchCompany(userId: string, companyId: string) {
    // Verifica se o usuário tem acesso a essa empresa
    const vinculo = await this.prisma.userCompany.findUnique({
      where: { userId_companyId: { userId, companyId } },
      include: { company: { select: { id: true, razaoSocial: true, nomeFantasia: true, cnpj: true } } },
    });

    if (!vinculo) {
      throw new ForbiddenException('Acesso negado a esta empresa');
    }

    // Atualiza a empresa ativa do usuário
    await this.prisma.user.update({
      where: { id: userId },
      data: { companyId },
    });

    return { company: vinculo.company };
  }

  async refreshToken(token: string) {
    // Verify the refresh token JWT
    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(token, {
        secret: this.jwtRefreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Find the token in DB
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { token },
    });

    if (!storedToken) {
      throw new UnauthorizedException('Refresh token not found');
    }

    if (storedToken.revokedAt) {
      // Token reuse detected - revoke all tokens for this user
      await this.prisma.refreshToken.updateMany({
        where: { userId: storedToken.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException(
        'Refresh token has been revoked. All sessions have been terminated.',
      );
    }

    if (storedToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token has expired');
    }

    // Revoke the old token
    await this.prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revokedAt: new Date() },
    });

    // Generate new token pair
    const tokens = await this.generateTokens(payload.sub, payload.email);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  async validateUser(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: { permission: true },
                },
              },
            },
          },
        },
        company: { select: { id: true, razaoSocial: true, cnpj: true } },
      },
    });

    if (!user || user.status !== 'ACTIVE') {
      return null;
    }

    const permissions = user.roles.flatMap((ur) =>
      ur.role.permissions.map((rp) => ({
        module: rp.permission.module,
        action: rp.permission.action,
      })),
    );

    // Resolve employeeId — if this user is linked to an Employee record
    const employee = await this.prisma.employee.findFirst({
      where: { userId: user.id, companyId: user.companyId },
      select: { id: true },
    });

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      companyId: user.companyId,
      employeeId: employee?.id ?? null,
      status: user.status,
      company: user.company,
      roles: user.roles.map((ur) => ({
        id: ur.role.id,
        name: ur.role.name,
      })),
      permissions,
    };
  }

  async logout(userId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async generateTokens(userId: string, email: string) {
    const payload: JwtPayload = { sub: userId, email };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.accessTokenExpiry,
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.jwtRefreshSecret,
      expiresIn: `${this.refreshTokenExpiry}d`,
    });

    // Store refresh token in DB
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.refreshTokenExpiry);

    await this.prisma.refreshToken.create({
      data: {
        userId,
        token: refreshToken,
        expiresAt,
      },
    });

    return { accessToken, refreshToken };
  }
}
