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
import { PortalDocumentsService } from './portal-documents.service';
import { ShareDocumentDto } from './dto/share-document.dto';

@Controller('documents/share')
@UseGuards(JwtAuthGuard)
export class DocumentSharingController {
  constructor(private readonly documentsService: PortalDocumentsService) {}

  @Post()
  share(
    @CurrentUser() user: { id: string; companyId: string },
    @Body() dto: ShareDocumentDto,
  ) {
    return this.documentsService.share(user.companyId, dto);
  }

  @Get('person/:personId')
  getByPerson(
    @CurrentUser() user: { id: string; companyId: string },
    @Param('personId') personId: string,
    @Query('category') category?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.documentsService.getByPerson(user.companyId, personId, {
      category,
      page,
      limit,
    });
  }
}
