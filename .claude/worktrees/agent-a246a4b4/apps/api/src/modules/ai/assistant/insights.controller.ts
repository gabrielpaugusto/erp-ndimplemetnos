import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '@/modules/core/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/modules/core/auth/decorators/current-user.decorator';
import { InsightsService } from './insights.service';
import { CreateInsightDto } from './dto/create-insight.dto';

@Controller('ai/insights')
@UseGuards(JwtAuthGuard)
export class InsightsController {
  constructor(private readonly insightsService: InsightsService) {}

  @Get()
  getActive(@CurrentUser() user: { id: string; companyId: string }) {
    return this.insightsService.getActive(user.companyId);
  }

  @Post()
  create(
    @CurrentUser() user: { id: string; companyId: string },
    @Body() dto: CreateInsightDto,
  ) {
    return this.insightsService.create(user.companyId, user.id, dto);
  }

  @Post('generate')
  generate(@CurrentUser() user: { id: string; companyId: string }) {
    return this.insightsService.generateInsights(user.companyId, user.id);
  }

  @Patch(':id/dismiss')
  dismiss(@Param('id') id: string) {
    return this.insightsService.dismiss(id);
  }
}
