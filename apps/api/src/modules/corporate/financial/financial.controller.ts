import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('financial')
export class FinancialController {
  @Get()
  status() { return { module: 'Financial', status: 'active' }; }
}
