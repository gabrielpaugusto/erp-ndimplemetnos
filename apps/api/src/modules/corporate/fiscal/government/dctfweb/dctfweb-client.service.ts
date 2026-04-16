import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';
import { ConfigService } from '@nestjs/config';
import { GovernmentTransmissionService } from '../government-transmission.service';
import { getDctfwebUrls, DCTFWEB_STATUS } from './dctfweb.config';

export interface DctfwebDeclaracao {
  id: string;
  periodo: string;
  categoria: string;
  status: string;
  valorTotalDebitos: number;
  valorTotalCreditos: number;
  saldoAPagar: number;
  dataGeracao?: string;
  dataTransmissao?: string;
  recibo?: string;
}

export interface DctfwebResponse {
  success: boolean;
  mensagem: string;
  declaracao?: DctfwebDeclaracao;
}

@Injectable()
export class DctfwebClientService extends GovernmentTransmissionService {
  constructor(
    protected readonly prisma: PrismaService,
    protected readonly configService: ConfigService,
  ) {
    super(prisma, configService);
  }

  /**
   * Generates a DCTF-Web declaration for a given period.
   * In production, the RFB system generates this from eSocial + REINF data.
   */
  async gerarDeclaracao(
    companyId: string,
    periodo: string, // Format: YYYY-MM
  ): Promise<DctfwebResponse> {
    this.validateEnvironment();
    const ambiente = await this.getAmbienteForCompany(companyId, 'ambienteDctfweb');
    const urls = getDctfwebUrls(ambiente);
    const startTime = Date.now();

    this.logger.log(
      `[DCTF-Web] Gerando declaracao periodo=${periodo} endpoint=${urls.gerarDeclaracao}`,
    );

    // Placeholder: In production, this calls the RFB API
    const mockDeclaracao: DctfwebDeclaracao = {
      id: `DCTF_${companyId}_${periodo}`,
      periodo,
      categoria: 'MENSAL',
      status: DCTFWEB_STATUS.GERADA,
      valorTotalDebitos: 0,
      valorTotalCreditos: 0,
      saldoAPagar: 0,
      dataGeracao: new Date().toISOString(),
    };

    const mockResponse: DctfwebResponse = {
      success: true,
      mensagem: 'Declaracao gerada com sucesso',
      declaracao: mockDeclaracao,
    };

    await this.logTransmission({
      companyId,
      type: 'DCTFWEB',
      endpoint: urls.gerarDeclaracao,
      method: 'POST',
      requestPayload: JSON.stringify({ periodo, categoria: 'MENSAL' }),
      responsePayload: JSON.stringify(mockResponse),
      statusCode: 200,
      success: mockResponse.success,
      documentNumber: `DCTF_${periodo}`,
      processingTimeMs: Date.now() - startTime,
    });

    return mockResponse;
  }

  /**
   * Queries an existing DCTF-Web declaration.
   */
  async consultarDeclaracao(
    companyId: string,
    periodo: string,
  ): Promise<DctfwebResponse> {
    this.validateEnvironment();
    const ambiente = await this.getAmbienteForCompany(companyId, 'ambienteDctfweb');
    const urls = getDctfwebUrls(ambiente);
    const startTime = Date.now();

    this.logger.log(
      `[DCTF-Web] Consultando declaracao periodo=${periodo} endpoint=${urls.consultarDeclaracao}`,
    );

    const mockResponse: DctfwebResponse = {
      success: true,
      mensagem: 'Declaracao encontrada',
      declaracao: {
        id: `DCTF_${companyId}_${periodo}`,
        periodo,
        categoria: 'MENSAL',
        status: DCTFWEB_STATUS.GERADA,
        valorTotalDebitos: 0,
        valorTotalCreditos: 0,
        saldoAPagar: 0,
        dataGeracao: new Date().toISOString(),
      },
    };

    await this.logTransmission({
      companyId,
      type: 'DCTFWEB',
      endpoint: urls.consultarDeclaracao,
      method: 'POST',
      requestPayload: JSON.stringify({ periodo }),
      responsePayload: JSON.stringify(mockResponse),
      statusCode: 200,
      success: mockResponse.success,
      documentNumber: `DCTF_${periodo}`,
      processingTimeMs: Date.now() - startTime,
    });

    return mockResponse;
  }

  /**
   * Transmits a generated DCTF-Web declaration to the RFB.
   */
  async transmitirDeclaracao(
    companyId: string,
    declaracaoId: string,
  ): Promise<DctfwebResponse> {
    this.validateEnvironment();
    const ambiente = await this.getAmbienteForCompany(companyId, 'ambienteDctfweb');
    const urls = getDctfwebUrls(ambiente);
    const startTime = Date.now();

    this.logger.log(
      `[DCTF-Web] Transmitindo declaracao id=${declaracaoId} endpoint=${urls.transmitirDeclaracao}`,
    );

    const recibo = `DCTF_REC_${Date.now()}`;

    const mockResponse: DctfwebResponse = {
      success: true,
      mensagem: 'Declaracao transmitida com sucesso',
      declaracao: {
        id: declaracaoId,
        periodo: '',
        categoria: 'MENSAL',
        status: DCTFWEB_STATUS.TRANSMITIDA,
        valorTotalDebitos: 0,
        valorTotalCreditos: 0,
        saldoAPagar: 0,
        dataTransmissao: new Date().toISOString(),
        recibo,
      },
    };

    await this.logTransmission({
      companyId,
      type: 'DCTFWEB',
      endpoint: urls.transmitirDeclaracao,
      method: 'POST',
      requestPayload: JSON.stringify({ declaracaoId }),
      responsePayload: JSON.stringify(mockResponse),
      statusCode: 200,
      success: mockResponse.success,
      receiptNumber: recibo,
      documentId: declaracaoId,
      processingTimeMs: Date.now() - startTime,
    });

    return mockResponse;
  }
}
