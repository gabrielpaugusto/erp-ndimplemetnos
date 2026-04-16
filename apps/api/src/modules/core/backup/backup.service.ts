import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

export interface BackupInfo {
  filename: string;
  size: number;
  sizeFormatted: string;
  createdAt: string;
  type: 'manual' | 'auto';
}

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);
  private readonly backupDir: string;

  constructor(private readonly config: ConfigService) {
    this.backupDir = path.resolve(process.cwd(), '..', '..', 'backups');
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  // ---------------------------------------------------------------------------
  // CREATE BACKUP
  // ---------------------------------------------------------------------------

  async createBackup(type: 'manual' | 'auto' = 'manual'): Promise<BackupInfo> {
    const dbUrl = this.config.get<string>('DATABASE_URL');
    if (!dbUrl) throw new InternalServerErrorException('DATABASE_URL not configured');

    const url = new URL(dbUrl);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
    const filename = `backup_${type}_${timestamp}.sql`;
    const filepath = path.join(this.backupDir, filename);

    const env = {
      ...process.env,
      PGPASSWORD: url.password,
    };

    const cmd = [
      'pg_dump',
      `-h ${url.hostname}`,
      `-p ${url.port || 5432}`,
      `-U ${url.username}`,
      `--no-password`,
      `--format=plain`,
      `--no-owner`,
      `--no-acl`,
      `-f "${filepath}"`,
      url.pathname.replace('/', ''),
    ].join(' ');

    try {
      await execAsync(cmd, { env });
    } catch (err: any) {
      // pg_dump may not be in PATH on Windows — try via docker exec
      this.logger.warn(`pg_dump direto falhou (${err.message}), tentando via docker exec...`);
      await this.createBackupViaDocker(filepath, url);
    }

    const stat = fs.statSync(filepath);
    const info: BackupInfo = {
      filename,
      size: stat.size,
      sizeFormatted: this.formatSize(stat.size),
      createdAt: new Date().toISOString(),
      type,
    };

    this.logger.log(`Backup criado: ${filename} (${info.sizeFormatted})`);
    return info;
  }

  private async createBackupViaDocker(filepath: string, url: URL): Promise<void> {
    // Detect container name from hostname (localhost → likely Docker)
    const containerName = 'erp-postgres-dev';
    const dbName = url.pathname.replace('/', '');
    const user = url.username;

    const cmd = `docker exec -e PGPASSWORD=${url.password} ${containerName} pg_dump -U ${user} --no-password --format=plain --no-owner --no-acl ${dbName}`;
    const { stdout } = await execAsync(cmd);
    fs.writeFileSync(filepath, stdout, 'utf8');
  }

  // ---------------------------------------------------------------------------
  // LIST BACKUPS
  // ---------------------------------------------------------------------------

  listBackups(): BackupInfo[] {
    if (!fs.existsSync(this.backupDir)) return [];

    return fs
      .readdirSync(this.backupDir)
      .filter((f) => f.endsWith('.sql'))
      .map((filename) => {
        const filepath = path.join(this.backupDir, filename);
        const stat = fs.statSync(filepath);
        const type: 'manual' | 'auto' = filename.includes('_auto_') ? 'auto' : 'manual';
        return {
          filename,
          size: stat.size,
          sizeFormatted: this.formatSize(stat.size),
          createdAt: stat.birthtime.toISOString(),
          type,
        };
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  // ---------------------------------------------------------------------------
  // GET BACKUP FILE PATH (for download)
  // ---------------------------------------------------------------------------

  getBackupPath(filename: string): string {
    // Sanitize: only allow safe filenames
    const safe = path.basename(filename);
    if (!safe.endsWith('.sql') || !safe.startsWith('backup_')) {
      throw new InternalServerErrorException('Nome de arquivo inválido');
    }
    const filepath = path.join(this.backupDir, safe);
    if (!fs.existsSync(filepath)) {
      throw new InternalServerErrorException('Arquivo não encontrado');
    }
    return filepath;
  }

  // ---------------------------------------------------------------------------
  // DELETE BACKUP
  // ---------------------------------------------------------------------------

  deleteBackup(filename: string): void {
    const filepath = this.getBackupPath(filename);
    fs.unlinkSync(filepath);
    this.logger.log(`Backup removido: ${filename}`);
  }

  // ---------------------------------------------------------------------------
  // STATS
  // ---------------------------------------------------------------------------

  getStats() {
    const backups = this.listBackups();
    const totalSize = backups.reduce((s, b) => s + b.size, 0);
    return {
      total: backups.length,
      totalSize: this.formatSize(totalSize),
      lastBackup: backups[0]?.createdAt ?? null,
      backupDir: this.backupDir,
    };
  }

  // ---------------------------------------------------------------------------
  // HELPERS
  // ---------------------------------------------------------------------------

  private formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
}
