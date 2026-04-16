import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '@/modules/core/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/modules/core/auth/decorators/current-user.decorator';
import { StockAlertsService } from './stock-alerts.service';
import { IsArray, IsString } from 'class-validator';

class GenerateRequisitionsDto {
  @IsArray()
  @IsString({ each: true })
  productIds: string[];
}

@Controller('inventory/alerts')
@UseGuards(JwtAuthGuard)
export class StockAlertsController {
  constructor(private readonly stockAlertsService: StockAlertsService) {}

  @Get()
  getAlerts(@CurrentUser() user: { id: string; companyId: string }) {
    return this.stockAlertsService.getAlerts(user.companyId);
  }

  @Post('generate-requisitions')
  generateRequisitions(
    @CurrentUser() user: { id: string; companyId: string },
    @Body() dto: GenerateRequisitionsDto,
  ) {
    return this.stockAlertsService.generateRequisitions(
      user.companyId,
      user.id,
      dto.productIds,
    );
  }
}
