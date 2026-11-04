import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '@/modules/core/database/prisma.service';
import { NfeService } from './nfe.service';

@Injectable()
export class NfeQueueService {
  private readonly logger = new Logger(NfeQueueService.name);
  private processing = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly nfeService: NfeService,
  ) {}

  /**
   * Processes NF-e pending transmission every 30 seconds.
   * Picks up NF-es with AGUARDANDO_TRANSMISSAO status older than 10 seconds
   * (to avoid racing with the HTTP response) and transmits them.
   */
  @Cron(CronExpression.EVERY_30_SECONDS)
  async processQueue() {
    if (this.processing) return;
    this.processing = true;

    try {
      const cutoff = new Date(Date.now() - 10_000);
      const pending = await this.prisma.nFeDocument.findMany({
        where: {
          status: 'AGUARDANDO_TRANSMISSAO' as any,
          updatedAt: { lt: cutoff },
        },
        select: { id: true, companyId: true },
        take: 10,
        orderBy: { updatedAt: 'asc' },
      });

      if (pending.length === 0) return;

      this.logger.log(`NF-e queue: ${pending.length} document(s) to transmit`);

      for (const nfe of pending) {
        try {
          await this.nfeService.transmitFromQueue(nfe.id);
          this.logger.log(`NF-e ${nfe.id} transmitted successfully`);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          this.logger.warn(`NF-e ${nfe.id} transmission failed: ${message}`);
        }
      }
    } finally {
      this.processing = false;
    }
  }
}
