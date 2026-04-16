import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '@/modules/core/database/prisma.service';

@Injectable()
export class PortalAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('Token not provided');
    }

    try {
      const payload = this.jwtService.verify(token, {
        secret: this.configService.getOrThrow<string>('JWT_SECRET'),
      });

      // Must be a portal token
      if (!payload.portalUserId) {
        throw new UnauthorizedException('Invalid portal token');
      }

      const portalUser = await this.prisma.portalUser.findUnique({
        where: { id: payload.portalUserId },
        include: {
          person: {
            select: { id: true, razaoSocial: true, cpfCnpj: true },
          },
        },
      });

      if (!portalUser || !portalUser.active) {
        throw new UnauthorizedException('Portal user not found or inactive');
      }

      request.portalUser = {
        id: portalUser.id,
        companyId: portalUser.companyId,
        personId: portalUser.personId,
        email: portalUser.email,
        name: portalUser.name,
        accessLevel: portalUser.accessLevel,
        person: portalUser.person,
      };

      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private extractTokenFromHeader(request: any): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
