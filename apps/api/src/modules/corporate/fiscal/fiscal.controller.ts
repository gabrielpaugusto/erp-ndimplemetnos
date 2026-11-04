import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('fiscal')
export class FiscalController {
  @Get()
  status() { return { module: 'Fiscal', status: 'active' }; }
}
