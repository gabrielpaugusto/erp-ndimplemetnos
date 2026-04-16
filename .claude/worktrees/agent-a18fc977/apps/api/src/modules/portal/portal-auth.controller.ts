import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/modules/core/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/modules/core/auth/decorators/current-user.decorator';
import { PortalAuthService } from './portal-auth.service';
import { PortalLoginDto } from './dto/portal-login.dto';
import { PortalRegisterDto } from './dto/portal-register.dto';

@Controller('portal/auth')
export class PortalAuthController {
  constructor(private readonly portalAuthService: PortalAuthService) {}

  @Post('login')
  login(@Body() dto: PortalLoginDto) {
    return this.portalAuthService.login(dto);
  }

  @Post('register')
  @UseGuards(JwtAuthGuard)
  register(
    @CurrentUser() user: { id: string; companyId: string },
    @Body() dto: PortalRegisterDto,
  ) {
    return this.portalAuthService.register(user.companyId, dto);
  }
}
