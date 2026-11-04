import { Controller, Get, Query } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { StorageService } from '../storage/storage.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  @Get()
  async getHealth() {
    const govAmbiente = this.configService.get('GOV_AMBIENTE', '2');
    const nodeEnv = this.configService.get('NODE_ENV', 'development');

    const [dbOk, minioOk] = await Promise.allSettled([
      this.prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false),
      this.storage.ping(),
    ]);

    const db = dbOk.status === 'fulfilled' ? dbOk.value : false;
    const minio = minioOk.status === 'fulfilled' ? minioOk.value : false;
    const allOk = db && minio;

    return {
      status: allOk ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      environment: {
        nodeEnv,
        govAmbiente: govAmbiente === '1' ? 'PRODUCAO' : 'HOMOLOGACAO',
        govAmbienteCode: govAmbiente,
      },
      version: '1.1.4',
      checks: {
        database: db ? 'ok' : 'unreachable',
        minio: minio ? 'ok' : 'unreachable',
      },
    };
  }

  @Get('chart-of-accounts')
  async chartOfAccountsHealth(@Query('companyId') companyId: string) {
    if (!companyId) {
      return { ok: false, count: 0, message: 'companyId query param is required' };
    }
    try {
      const count = await this.prisma.chartOfAccount.count({
        where: { companyId, active: true },
      });
      return {
        ok: count > 0,
        count,
        message: count > 0
          ? `Plano de contas OK: ${count} contas ativas`
          : 'Plano de contas vazio — nenhuma conta ativa encontrada',
      };
    } catch {
      return { ok: false, count: 0, message: 'Erro ao consultar plano de contas' };
    }
  }
}
