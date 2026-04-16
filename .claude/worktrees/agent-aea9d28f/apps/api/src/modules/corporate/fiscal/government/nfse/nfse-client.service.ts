import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';
import { ConfigService } from '@nestjs/config';
import { GovernmentTransmissionService } from '../government-transmission.service';
import { getNfseConfig, getNfseUrl } from './nfse-municipal.config';

export interface NfseResponse {
  success: boolean;
  codigo: string;
  mensagem: string;
  numeroNfse?: string;
  protocoloLote?: string;
  xml?: string;
}

export interface RpsData {
  codigoMunicipioIbge: string;
  numero: number;
  serie: string;
  tipo: number; // 1=RPS, 2=RPS Mista, 3=Cupom
  dataEmissao: Date;
  naturezaOperacao: number;
  optanteSimplesNacional: boolean;
  incentivadorCultural: boolean;
  // Prestador
  cnpjPrestador: string;
  inscricaoMunicipalPrestador: string;
  // Tomador
  cpfCnpjTomador: string;
  razaoSocialTomador: string;
  // Servico
  codigoServico: string;
  discriminacao: string;
  codigoMunicipioIncidencia: string;
  valorServicos: number;
  valorDeducoes?: number;
  valorIss?: number;
  aliquotaIss?: number;
  issRetido: boolean;
}

@Injectable()
export class NfseClientService extends GovernmentTransmissionService {
  constructor(
    protected readonly prisma: PrismaService,
    protected readonly configService: ConfigService,
  ) {
    super(prisma, configService);
  }

  /**
   * Generates NFS-e from RPS (Recibo Provisorio de Servico).
   */
  async gerarNfse(companyId: string, rps: RpsData): Promise<NfseResponse> {
    this.validateEnvironment();
    const ambiente = this.getAmbiente() as '1' | '2';
    const config = getNfseConfig(rps.codigoMunicipioIbge);
    const url = getNfseUrl(rps.codigoMunicipioIbge, ambiente);

    if (!config || !url) {
      throw new BadRequestException(
        `NFS-e nao configurada para o municipio IBGE: ${rps.codigoMunicipioIbge}`,
      );
    }

    const startTime = Date.now();

    this.logger.log(
      `[GerarNfse] Municipio=${rps.codigoMunicipioIbge} provider=${config.provider} endpoint=${url}`,
    );

    // Placeholder: In production, this would build the SOAP/XML envelope
    // according to the provider (ABRASF, GINFES, ISSNet, SP_PAULISTANA)
    const mockNumeroNfse = Math.floor(Math.random() * 1000000)
      .toString()
      .padStart(10, '0');

    const mockResponse: NfseResponse = {
      success: true,
      codigo: '100',
      mensagem: 'NFS-e gerada com sucesso',
      numeroNfse: mockNumeroNfse,
    };

    await this.logTransmission({
      companyId,
      type: 'NFSE',
      endpoint: url,
      method: 'POST',
      requestPayload: JSON.stringify(rps),
      responsePayload: JSON.stringify(mockResponse),
      statusCode: 200,
      success: mockResponse.success,
      documentNumber: mockNumeroNfse,
      processingTimeMs: Date.now() - startTime,
    });

    return mockResponse;
  }

  /**
   * Queries an existing NFS-e by number.
   */
  async consultarNfse(
    companyId: string,
    codigoMunicipioIbge: string,
    numero: string,
  ): Promise<NfseResponse> {
    this.validateEnvironment();
    const ambiente = this.getAmbiente() as '1' | '2';
    const url = getNfseUrl(codigoMunicipioIbge, ambiente);

    if (!url) {
      throw new BadRequestException(
        `NFS-e nao configurada para o municipio IBGE: ${codigoMunicipioIbge}`,
      );
    }

    const startTime = Date.now();

    this.logger.log(
      `[ConsultarNfse] numero=${numero} endpoint=${url}`,
    );

    const mockResponse: NfseResponse = {
      success: true,
      codigo: '100',
      mensagem: 'NFS-e encontrada',
      numeroNfse: numero,
    };

    await this.logTransmission({
      companyId,
      type: 'NFSE',
      endpoint: url,
      method: 'POST',
      requestPayload: JSON.stringify({ numero }),
      responsePayload: JSON.stringify(mockResponse),
      statusCode: 200,
      success: mockResponse.success,
      documentNumber: numero,
      processingTimeMs: Date.now() - startTime,
    });

    return mockResponse;
  }

  /**
   * Cancels an existing NFS-e.
   */
  async cancelarNfse(
    companyId: string,
    codigoMunicipioIbge: string,
    numero: string,
    motivo: string,
  ): Promise<NfseResponse> {
    this.validateEnvironment();
    const ambiente = this.getAmbiente() as '1' | '2';
    const url = getNfseUrl(codigoMunicipioIbge, ambiente);

    if (!url) {
      throw new BadRequestException(
        `NFS-e nao configurada para o municipio IBGE: ${codigoMunicipioIbge}`,
      );
    }

    const startTime = Date.now();

    this.logger.log(
      `[CancelarNfse] numero=${numero} endpoint=${url}`,
    );

    const mockResponse: NfseResponse = {
      success: true,
      codigo: '100',
      mensagem: 'NFS-e cancelada com sucesso',
      numeroNfse: numero,
    };

    await this.logTransmission({
      companyId,
      type: 'NFSE',
      endpoint: url,
      method: 'POST',
      requestPayload: JSON.stringify({ numero, motivo }),
      responsePayload: JSON.stringify(mockResponse),
      statusCode: 200,
      success: mockResponse.success,
      documentNumber: numero,
      processingTimeMs: Date.now() - startTime,
    });

    return mockResponse;
  }

  /**
   * Queries a batch of RPS by protocol number.
   */
  async consultarLoteRps(
    companyId: string,
    codigoMunicipioIbge: string,
    protocolo: string,
  ): Promise<NfseResponse> {
    this.validateEnvironment();
    const ambiente = this.getAmbiente() as '1' | '2';
    const url = getNfseUrl(codigoMunicipioIbge, ambiente);

    if (!url) {
      throw new BadRequestException(
        `NFS-e nao configurada para o municipio IBGE: ${codigoMunicipioIbge}`,
      );
    }

    const startTime = Date.now();

    this.logger.log(
      `[ConsultarLoteRps] protocolo=${protocolo} endpoint=${url}`,
    );

    const mockResponse: NfseResponse = {
      success: true,
      codigo: '100',
      mensagem: 'Lote processado com sucesso',
      protocoloLote: protocolo,
    };

    await this.logTransmission({
      companyId,
      type: 'NFSE',
      endpoint: url,
      method: 'POST',
      requestPayload: JSON.stringify({ protocolo }),
      responsePayload: JSON.stringify(mockResponse),
      statusCode: 200,
      success: mockResponse.success,
      protocolNumber: protocolo,
      processingTimeMs: Date.now() - startTime,
    });

    return mockResponse;
  }
}
