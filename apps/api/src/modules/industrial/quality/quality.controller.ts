import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('quality')
export class QualityController {
  @Get()
  status() { return { module: 'Quality', status: 'active' }; }
}
