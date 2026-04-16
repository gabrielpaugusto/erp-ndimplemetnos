import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export abstract class GovernmentTransmissionService {
  protected readonly logger = new Logger(this.constructor.name);

  constructor(
    protected readonly prisma: PrismaService,
    protected readonly configService: ConfigService,
  ) {}

  protected getAmbiente(): string {
    return this.configService.get<string>('GOV_AMBIENTE', '2');
  }

  protected isProducao(): boolean {
    return this.getAmbiente() === '1';
  }

  protected isHomologacao(): boolean {
    return this.getAmbiente() === '2';
  }

  protected async logTransmission(params: {
    companyId: string;
    type: string;
    endpoint: string;
    method?: string;
    requestXml?: string;
    requestPayload?: string;
    responseXml?: string;
    responsePayload?: string;
    statusCode?: number;
    success: boolean;
    protocolNumber?: string;
    receiptNumber?: string;
    errorCode?: string;
    errorMessage?: string;
    documentId?: string;
    documentNumber?: string;
    userId?: string;
    processingTimeMs?: number;
  }) {
    return this.prisma.governmentTransmissionLog.create({
      data: {
        ...params,
        type: params.type as any,
        ambiente: this.getAmbiente(),
        nodeEnv: this.configService.get('NODE_ENV', 'development'),
      },
    });
  }

  protected validateEnvironment(): void {
    const nodeEnv = this.configService.get('NODE_ENV');
    const govAmbiente = this.getAmbiente();

    if (nodeEnv === 'development' && govAmbiente === '1') {
      throw new Error(
        'FATAL: Cannot use production government APIs in development environment',
      );
    }
  }
}
