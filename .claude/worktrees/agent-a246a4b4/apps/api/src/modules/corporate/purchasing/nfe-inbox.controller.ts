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
import { NfeInboxService } from './nfe-inbox.service';
import { CreateNfeInboxDto } from './dto/create-nfe-inbox.dto';
import { ManifestNfeDto } from './dto/manifest-nfe.dto';
import { LinkNfeItemDto, CreateAndLinkDto } from './dto/link-nfe-item.dto';
import { PostNfeEntryDto } from './dto/post-nfe-entry.dto';

@Controller('purchasing/nfe-inbox')
@UseGuards(JwtAuthGuard)
export class NfeInboxController {
  constructor(private readonly nfeInboxService: NfeInboxService) {}

  @Get()
  findAll(
    @CurrentUser() user: { id: string; companyId: string },
    @Query('status') status?: string,
    @Query('emitenteCnpj') emitenteCnpj?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.nfeInboxService.findAll(user.companyId, {
      status,
      emitenteCnpj,
      startDate,
      endDate,
      search,
      page,
      limit,
    });
  }

  @Get('stats')
  getStats(@CurrentUser() user: { id: string; companyId: string }) {
    return this.nfeInboxService.getStats(user.companyId);
  }

  @Post('sync')
  syncFromSefaz(@CurrentUser() user: { id: string; companyId: string }) {
    return this.nfeInboxService.syncFromSefaz(user.companyId);
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: { id: string; companyId: string },
    @Param('id') id: string,
  ) {
    return this.nfeInboxService.findOne(id, user.companyId);
  }

  @Post()
  create(
    @CurrentUser() user: { id: string; companyId: string },
    @Body() dto: CreateNfeInboxDto,
  ) {
    return this.nfeInboxService.create(user.companyId, dto);
  }

  @Post(':id/manifest')
  manifest(
    @CurrentUser() user: { id: string; companyId: string },
    @Param('id') id: string,
    @Body() dto: ManifestNfeDto,
  ) {
    return this.nfeInboxService.manifest(id, user.companyId, dto);
  }

  @Post(':id/auto-map')
  autoMap(
    @CurrentUser() user: { id: string; companyId: string },
    @Param('id') id: string,
  ) {
    return this.nfeInboxService.autoMap(id, user.companyId);
  }

  @Post(':id/link-item')
  linkItem(
    @CurrentUser() user: { id: string; companyId: string },
    @Param('id') id: string,
    @Body() dto: LinkNfeItemDto,
  ) {
    return this.nfeInboxService.linkItem(id, user.companyId, dto);
  }

  @Post(':id/create-and-link')
  createAndLink(
    @CurrentUser() user: { id: string; companyId: string },
    @Param('id') id: string,
    @Body() dto: CreateAndLinkDto,
  ) {
    return this.nfeInboxService.createAndLink(id, user.companyId, dto);
  }

  @Post(':id/post-entry')
  postEntry(
    @CurrentUser() user: { id: string; companyId: string },
    @Param('id') id: string,
    @Body() dto: PostNfeEntryDto,
  ) {
    // Override inboxId from URL param to ensure consistency
    return this.nfeInboxService.postEntry(user.companyId, user.id, {
      ...dto,
      inboxId: id,
    });
  }
}
