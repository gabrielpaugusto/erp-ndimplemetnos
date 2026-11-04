import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('pcp')
export class PcpController {
  @Get()
  status() { return { module: 'PCP', status: 'active' }; }
}
