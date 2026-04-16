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
import { RoutingService } from './routing.service';
import { CreateRoutingDto } from './dto/create-routing.dto';
import { UpdateRoutingDto } from './dto/update-routing.dto';

@Controller('pcp/routing')
@UseGuards(JwtAuthGuard)
export class RoutingController {
  constructor(private readonly routingService: RoutingService) {}

  @Get()
  findAll(
    @CurrentUser() user: { id: string; companyId: string },
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.routingService.findAll(user.companyId, {
      search,
      page,
      limit,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.routingService.findOne(id);
  }

  @Post()
  create(
    @CurrentUser() user: { id: string; companyId: string },
    @Body() createRoutingDto: CreateRoutingDto,
  ) {
    return this.routingService.create(user.companyId, createRoutingDto);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateRoutingDto: UpdateRoutingDto,
  ) {
    return this.routingService.update(id, updateRoutingDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.routingService.remove(id);
  }
}
