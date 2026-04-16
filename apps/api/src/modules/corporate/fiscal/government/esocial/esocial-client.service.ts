import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';
import { ConfigService } from '@nestjs/config';
import { GovernmentTransmissionService } from '../government-transmission.service';
import {
  getEsocialUrls,
  ESOCIAL_MAX_EVENTS_PER_BATCH,
} from './esocial.config';
import { EsocialEvent } from './esocial-events.enum';

export interface EsocialEventData {
  tipo: EsocialEvent;
  /** Event-specific payload data */
  dados: Record<string, any>;
}

export interface EsocialResponse {
  success: boolean;
  protocoloEnvio?: string;
  status: string;
  mensagem: string;
  retornoEventos?: Array<{
    id: string;
    tipo: string;
    recibo?: string;
    erro?: string;
  }>;
}

@Injectable()
export class EsocialClientService extends GovernmentTransmissionService {
  constructor(
    protected readonly prisma: PrismaService,
    protected readonly configService: ConfigService,
  ) {
    super(prisma, configService);
  }

  /**
   * Sends a batch of eSocial events.
   */
  async enviarLoteEventos(
    companyId: string,
    eventos: EsocialEventData[],
  ): Promise<EsocialResponse> {
    this.validateEnvironment();
    const ambiente = await this.getAmbienteForCompany(companyId, 'ambienteEsocial');
    const urls = getEsocialUrls(ambiente);
    const startTime = Date.now();

    if (eventos.length === 0) {
      throw new BadRequestException('Lote deve conter ao menos um evento');
    }

    if (eventos.length > ESOCIAL_MAX_EVENTS_PER_BATCH) {
      throw new BadRequestException(
        `Lote excede o maximo de ${ESOCIAL_MAX_EVENTS_PER_BATCH} eventos`,
      );
    }

    this.logger.log(
      `[eSocial] Enviando lote com ${eventos.length} evento(s) para ${urls.enviarLoteEventos}`,
    );

    // Build the XML envelope for each event
    const eventosXml = eventos.map((evt, idx) =>
      this.buildEventoXml(evt.tipo, evt.dados, idx + 1, ambiente),
    );

    const loteXml = this.buildLoteXml(companyId, eventosXml);

    // Placeholder: In production, this would make a SOAP call
    const mockProtocolo = `${ambiente}${Date.now().toString().padStart(14, '0')}`;

    const mockResponse: EsocialResponse = {
      success: true,
      protocoloEnvio: mockProtocolo,
      status: '201',
      mensagem: 'Lote enfileirado para processamento',
      retornoEventos: eventos.map((evt, idx) => ({
        id: `EVT_${idx + 1}`,
        tipo: evt.tipo,
        recibo: `REC_${Date.now()}_${idx}`,
      })),
    };

    await this.logTransmission({
      companyId,
      type: 'ESOCIAL',
      endpoint: urls.enviarLoteEventos,
      method: 'POST',
      requestXml: loteXml,
      responsePayload: JSON.stringify(mockResponse),
      statusCode: 201,
      success: mockResponse.success,
      protocolNumber: mockProtocolo,
      processingTimeMs: Date.now() - startTime,
    });

    return mockResponse;
  }

  /**
   * Queries the status of a previously sent batch.
   */
  async consultarLoteEventos(
    companyId: string,
    protocoloEnvio: string,
  ): Promise<EsocialResponse> {
    this.validateEnvironment();
    const ambiente = await this.getAmbienteForCompany(companyId, 'ambienteEsocial');
    const urls = getEsocialUrls(ambiente);
    const startTime = Date.now();

    this.logger.log(
      `[eSocial] Consultando lote protocolo=${protocoloEnvio} em ${urls.consultarLoteEventos}`,
    );

    // Placeholder response
    const mockResponse: EsocialResponse = {
      success: true,
      protocoloEnvio,
      status: '1',
      mensagem: 'Lote processado com sucesso',
      retornoEventos: [
        {
          id: 'EVT_1',
          tipo: 'S-1200',
          recibo: `REC_${Date.now()}`,
        },
      ],
    };

    await this.logTransmission({
      companyId,
      type: 'ESOCIAL',
      endpoint: urls.consultarLoteEventos,
      method: 'POST',
      requestPayload: JSON.stringify({ protocoloEnvio }),
      responsePayload: JSON.stringify(mockResponse),
      statusCode: 200,
      success: mockResponse.success,
      protocolNumber: protocoloEnvio,
      processingTimeMs: Date.now() - startTime,
    });

    return mockResponse;
  }

  /**
   * Builds XML for a specific eSocial event type.
   */
  buildEventoXml(
    evento: EsocialEvent,
    dados: Record<string, any>,
    sequencial: number,
    ambiente: '1' | '2' = '2',
  ): string {
    const id = `ID${sequencial.toString().padStart(14, '0')}`;

    // Simplified XML structure - in production would follow the complete XSD schemas
    return `
<eSocial xmlns="http://www.esocial.gov.br/schema/evt/${evento}/v_S_01_02_00">
  <evtInfoEmpregador Id="${id}">
    <ideEvento>
      <tpAmb>${ambiente}</tpAmb>
      <procEmi>1</procEmi>
      <verProc>1.0</verProc>
    </ideEvento>
    <ideEmpregador>
      <tpInsc>1</tpInsc>
      <nrInsc>${dados.cnpj || ''}</nrInsc>
    </ideEmpregador>
    <infoEmpregador>
      ${this.serializeDados(dados)}
    </infoEmpregador>
  </evtInfoEmpregador>
</eSocial>`.trim();
  }

  /**
   * Wraps individual event XMLs into a batch envelope.
   */
  private buildLoteXml(companyId: string, eventosXml: string[]): string {
    const eventos = eventosXml
      .map(
        (xml, idx) => `
      <evento Id="ID${(idx + 1).toString().padStart(14, '0')}">
        ${xml}
      </evento>`,
      )
      .join('\n');

    return `
<eSocial xmlns="http://www.esocial.gov.br/schema/lote/eventos/envio/v1_1_1">
  <envioLoteEventos grupo="1">
    <ideEmpregador>
      <tpInsc>1</tpInsc>
      <nrInsc>${companyId}</nrInsc>
    </ideEmpregador>
    <eventos>
      ${eventos}
    </eventos>
  </envioLoteEventos>
</eSocial>`.trim();
  }

  /**
   * Serializes key-value data to simple XML elements.
   */
  private serializeDados(dados: Record<string, any>): string {
    return Object.entries(dados)
      .filter(([, v]) => v != null)
      .map(([key, value]) => `<${key}>${value}</${key}>`)
      .join('\n      ');
  }
}
