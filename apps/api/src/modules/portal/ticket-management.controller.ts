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
import { PortalTicketsService } from './portal-tickets.service';
import { CreateTicketMessageDto } from './dto/create-ticket-message.dto';

@Controller('tickets')
@UseGuards(JwtAuthGuard)
export class TicketManagementController {
  constructor(private readonly ticketsService: PortalTicketsService) {}

  @Get()
  findAll(
    @CurrentUser() user: { id: string; companyId: string },
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.ticketsService.findAll(user.companyId, {
      status,
      priority,
      search,
      page,
      limit,
    });
  }

  @Get('stats')
  getStats(@CurrentUser() user: { id: string; companyId: string }) {
    return this.ticketsService.getStats(user.companyId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ticketsService.findOne(id);
  }

  @Post(':id/assign')
  assign(
    @Param('id') id: string,
    @Body('assignedToId') assignedToId: string,
  ) {
    return this.ticketsService.assign(id, assignedToId);
  }

  @Post(':id/messages')
  addMessage(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body() dto: CreateTicketMessageDto,
    @Body('isInternal') isInternal?: boolean,
  ) {
    return this.ticketsService.addMessage(id, dto, {
      userId: user.id,
      isInternal,
    });
  }

  @Post(':id/close')
  close(@Param('id') id: string) {
    return this.ticketsService.close(id);
  }
}
