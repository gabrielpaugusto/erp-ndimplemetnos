import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '@/modules/core/database/prisma.service';
import { PortalLoginDto } from './dto/portal-login.dto';
import { PortalRegisterDto } from './dto/portal-register.dto';

@Injectable()
export class PortalAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: PortalLoginDto) {
    const portalUser = await this.prisma.portalUser.findFirst({
      where: { email: dto.email },
      include: {
        person: {
          select: { id: true, razaoSocial: true, cpfCnpj: true },
        },
      },
    });

    if (!portalUser) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!portalUser.active) {
      throw new UnauthorizedException('Account is inactive');
    }

    const isPasswordValid = await bcrypt.compare(
      dto.password,
      portalUser.passwordHash,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Update last login
    await this.prisma.portalUser.update({
      where: { id: portalUser.id },
      data: { lastLoginAt: new Date() },
    });

    const payload = {
      portalUserId: portalUser.id,
      companyId: portalUser.companyId,
      personId: portalUser.personId,
      email: portalUser.email,
    };

    const accessToken = this.jwtService.sign(payload, { expiresIn: '8h' });

    return {
      accessToken,
      user: {
        id: portalUser.id,
        email: portalUser.email,
        name: portalUser.name,
        accessLevel: portalUser.accessLevel,
        person: portalUser.person,
      },
    };
  }

  async register(companyId: string, dto: PortalRegisterDto) {
    // Validate person exists
    const person = await this.prisma.person.findUnique({
      where: { id: dto.personId },
    });

    if (!person) {
      throw new NotFoundException(`Person ${dto.personId} not found`);
    }

    // Check if email is already registered for this company
    const existing = await this.prisma.portalUser.findFirst({
      where: { companyId, email: dto.email },
    });

    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const portalUser = await this.prisma.portalUser.create({
      data: {
        companyId,
        personId: dto.personId,
        email: dto.email,
        passwordHash,
        name: dto.name,
      },
      select: {
        id: true,
        email: true,
        name: true,
        accessLevel: true,
        createdAt: true,
      },
    });

    return portalUser;
  }
}
