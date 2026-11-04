import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('crm')
export class CrmController {
  @Get()
  status() { return { module: 'CRM', status: 'active' }; }
}
