import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('fi')
export class FiController {
  @Get()
  status() { return { module: 'FI', status: 'active' }; }
}
