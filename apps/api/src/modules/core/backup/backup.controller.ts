import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import * as fs from 'fs';
import { JwtAuthGuard } from '@/modules/core/auth/guards/jwt-auth.guard';
import { BackupService } from './backup.service';

@Controller('backup')
@UseGuards(JwtAuthGuard)
export class BackupController {
  constructor(private readonly backupService: BackupService) {}

  /** Estatísticas gerais */
  @Get('stats')
  stats() {
    return this.backupService.getStats();
  }

  /** Listar todos os backups */
  @Get()
  list() {
    return this.backupService.listBackups();
  }

  /** Criar backup manual */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create() {
    return this.backupService.createBackup('manual');
  }

  /** Download de um backup */
  @Get('download/:filename')
  download(@Param('filename') filename: string, @Res() res: Response) {
    const filepath = this.backupService.getBackupPath(filename);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', fs.statSync(filepath).size);
    fs.createReadStream(filepath).pipe(res);
  }

  /** Excluir um backup */
  @Delete(':filename')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@Param('filename') filename: string) {
    this.backupService.deleteBackup(filename);
  }
}
