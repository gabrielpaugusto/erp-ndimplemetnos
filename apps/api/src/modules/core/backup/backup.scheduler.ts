import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as fs from 'fs';
import * as path from 'path';
import { BackupService } from './backup.service';

// Quantidade máxima de backups automáticos a manter
const MAX_AUTO_BACKUPS = 7;

@Injectable()
export class BackupScheduler {
  private readonly logger = new Logger(BackupScheduler.name);

  constructor(private readonly backupService: BackupService) {}

  /** Backup automático todo dia às 02:00 */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async runDailyBackup() {
    this.logger.log('Iniciando backup automático diário...');
    try {
      const info = await this.backupService.createBackup('auto');
      this.logger.log(`Backup automático concluído: ${info.filename} (${info.sizeFormatted})`);
      await this.pruneOldAutoBackups();
    } catch (err: any) {
      this.logger.error(`Falha no backup automático: ${err.message}`);
    }
  }

  /** Remove backups automáticos mais antigos que MAX_AUTO_BACKUPS */
  private async pruneOldAutoBackups() {
    const all = this.backupService.listBackups();
    const autos = all.filter((b) => b.type === 'auto');
    if (autos.length <= MAX_AUTO_BACKUPS) return;

    // Já vem ordenado do mais recente para o mais antigo
    const toDelete = autos.slice(MAX_AUTO_BACKUPS);
    for (const backup of toDelete) {
      try {
        this.backupService.deleteBackup(backup.filename);
        this.logger.log(`Backup antigo removido: ${backup.filename}`);
      } catch {
        // ignora se já foi removido manualmente
      }
    }
  }
}
