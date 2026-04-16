import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PortalAuthGuard } from './guards/portal-auth.guard';
import { CurrentPortalUser } from './decorators/current-portal-user.decorator';
import { PortalTicketsService } from './portal-tickets.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { CreateTicketMessageDto } from './dto/create-ticket-message.dto';

@Controller('portal/tickets')
@UseGuards(PortalAuthGuard)
export class PortalTicketsController {
  constructor(private readonly ticketsService: PortalTicketsService) {}

  @Get()
  findAll(
    @CurrentPortalUser() user: { id: string; companyId: string },
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.ticketsService.findByPortalUser(user.id, {
      status,
      page,
      limit,
    });
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @CurrentPortalUser() user: { id: string },
  ) {
    return this.ticketsService.findOneForPortal(id, user.id);
  }

  @Post()
  create(
    @CurrentPortalUser() user: { id: string; companyId: string },
    @Body() dto: CreateTicketDto,
  ) {
    return this.ticketsService.create(user.id, user.companyId, dto);
  }

  @Post(':id/messages')
  addMessage(
    @Param('id') id: string,
    @CurrentPortalUser() user: { id: string },
    @Body() dto: CreateTicketMessageDto,
  ) {
    return this.ticketsService.addMessage(id, dto, {
      portalUserId: user.id,
    });
  }

  @Post(':id/close')
  close(@Param('id') id: string) {
    return this.ticketsService.close(id);
  }
}
