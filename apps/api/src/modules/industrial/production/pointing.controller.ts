import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '@/modules/core/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/modules/core/auth/decorators/current-user.decorator';
import { PointingService } from './pointing.service';
import { CreatePointingDto } from './dto/create-pointing.dto';
import { UpdatePointingDto } from './dto/update-pointing.dto';

@Controller('production/pointing')
@UseGuards(JwtAuthGuard)
export class PointingController {
  constructor(private readonly pointingService: PointingService) {}

  @Get()
  findAll(
    @CurrentUser() user: { id: string; companyId: string },
    @Query('productionOrderId') productionOrderId?: string,
    @Query('workCenterId') workCenterId?: string,
    @Query('type') type?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.pointingService.findAll(user.companyId, {
      productionOrderId,
      workCenterId,
      type,
      startDate,
      endDate,
      page,
      limit,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.pointingService.findOne(id);
  }

  @Post()
  create(
    @CurrentUser() user: { id: string; companyId: string },
    @Body() createPointingDto: CreatePointingDto,
  ) {
    return this.pointingService.create(
      user.companyId,
      user.id,
      createPointingDto,
    );
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updatePointingDto: UpdatePointingDto,
  ) {
    return this.pointingService.update(id, updatePointingDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.pointingService.remove(id);
  }
}
