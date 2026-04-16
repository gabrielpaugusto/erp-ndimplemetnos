import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';
import { ConfigService } from '@nestjs/config';
import { GovernmentTransmissionService } from '../government-transmission.service';
import {
  getReinfUrls,
  REINF_MAX_EVENTS_PER_BATCH,
} from './reinf.config';

export interface ReinfEventData {
  tipo: string; // e.g., 'R-2010', 'R-4020'
  dados: Record<string, any>;
}

export interface ReinfResponse {
  success: boolean;
  protocolo?: string;
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
export class ReinfClientService extends GovernmentTransmissionService {
  constructor(
    protected readonly prisma: PrismaService,
    protected readonly configService: ConfigService,
  ) {
    super(prisma, configService);
  }

  /**
   * Sends a batch of REINF events.
   */
  async enviarLoteEventos(
    companyId: string,
    eventos: ReinfEventData[],
  ): Promise<ReinfResponse> {
    this.validateEnvironment();
    const ambiente = await this.getAmbienteForCompany(companyId, 'ambienteReinf');
    const urls = getReinfUrls(ambiente);
    const startTime = Date.now();

    if (eventos.length === 0) {
      throw new BadRequestException('Lote deve conter ao menos um evento');
    }

    if (eventos.length > REINF_MAX_EVENTS_PER_BATCH) {
      throw new BadRequestException(
        `Lote excede o maximo de ${REINF_MAX_EVENTS_PER_BATCH} eventos`,
      );
    }

    this.logger.log(
      `[REINF] Enviando lote com ${eventos.length} evento(s) para ${urls.enviarLoteEventos}`,
    );

    const loteXml = this.buildLoteXml(companyId, eventos, ambiente);

    // Placeholder response
    const mockProtocolo = `REINF_${ambiente}${Date.now().toString().padStart(14, '0')}`;

    const mockResponse: ReinfResponse = {
      success: true,
      protocolo: mockProtocolo,
      status: '2',
      mensagem: 'Lote processado com sucesso',
      retornoEventos: eventos.map((evt, idx) => ({
        id: `EVT_${idx + 1}`,
        tipo: evt.tipo,
        recibo: `REC_REINF_${Date.now()}_${idx}`,
      })),
    };

    await this.logTransmission({
      companyId,
      type: 'REINF',
      endpoint: urls.enviarLoteEventos,
      method: 'POST',
      requestXml: loteXml,
      responsePayload: JSON.stringify(mockResponse),
      statusCode: 200,
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
    protocolo: string,
  ): Promise<ReinfResponse> {
    this.validateEnvironment();
    const ambiente = await this.getAmbienteForCompany(companyId, 'ambienteReinf');
    const urls = getReinfUrls(ambiente);
    const startTime = Date.now();

    this.logger.log(
      `[REINF] Consultando lote protocolo=${protocolo} em ${urls.consultarLoteEventos}`,
    );

    const mockResponse: ReinfResponse = {
      success: true,
      protocolo,
      status: '2',
      mensagem: 'Lote processado com sucesso',
      retornoEventos: [
        {
          id: 'EVT_1',
          tipo: 'R-2010',
          recibo: `REC_REINF_${Date.now()}`,
        },
      ],
    };

    await this.logTransmission({
      companyId,
      type: 'REINF',
      endpoint: urls.consultarLoteEventos,
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

  /**
   * Closes a period by sending R-2099 (previdenciario) or R-4099 (retencoes na fonte).
   */
  async fecharPeriodo(
    companyId: string,
    periodo: string, // Format: YYYY-MM
    serie: '2' | '4' = '2',
  ): Promise<ReinfResponse> {
    const tipoFechamento = serie === '2' ? 'R-2099' : 'R-4099';

    this.logger.log(
      `[REINF] Fechando periodo ${periodo} com evento ${tipoFechamento}`,
    );

    const ambienteFecha = await this.getAmbienteForCompany(companyId, 'ambienteReinf');
    return this.enviarLoteEventos(companyId, [
      {
        tipo: tipoFechamento,
        dados: {
          perApur: periodo,
          ideEvento: {
            indRetif: 1, // 1=Original, 2=Retificacao
            perApur: periodo,
            tpAmb: ambienteFecha,
            procEmi: 1,
            verProc: '1.0',
          },
          infoFech: {
            evtServTm: 'S',
            evtServPr: 'S',
            evtAssDespRec: 'S',
            evtAssDespRep: 'N',
            evtComProd: 'N',
            evtCPRB: 'N',
            evtAquis: 'N',
          },
        },
      },
    ]);
  }

  /**
   * Builds the XML envelope for a REINF batch.
   */
  private buildLoteXml(
    companyId: string,
    eventos: ReinfEventData[],
    ambiente: '1' | '2' = '2',
  ): string {
    const eventosXml = eventos
      .map(
        (evt, idx) => `
      <evento id="ID${(idx + 1).toString().padStart(14, '0')}">
        <Reinf xmlns="http://www.reinf.esocial.gov.br/schemas/evt${evt.tipo.replace('R-', '')}/v2_01_02">
          <evtInfoContri>
            <ideEvento>
              <tpAmb>${ambiente}</tpAmb>
              <procEmi>1</procEmi>
              <verProc>1.0</verProc>
            </ideEvento>
            <ideContri>
              <tpInsc>1</tpInsc>
              <nrInsc>${evt.dados.cnpj || companyId}</nrInsc>
            </ideContri>
            ${this.serializeDados(evt.dados)}
          </evtInfoContri>
        </Reinf>
      </evento>`,
      )
      .join('\n');

    return `
<Reinf xmlns="http://www.reinf.esocial.gov.br/schemas/envioLoteEventos/v1_05_01">
  <loteEventos>
    <ideContribuinte>
      <tpInsc>1</tpInsc>
      <nrInsc>${companyId}</nrInsc>
    </ideContribuinte>
    <eventos>
      ${eventosXml}
    </eventos>
  </loteEventos>
</Reinf>`.trim();
  }

  private serializeDados(dados: Record<string, any>): string {
    return Object.entries(dados)
      .filter(([, v]) => v != null && typeof v !== 'object')
      .map(([key, value]) => `<${key}>${value}</${key}>`)
      .join('\n            ');
  }
}
