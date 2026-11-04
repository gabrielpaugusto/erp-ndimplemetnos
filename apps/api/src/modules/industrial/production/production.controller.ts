import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('production')
export class ProductionController {
  @Get()
  status() { return { module: 'Production', status: 'active' }; }
}
