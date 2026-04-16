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
import { JournalEntriesService } from './journal-entries.service';
import { CreateJournalEntryDto } from './dto/create-journal-entry.dto';
import { UpdateJournalEntryDto } from './dto/update-journal-entry.dto';

@Controller('accounting/journal')
@UseGuards(JwtAuthGuard)
export class JournalEntriesController {
  constructor(
    private readonly journalEntriesService: JournalEntriesService,
  ) {}

  @Get()
  findAll(
    @CurrentUser() user: { id: string; companyId: string },
    @Query('status') status?: string,
    @Query('accountId') accountId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.journalEntriesService.findAll(user.companyId, {
      status,
      accountId,
      dateFrom,
      dateTo,
      search,
      page,
      limit,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.journalEntriesService.findOne(id);
  }

  @Post()
  create(
    @CurrentUser() user: { id: string; companyId: string },
    @Body() createJournalEntryDto: CreateJournalEntryDto,
  ) {
    return this.journalEntriesService.create(
      user.companyId,
      user.id,
      createJournalEntryDto,
    );
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateJournalEntryDto: UpdateJournalEntryDto,
  ) {
    return this.journalEntriesService.update(id, updateJournalEntryDto);
  }

  @Post(':id/post')
  post(@Param('id') id: string) {
    return this.journalEntriesService.post(id);
  }

  @Post(':id/reverse')
  reverse(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; companyId: string },
  ) {
    return this.journalEntriesService.reverse(id, user.companyId, user.id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.journalEntriesService.remove(id);
  }
}
