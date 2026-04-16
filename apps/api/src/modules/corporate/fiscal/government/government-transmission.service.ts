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

  /**
   * Retorna o ambiente configurado para a empresa no campo especificado.
   * Se o campo não estiver definido no banco, usa o GOV_AMBIENTE global como fallback.
   * Usado pelos serviços filhos (eSocial, REINF, DCTFWeb, SPED) para respeitar
   * a configuração por empresa em vez do ambiente global.
   */
  protected async getAmbienteForCompany(
    companyId: string,
    field: 'ambienteEsocial' | 'ambienteReinf' | 'ambienteDctfweb' | 'ambienteSped' | 'ambienteNfe' | 'ambienteNfse' | 'ambienteDFe',
  ): Promise<'1' | '2'> {
    try {
      const company = await this.prisma.company.findUnique({
        where: { id: companyId },
        select: { [field]: true },
      });
      const val = (company as Record<string, unknown>)?.[field];
      if (val === 1 || val === 2) return String(val) as '1' | '2';
    } catch { /* fallback */ }
    return this.getAmbiente() as '1' | '2';
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
    ambienteOverride?: string;
  }) {
    const { ambienteOverride, ...rest } = params;
    return this.prisma.governmentTransmissionLog.create({
      data: {
        ...rest,
        type: rest.type as any,
        ambiente: ambienteOverride ?? this.getAmbiente(),
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
