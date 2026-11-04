import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('hr')
export class HrController {
  @Get()
  status() { return { module: 'HR', status: 'active' }; }
}
