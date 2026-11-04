import { Controller, Get, Delete, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/modules/core/auth/decorators/current-user.decorator';
import { FiService } from './fi.service';

@UseGuards(JwtAuthGuard)
@Controller('fi')
export class FiController {
  constructor(private readonly service: FiService) {}

  @Get()
  status() { return { module: 'FI', status: 'active' }; }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.remove(id, user.companyId);
  }
}
