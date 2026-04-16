import {
  Controller, Get, Post, Patch, Param, Body, Query,
  Request, UseGuards, UseInterceptors, UploadedFile, Delete,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '@/modules/core/auth/guards/jwt-auth.guard';
import { MaintenanceService } from './maintenance.service';

@Controller('patrimonio/manutencoes')
@UseGuards(JwtAuthGuard)
export class MaintenanceController {
  constructor(private readonly service: MaintenanceService) {}

  @Get()
  findAll(@Request() req: any, @Query() query: any) {
    return this.service.findAll(req.user.companyId, query);
  }

  @Get('externas-em-aberto')
  findExternasEmAberto(@Request() req: any) {
    return this.service.findExternasEmAberto(req.user.companyId);
  }

  @Get('stats')
  getStats(@Request() req: any) {
    return this.service.getStats(req.user.companyId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Request() req: any, @Body() body: any) {
    return this.service.create(req.user.companyId, body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.service.update(id, body);
  }

  @Post(':id/concluir')
  concluir(@Param('id') id: string, @Body() body: any) {
    return this.service.concluir(id, body);
  }

  @Post(':id/anexos')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 20 * 1024 * 1024 } }))
  uploadAnexo(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Request() req: any,
  ) {
    return this.service.uploadAnexo(id, file, req.user.companyId);
  }

  @Get('anexos/:attachmentId/download')
  getPresignedUrl(@Param('attachmentId') attachmentId: string) {
    return this.service.getPresignedUrl(attachmentId);
  }

  @Delete('anexos/:attachmentId')
  deleteAnexo(@Param('attachmentId') attachmentId: string) {
    return this.service.deleteAnexo(attachmentId);
  }
}
