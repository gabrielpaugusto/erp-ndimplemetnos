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
import { WorkCentersService } from './work-centers.service';
import { CreateWorkCenterDto } from './dto/create-work-center.dto';
import { UpdateWorkCenterDto } from './dto/update-work-center.dto';

@Controller('pcp/work-centers')
@UseGuards(JwtAuthGuard)
export class WorkCentersController {
  constructor(private readonly workCentersService: WorkCentersService) {}

  @Get()
  findAll(
    @CurrentUser() user: { id: string; companyId: string },
    @Query('search') search?: string,
    @Query('type') type?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.workCentersService.findAll(user.companyId, {
      search,
      type,
      page,
      limit,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.workCentersService.findOne(id);
  }

  @Post()
  create(
    @CurrentUser() user: { id: string; companyId: string },
    @Body() createWorkCenterDto: CreateWorkCenterDto,
  ) {
    return this.workCentersService.create(user.companyId, createWorkCenterDto);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateWorkCenterDto: UpdateWorkCenterDto,
  ) {
    return this.workCentersService.update(id, updateWorkCenterDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.workCentersService.remove(id);
  }
}
