import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';
import { ConfigService } from '@nestjs/config';
import { GovernmentTransmissionService } from '../government-transmission.service';
import { getSefazUrls } from './sefaz-urls.config';
import * as https from 'https';
import * as forge from 'node-forge';
import * as crypto from 'crypto';
import axios from 'axios';

export interface SefazResponse {
  success: boolean;
  cStat: string;
  xMotivo: string;
  protocolNumber?: string;
  xml?: string;
  chaveAcesso?: string;
}

@Injectable()
export class SefazClientService extends GovernmentTransmissionService {
  private readonly sefazLogger = new Logger('SefazClientService');

  constructor(
    protected readonly prisma: PrismaService,
    protected readonly configService: ConfigService,
  ) {
    super(prisma, configService);
  }

  /**
   * Load certificate from company DB and create an HTTPS agent with mTLS.
   */
  private async buildHttpsAgent(companyId: string): Promise<https.Agent> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { certDigitalConteudo: true, certDigitalSenha: true },
    });

    if (!company?.certDigitalConteudo) {
      throw new Error('Certificado digital não instalado. Instale o certificado A1 em Configurações → NF-e/SEFAZ.');
    }

    // Decrypt the certificate (AES-256-CBC with IV prefix)
    const encKey = Buffer.from(
      (process.env.CERT_ENCRYPTION_KEY || 'erp_certificado_key_32bytes_1234')
        .padEnd(32, '0')
        .slice(0, 32),
    );

    const decrypt = (data: Buffer): Buffer => {
      const iv = data.subarray(0, 16);
      const enc = data.subarray(16);
      const decipher = crypto.createDecipheriv('aes-256-cbc', encKey, iv);
      return Buffer.concat([decipher.update(enc), decipher.final()]);
    };

    const pfxBuffer = decrypt(Buffer.from(company.certDigitalConteudo));
    const senhaBuffer = Buffer.from(company.certDigitalSenha!, 'base64');
    const senha = decrypt(senhaBuffer).toString('utf8');

    // Parse PFX with node-forge to extract key + cert in PEM format
    const p12Asn1 = forge.asn1.fromDer(forge.util.createBuffer(pfxBuffer.toString('binary')));
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, senha);

    const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
    const keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0];
    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
    const certBag = certBags[forge.pki.oids.certBag]?.[0];

    if (!keyBag?.key || !certBag?.cert) {
      throw new Error('Não foi possível extrair chave/certificado do arquivo .pfx');
    }

    const keyPem = forge.pki.privateKeyToPem(keyBag.key);
    const certPem = forge.pki.certificateToPem(certBag.cert);

    return new https.Agent({
      key: keyPem,
      cert: certPem,
      rejectUnauthorized: false, // SEFAZ uses self-signed intermediaries in some states
    });
  }

  /**
   * Make a SOAP 1.2 POST request to the SEFAZ WebService.
   */
  private async soapPost(
    endpoint: string,
    soapAction: string,
    bodyXml: string,
    httpsAgent: https.Agent,
  ): Promise<string> {
    const envelope = `<?xml version="1.0" encoding="UTF-8"?>
<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:xsd="http://www.w3.org/2001/XMLSchema"
  xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>
    <nfeDadosMsg xmlns="${soapAction}">${bodyXml}</nfeDadosMsg>
  </soap12:Body>
</soap12:Envelope>`;

    const response = await axios.post(endpoint, envelope, {
      headers: {
        'Content-Type': 'application/soap+xml; charset=utf-8',
        SOAPAction: soapAction,
      },
      httpsAgent,
      timeout: 30000,
    });

    return response.data as string;
  }

  /**
   * Parse a SEFAZ SOAP response XML and extract cStat + xMotivo.
   */
  private parseResponse(responseXml: string): { cStat: string; xMotivo: string; nProt?: string } {
    const cStatMatch = responseXml.match(/<cStat>(\d+)<\/cStat>/);
    const xMotivoMatch = responseXml.match(/<xMotivo>([^<]+)<\/xMotivo>/);
    const nProtMatch = responseXml.match(/<nProt>(\d+)<\/nProt>/);
    return {
      cStat: cStatMatch?.[1] ?? '999',
      xMotivo: xMotivoMatch?.[1] ?? 'Resposta não reconhecida',
      nProt: nProtMatch?.[1],
    };
  }

  /**
   * Check SEFAZ service status for a given UF.
   */
  async statusServico(companyId: string, uf: string): Promise<SefazResponse> {
    this.validateEnvironment();
    const ambiente = this.getAmbiente() as '1' | '2';
    const urls = getSefazUrls(uf, ambiente);
    const startTime = Date.now();

    this.sefazLogger.log(`[StatusServico] UF=${uf} ambiente=${ambiente}`);

    let responseXml = '';
    let success = false;
    let cStat = '999';
    let xMotivo = 'Erro de comunicação';

    try {
      const httpsAgent = await this.buildHttpsAgent(companyId);
      const ns = 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4';
      const body = `<consStatServ versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe"><tpAmb>${ambiente}</tpAmb><cUF>${this.ufToCode(uf)}</cUF><xServ>STATUS</xServ></consStatServ>`;
      responseXml = await this.soapPost(urls.statusServico, ns, body, httpsAgent);
      const parsed = this.parseResponse(responseXml);
      cStat = parsed.cStat;
      xMotivo = parsed.xMotivo;
      success = ['107', '108'].includes(cStat);
    } catch (e: unknown) {
      xMotivo = e instanceof Error ? e.message : 'Erro de comunicação com a SEFAZ';
      this.sefazLogger.error(`[StatusServico] Error: ${xMotivo}`);
    }

    await this.logTransmission({
      companyId, type: 'NFE',
      endpoint: urls.statusServico,
      method: 'POST',
      requestXml: `<consStatServ><tpAmb>${ambiente}</tpAmb><cUF>${uf}</cUF></consStatServ>`,
      responseXml,
      statusCode: success ? 200 : 500,
      success,
      processingTimeMs: Date.now() - startTime,
    });

    return { success, cStat, xMotivo };
  }

  /**
   * Send a signed NF-e XML for authorization to SEFAZ.
   */
  async autorizarNfe(companyId: string, uf: string, xmlAssinado: string): Promise<SefazResponse> {
    this.validateEnvironment();
    const ambiente = this.getAmbiente() as '1' | '2';
    const urls = getSefazUrls(uf, ambiente);
    const startTime = Date.now();

    this.sefazLogger.log(`[AutorizarNfe] UF=${uf} ambiente=${ambiente}`);

    let responseXml = '';
    let success = false;
    let cStat = '999';
    let xMotivo = 'Erro de comunicação';
    let protocolNumber: string | undefined;

    try {
      const httpsAgent = await this.buildHttpsAgent(companyId);
      const ns = 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4';
      const idLote = Date.now().toString();
      const body = `<enviNFe versao="1.00" xmlns="http://www.portalfiscal.inf.br/nfe"><idLote>${idLote}</idLote><indSinc>1</indSinc>${xmlAssinado}</enviNFe>`;
      responseXml = await this.soapPost(urls.autorizacao, ns, body, httpsAgent);
      const parsed = this.parseResponse(responseXml);
      cStat = parsed.cStat;
      xMotivo = parsed.xMotivo;
      protocolNumber = parsed.nProt;
      success = cStat === '100';
    } catch (e: unknown) {
      xMotivo = e instanceof Error ? e.message : 'Erro de comunicação com a SEFAZ';
      this.sefazLogger.error(`[AutorizarNfe] Error: ${xMotivo}`);
    }

    await this.logTransmission({
      companyId, type: 'NFE',
      endpoint: urls.autorizacao,
      method: 'POST',
      requestXml: xmlAssinado,
      responseXml,
      statusCode: success ? 200 : 500,
      success,
      protocolNumber,
      processingTimeMs: Date.now() - startTime,
    });

    return { success, cStat, xMotivo, protocolNumber, xml: responseXml };
  }

  /**
   * Query NF-e authorization status by access key.
   */
  async consultarProtocolo(companyId: string, uf: string, chaveAcesso: string): Promise<SefazResponse> {
    this.validateEnvironment();
    const ambiente = this.getAmbiente() as '1' | '2';
    const urls = getSefazUrls(uf, ambiente);
    const startTime = Date.now();

    let responseXml = '';
    let success = false;
    let cStat = '999';
    let xMotivo = 'Erro de comunicação';
    let protocolNumber: string | undefined;

    try {
      const httpsAgent = await this.buildHttpsAgent(companyId);
      const ns = 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeConsultaProtocolo4';
      const body = `<consSitNFe versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe"><tpAmb>${ambiente}</tpAmb><xServ>CONSULTAR</xServ><chNFe>${chaveAcesso}</chNFe></consSitNFe>`;
      responseXml = await this.soapPost(urls.consultaProtocolo, ns, body, httpsAgent);
      const parsed = this.parseResponse(responseXml);
      cStat = parsed.cStat;
      xMotivo = parsed.xMotivo;
      protocolNumber = parsed.nProt;
      success = cStat === '100';
    } catch (e: unknown) {
      xMotivo = e instanceof Error ? e.message : 'Erro';
    }

    await this.logTransmission({
      companyId, type: 'NFE',
      endpoint: urls.consultaProtocolo,
      method: 'POST',
      requestXml: `<consSitNFe><chNFe>${chaveAcesso}</chNFe></consSitNFe>`,
      responseXml,
      statusCode: success ? 200 : 500,
      success,
      documentNumber: chaveAcesso,
      protocolNumber,
      processingTimeMs: Date.now() - startTime,
    });

    return { success, cStat, xMotivo, protocolNumber, chaveAcesso };
  }

  /**
   * Cancel an authorized NF-e (event tpEvento=110111).
   */
  async cancelarNfe(companyId: string, uf: string, chaveAcesso: string, protocolo: string, justificativa: string): Promise<SefazResponse> {
    this.validateEnvironment();
    if (justificativa.length < 15) throw new Error('Justificativa deve ter no mínimo 15 caracteres');
    const ambiente = this.getAmbiente() as '1' | '2';
    const urls = getSefazUrls(uf, ambiente);
    const startTime = Date.now();

    let responseXml = '';
    let success = false;
    let cStat = '999';
    let xMotivo = 'Erro de comunicação';
    let protocolNumber: string | undefined;

    try {
      const httpsAgent = await this.buildHttpsAgent(companyId);
      const ns = 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4';
      const dhEvento = new Date().toISOString().slice(0, 19) + '-03:00';
      const nSeqEvento = '1';
      const body = `<envEvento versao="1.00" xmlns="http://www.portalfiscal.inf.br/nfe">
        <idLote>${Date.now()}</idLote>
        <evento versao="1.00">
          <infEvento Id="ID110111${chaveAcesso}${nSeqEvento.padStart(2,'0')}">
            <cOrgao>${this.ufToCode(uf)}</cOrgao>
            <tpAmb>${ambiente}</tpAmb>
            <CNPJ>${chaveAcesso.slice(6, 20)}</CNPJ>
            <chNFe>${chaveAcesso}</chNFe>
            <dhEvento>${dhEvento}</dhEvento>
            <tpEvento>110111</tpEvento>
            <nSeqEvento>${nSeqEvento}</nSeqEvento>
            <verEvento>1.00</verEvento>
            <detEvento versao="1.00">
              <descEvento>Cancelamento</descEvento>
              <nProt>${protocolo}</nProt>
              <xJust>${justificativa}</xJust>
            </detEvento>
          </infEvento>
        </evento>
      </envEvento>`;
      responseXml = await this.soapPost(urls.recepcaoEvento, ns, body, httpsAgent);
      const parsed = this.parseResponse(responseXml);
      cStat = parsed.cStat;
      xMotivo = parsed.xMotivo;
      protocolNumber = parsed.nProt;
      success = ['135', '155'].includes(cStat);
    } catch (e: unknown) {
      xMotivo = e instanceof Error ? e.message : 'Erro';
    }

    await this.logTransmission({
      companyId, type: 'NFE',
      endpoint: urls.recepcaoEvento,
      method: 'POST',
      requestPayload: JSON.stringify({ tpEvento: '110111', chaveAcesso, protocolo, justificativa }),
      responseXml,
      statusCode: success ? 200 : 500,
      success,
      protocolNumber,
      documentNumber: chaveAcesso,
      processingTimeMs: Date.now() - startTime,
    });

    return { success, cStat, xMotivo, protocolNumber, chaveAcesso };
  }

  /**
   * Void a range of NF-e numbers (inutilização).
   */
  async inutilizarNumeracao(companyId: string, uf: string, serie: number, numInicio: number, numFim: number, justificativa: string): Promise<SefazResponse> {
    this.validateEnvironment();
    if (justificativa.length < 15) throw new Error('Justificativa deve ter no mínimo 15 caracteres');
    const ambiente = this.getAmbiente() as '1' | '2';
    const urls = getSefazUrls(uf, ambiente);
    const startTime = Date.now();

    const company = await this.prisma.company.findUnique({ where: { id: companyId }, select: { cnpj: true, uf: true } });
    const cnpj = (company?.cnpj ?? '').replace(/\D/g, '').padStart(14, '0');
    const now = new Date();
    const aamm = now.getFullYear().toString().slice(2) + (now.getMonth() + 1).toString().padStart(2, '0');
    const ufCode = this.ufToCode(uf);
    const idInut = `ID${ufCode}${aamm}${cnpj}55${serie.toString().padStart(3,'0')}${numInicio.toString().padStart(9,'0')}${numFim.toString().padStart(9,'0')}`;

    let responseXml = '';
    let success = false;
    let cStat = '999';
    let xMotivo = 'Erro';
    let protocolNumber: string | undefined;

    try {
      const httpsAgent = await this.buildHttpsAgent(companyId);
      const ns = 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeInutilizacao4';
      const body = `<inutNFe versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">
        <infInut Id="${idInut}">
          <tpAmb>${ambiente}</tpAmb>
          <xServ>INUTILIZAR</xServ>
          <cUF>${ufCode}</cUF>
          <ano>${aamm.slice(0,2)}</ano>
          <CNPJ>${cnpj}</CNPJ>
          <mod>55</mod>
          <serie>${serie}</serie>
          <nNFIni>${numInicio}</nNFIni>
          <nNFFin>${numFim}</nNFFin>
          <xJust>${justificativa}</xJust>
        </infInut>
      </inutNFe>`;
      responseXml = await this.soapPost(urls.inutilizacao, ns, body, httpsAgent);
      const parsed = this.parseResponse(responseXml);
      cStat = parsed.cStat;
      xMotivo = parsed.xMotivo;
      protocolNumber = parsed.nProt;
      success = cStat === '102';
    } catch (e: unknown) {
      xMotivo = e instanceof Error ? e.message : 'Erro';
    }

    await this.logTransmission({
      companyId, type: 'NFE',
      endpoint: urls.inutilizacao,
      method: 'POST',
      requestPayload: JSON.stringify({ serie, numInicio, numFim, justificativa }),
      responseXml,
      statusCode: success ? 200 : 500,
      success,
      protocolNumber,
      processingTimeMs: Date.now() - startTime,
    });

    return { success, cStat, xMotivo, protocolNumber };
  }

  private ufToCode(uf: string): string {
    const codes: Record<string,string> = {
      AC:'12',AL:'27',AP:'16',AM:'13',BA:'29',CE:'23',DF:'53',ES:'32',
      GO:'52',MA:'21',MT:'51',MS:'50',MG:'31',PA:'15',PB:'25',PR:'41',
      PE:'26',PI:'22',RJ:'33',RN:'24',RS:'43',RO:'11',RR:'14',SC:'42',
      SP:'35',SE:'28',TO:'17',
    };
    return codes[uf?.toUpperCase()] ?? '35';
  }
}
