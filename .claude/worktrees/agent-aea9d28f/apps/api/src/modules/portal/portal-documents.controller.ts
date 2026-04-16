import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PortalAuthGuard } from './guards/portal-auth.guard';
import { CurrentPortalUser } from './decorators/current-portal-user.decorator';
import { PortalDocumentsService } from './portal-documents.service';

@Controller('portal/documents')
@UseGuards(PortalAuthGuard)
export class PortalDocumentsController {
  constructor(private readonly documentsService: PortalDocumentsService) {}

  @Get()
  getMyDocuments(
    @CurrentPortalUser()
    user: { id: string; personId: string },
    @Query('category') category?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.documentsService.getMyDocuments(user.id, user.personId, {
      category,
      page,
      limit,
    });
  }

  @Get(':id/download')
  download(@Param('id') id: string) {
    return this.documentsService.download(id);
  }
}
