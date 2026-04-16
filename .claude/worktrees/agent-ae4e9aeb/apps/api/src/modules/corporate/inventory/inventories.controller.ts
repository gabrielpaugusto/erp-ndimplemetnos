import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '@/modules/core/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/modules/core/auth/decorators/current-user.decorator';
import { InventoriesService } from './inventories.service';
import { CreateInventoryDto } from './dto/create-inventory.dto';
import { CountInventoryItemDto } from './dto/count-inventory-item.dto';

@Controller('inventory/inventories')
@UseGuards(JwtAuthGuard)
export class InventoriesController {
  constructor(private readonly inventoriesService: InventoriesService) {}

  @Get()
  findAll(
    @CurrentUser() user: { id: string; companyId: string },
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('locationId') locationId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.inventoriesService.findAll(user.companyId, {
      search,
      status,
      locationId,
      page,
      limit,
    });
  }

  @Get('stats')
  getStats(@CurrentUser() user: { id: string; companyId: string }) {
    return this.inventoriesService.getStats(user.companyId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.inventoriesService.findOne(id);
  }

  @Post()
  create(
    @CurrentUser() user: { id: string; companyId: string },
    @Body() dto: CreateInventoryDto,
  ) {
    return this.inventoriesService.create(user.companyId, user.id, dto);
  }

  @Post(':id/start')
  start(@Param('id') id: string) {
    return this.inventoriesService.start(id);
  }

  @Post(':id/count/:itemId')
  countItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: CountInventoryItemDto,
  ) {
    return this.inventoriesService.countItem(id, itemId, dto);
  }

  @Post(':id/finish')
  finish(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; companyId: string },
  ) {
    return this.inventoriesService.finish(id, user.id);
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string) {
    return this.inventoriesService.cancel(id);
  }
}
