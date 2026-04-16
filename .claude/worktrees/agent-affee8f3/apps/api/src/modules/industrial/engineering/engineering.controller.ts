import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/modules/core/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/modules/core/auth/decorators/current-user.decorator';
import { EngineeringService } from './engineering.service';

@Controller('engineering')
@UseGuards(JwtAuthGuard)
export class EngineeringController {
  constructor(private readonly engineeringService: EngineeringService) {}

  // Status do módulo
  @Get()
  status() { return { module: 'Engineering', status: 'active' }; }

  // Dashboard consolidado de engenharia
  @Get('dashboard')
  getDashboard(@CurrentUser() user: { companyId: string }) {
    return this.engineeringService.getDashboard(user.companyId);
  }

  // Lista de produtos com indicação de BOM e Roteiro
  @Get('products')
  getProducts(
    @CurrentUser() user: { companyId: string },
    @Query('search') search?: string,
    @Query('type')   type?: string,
    @Query('page')   page?: string,
    @Query('limit')  limit?: string,
  ) {
    return this.engineeringService.getProductsWithEngineering(user.companyId, {
      search, type, page, limit,
    });
  }
}
