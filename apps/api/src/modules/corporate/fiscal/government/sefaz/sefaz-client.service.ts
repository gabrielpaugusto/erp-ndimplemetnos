import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';
import { ConfigService } from '@nestjs/config';
import { GovernmentTransmissionService } from '../government-transmission.service';
import { getSefazUrls } from './sefaz-urls.config';
import * as https from 'https';
import * as forge from 'node-forge';
import * as crypto from 'crypto';
import * as zlib from 'zlib';
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
    const certKey = process.env.CERT_ENCRYPTION_KEY;
    if (!certKey) {
      throw new Error('CERT_ENCRYPTION_KEY não configurada. Defina esta variável de ambiente.');
    }
    const encKey = Buffer.from(certKey.padEnd(32, '0').slice(0, 32));

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
    const allCerts = certBags[forge.pki.oids.certBag] ?? [];

    if (!keyBag?.key || allCerts.length === 0) {
      throw new Error('Não foi possível extrair chave/certificado do arquivo .pfx');
    }

    // Log certificate subject for diagnostics
    const leafCert = allCerts[0]!.cert!;
    const certSubject = leafCert.subject.attributes
      .map((a: any) => `${a.shortName}=${a.value}`)
      .join(', ');
    this.sefazLogger.log(`[Certificate] Subject: ${certSubject}`);
    this.sefazLogger.log(`[Certificate] Válido até: ${leafCert.validity.notAfter} | Total certs na chain: ${allCerts.length}`);

    const keyPem = forge.pki.privateKeyToPem(keyBag.key);
    // Inclui cadeia completa de certificados (leaf + intermediários)
    const certChainPem = allCerts
      .map((bag) => forge.pki.certificateToPem(bag.cert!))
      .join('\n');

    return new https.Agent({
      key: keyPem,
      cert: certChainPem,
      rejectUnauthorized: false,
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
  async statusServico(companyId: string, uf: string, ambienteOverride?: '1' | '2'): Promise<SefazResponse> {
    this.validateEnvironment();
    const ambiente = (ambienteOverride ?? this.getAmbiente()) as '1' | '2';
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
  async autorizarNfe(companyId: string, uf: string, xmlAssinado: string, ambienteOverride?: '1' | '2'): Promise<SefazResponse> {
    this.validateEnvironment();
    const ambiente = (ambienteOverride ?? this.getAmbiente()) as '1' | '2';
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
  async consultarProtocolo(companyId: string, uf: string, chaveAcesso: string, ambienteOverride?: '1' | '2'): Promise<SefazResponse> {
    this.validateEnvironment();
    const ambiente = (ambienteOverride ?? this.getAmbiente()) as '1' | '2';
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
  async cancelarNfe(companyId: string, uf: string, chaveAcesso: string, protocolo: string, justificativa: string, ambienteOverride?: '1' | '2'): Promise<SefazResponse> {
    this.validateEnvironment();
    if (justificativa.length < 15) throw new Error('Justificativa deve ter no mínimo 15 caracteres');
    const ambiente = (ambienteOverride ?? this.getAmbiente()) as '1' | '2';
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
   * Emitir Carta de Correção Eletrônica (CC-e) — evento tpEvento=110110.
   * Pode ser usada para corrigir dados da NF-e que não alterem valor, remetente,
   * destinatário ou data de emissão.
   */
  async emitirCce(
    companyId: string,
    uf: string,
    chaveAcesso: string,
    nSeqEvento: number,
    xCorrecao: string,
    ambienteOverride?: '1' | '2',
  ): Promise<SefazResponse> {
    this.validateEnvironment();
    if (xCorrecao.length < 15) throw new Error('A correção deve ter no mínimo 15 caracteres');
    const ambiente = (ambienteOverride ?? this.getAmbiente()) as '1' | '2';
    const urls = getSefazUrls(uf, ambiente);
    const startTime = Date.now();

    let responseXml = '';
    let success = false;
    let cStat = '999';
    let xMotivo = 'Erro de comunicação';
    let protocolNumber: string | undefined;

    const xCondUso =
      'A Carta de Correção é disciplinada pelo § 1º-A do art. 7º do Convênio S/N, ' +
      'de 15 de dezembro de 1970 e pode ser utilizada para regularização de erro ocorrido ' +
      'na emissão de documento fiscal, desde que o erro não esteja relacionado com: ' +
      'I - as variáveis que determinam o valor do imposto tais como: base de cálculo, ' +
      'alíquota, diferença de preço, quantidade, valor da operação ou da prestação; ' +
      'II - a correção de dados cadastrais que implique mudança do remetente ou do ' +
      'destinatário; III - a data de emissão ou de saída.';

    try {
      const httpsAgent = await this.buildHttpsAgent(companyId);
      const ns = 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4';
      const dhEvento = new Date().toISOString().slice(0, 19) + '-03:00';
      const nSeq = nSeqEvento.toString().padStart(2, '0');
      const body = `<envEvento versao="1.00" xmlns="http://www.portalfiscal.inf.br/nfe">
        <idLote>${Date.now()}</idLote>
        <evento versao="1.00">
          <infEvento Id="ID110110${chaveAcesso}${nSeq}">
            <cOrgao>${this.ufToCode(uf)}</cOrgao>
            <tpAmb>${ambiente}</tpAmb>
            <CNPJ>${chaveAcesso.slice(6, 20)}</CNPJ>
            <chNFe>${chaveAcesso}</chNFe>
            <dhEvento>${dhEvento}</dhEvento>
            <tpEvento>110110</tpEvento>
            <nSeqEvento>${nSeqEvento}</nSeqEvento>
            <verEvento>1.00</verEvento>
            <detEvento versao="1.00">
              <descEvento>Carta de Correção</descEvento>
              <xCorrecao>${xCorrecao}</xCorrecao>
              <xCondUso>${xCondUso}</xCondUso>
            </detEvento>
          </infEvento>
        </evento>
      </envEvento>`;
      responseXml = await this.soapPost(urls.recepcaoEvento, ns, body, httpsAgent);
      const parsed = this.parseResponse(responseXml);
      cStat = parsed.cStat;
      xMotivo = parsed.xMotivo;
      protocolNumber = parsed.nProt;
      // cStat 135 = evento registrado; 155 = evento já registrado
      success = ['135', '155'].includes(cStat);
    } catch (e: unknown) {
      xMotivo = e instanceof Error ? e.message : 'Erro';
      this.sefazLogger.error(`[EmitirCCe] Error: ${xMotivo}`);
    }

    await this.logTransmission({
      companyId, type: 'NFE',
      endpoint: urls.recepcaoEvento,
      method: 'POST',
      requestPayload: JSON.stringify({ tpEvento: '110110', chaveAcesso, nSeqEvento, xCorrecao }),
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
   * Envia evento de Manifestação do Destinatário ao SEFAZ Nacional (cOrgao 91).
   * tpEvento: 210200=Ciência, 210210=Confirmação, 210220=Desconhecimento, 210240=Não Realizada
   */
  async enviarManifestacao(
    companyId: string,
    chNFe: string,
    cnpjDestinatario: string,
    tipoManifestacao: 'CIENCIA_OPERACAO' | 'CONFIRMACAO_OPERACAO' | 'DESCONHECIMENTO_OPERACAO' | 'OPERACAO_NAO_REALIZADA',
    justificativa?: string,
    ambienteOverride?: '1' | '2',
  ): Promise<{ cStat: string; xMotivo: string; dhRegEvento?: string; nProt?: string }> {
    this.validateEnvironment();

    const tpEventoMap: Record<string, string> = {
      CIENCIA_OPERACAO: '210200',
      CONFIRMACAO_OPERACAO: '210210',
      DESCONHECIMENTO_OPERACAO: '210220',
      OPERACAO_NAO_REALIZADA: '210240',
    };

    const descEventoMap: Record<string, string> = {
      CIENCIA_OPERACAO: 'Ciencia da Operacao',
      CONFIRMACAO_OPERACAO: 'Confirmacao da Operacao',
      DESCONHECIMENTO_OPERACAO: 'Desconhecimento da Operacao',
      OPERACAO_NAO_REALIZADA: 'Operacao nao Realizada',
    };

    const tpEvento = tpEventoMap[tipoManifestacao];
    const descEvento = descEventoMap[tipoManifestacao];
    const ambiente = ambienteOverride ?? (this.getAmbiente() as '1' | '2');
    const dhEvento = new Date().toISOString().slice(0, 19) + '-03:00';
    const nSeqEvento = '1';

    const detEventoContent = tipoManifestacao === 'OPERACAO_NAO_REALIZADA'
      ? `<descEvento>${descEvento}</descEvento><xJust>${justificativa}</xJust>`
      : `<descEvento>${descEvento}</descEvento>`;

    const body = `<envEvento versao="1.00" xmlns="http://www.portalfiscal.inf.br/nfe">
      <idLote>${Date.now()}</idLote>
      <evento versao="1.00">
        <infEvento Id="ID${tpEvento}${chNFe}${nSeqEvento.padStart(2, '0')}">
          <cOrgao>91</cOrgao>
          <tpAmb>${ambiente}</tpAmb>
          <CNPJ>${cnpjDestinatario.replace(/\D/g, '')}</CNPJ>
          <chNFe>${chNFe}</chNFe>
          <dhEvento>${dhEvento}</dhEvento>
          <tpEvento>${tpEvento}</tpEvento>
          <nSeqEvento>${nSeqEvento}</nSeqEvento>
          <verEvento>1.00</verEvento>
          <detEvento versao="1.00">
            ${detEventoContent}
          </detEvento>
        </infEvento>
      </evento>
    </envEvento>`;

    const url = ambiente === '1'
      ? 'https://www.nfe.fazenda.gov.br/NFeRecepcaoEvento4/NFeRecepcaoEvento4.asmx'
      : 'https://hom.nfe.fazenda.gov.br/NFeRecepcaoEvento4/NFeRecepcaoEvento4.asmx';

    const ns = 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4';
    const startTime = Date.now();
    let responseXml = '';
    let success = false;
    let cStat = '999';
    let xMotivo = 'Erro de comunicação';
    let nProt: string | undefined;
    let dhRegEvento: string | undefined;

    try {
      const httpsAgent = await this.buildHttpsAgent(companyId);
      responseXml = await this.soapPost(url, ns, body, httpsAgent);
      const parsed = this.parseResponse(responseXml);
      cStat = parsed.cStat;
      xMotivo = parsed.xMotivo;
      nProt = parsed.nProt;
      const dhMatch = responseXml.match(/<dhRegEvento>([^<]+)<\/dhRegEvento>/);
      dhRegEvento = dhMatch?.[1];
      // 135 = evento registrado; 573 = evento já registrado com mesmo tipo
      success = ['135', '573'].includes(cStat);
    } catch (e: unknown) {
      xMotivo = e instanceof Error ? e.message : 'Erro';
      this.sefazLogger.error(`[enviarManifestacao] Error: ${xMotivo}`);
    }

    await this.logTransmission({
      companyId, type: 'NFE',
      endpoint: url,
      method: 'POST',
      requestPayload: JSON.stringify({ tpEvento, tipoManifestacao, chNFe, cnpjDestinatario }),
      responseXml,
      statusCode: success ? 200 : 500,
      success,
      protocolNumber: nProt,
      documentNumber: chNFe,
      processingTimeMs: Date.now() - startTime,
    });

    return { cStat, xMotivo, dhRegEvento, nProt };
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

  /**
   * Consulta NF-es destinadas ao CNPJ da empresa (DistDFe — NFeDistribuicaoDFe).
   * Retorna documentos a partir do NSU informado (paginação por 50 docs por chamada).
   * Cada docZip retornado é base64+gzip — decodifica e extrai o XML interno.
   */
  async distribuicaoDFe(
    companyId: string,
    uf: string,
    cnpj: string,
    ultNSU: string,
    ambienteOverride?: '1' | '2',
  ): Promise<DistDFeResult> {
    this.validateEnvironment();
    const ambiente = ambienteOverride ?? (this.getAmbiente() as '1' | '2');
    const urls     = getSefazUrls(uf, ambiente);
    const startTime = Date.now();

    const nsuFormatado = ultNSU.padStart(15, '0');
    const ufCode       = this.ufToCode(uf);

    let responseXml = '';
    let success     = false;
    let docs: DistDFeDoc[] = [];
    let maxNSU      = nsuFormatado;
    let cStat       = '999';
    let xMotivo     = 'Erro de comunicação';

    try {
      const httpsAgent = await this.buildHttpsAgent(companyId);
      const ns         = 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe';
      const cnpjLimpo  = cnpj.replace(/\D/g, '').padStart(14, '0');

      const bodyXml = `<distDFeInt versao="1.01" xmlns="http://www.portalfiscal.inf.br/nfe"><tpAmb>${ambiente}</tpAmb><cUFAutor>${ufCode}</cUFAutor><CNPJ>${cnpjLimpo}</CNPJ><distNSU><ultNSU>${nsuFormatado}</ultNSU></distNSU></distDFeInt>`;

      // DistDFe usa SOAP 1.1 com nfeCabecMsg no header
      const envelope = `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <soap:Header>
    <nfeCabecMsg xmlns="${ns}">
      <cUF>${ufCode}</cUF>
      <versaoDados>1.01</versaoDados>
    </nfeCabecMsg>
  </soap:Header>
  <soap:Body>
    <nfeDistDFeInteresse xmlns="${ns}">
      <nfeDadosMsg>${bodyXml}</nfeDadosMsg>
    </nfeDistDFeInteresse>
  </soap:Body>
</soap:Envelope>`;

      const response = await axios.post(urls.distribuicaoDFe, envelope, {
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          SOAPAction: `"${ns}/nfeDistDFeInteresse"`,
        },
        httpsAgent,
        timeout: 30000,
      });
      responseXml = response.data as string;

      const parsed = this.parseResponse(responseXml);
      cStat   = parsed.cStat;
      xMotivo = parsed.xMotivo;
      // 137 = Nenhum documento localizado; 138 = Documento(s) localizado(s)
      success = ['137', '138'].includes(cStat);

      // Sempre extrair ultNSU/maxNSU retornado pelo SEFAZ (presente em 138 e também em 656)
      const ultNSURetornadoMatch = responseXml.match(/<ultNSU>(\d+)<\/ultNSU>/);
      const maxNSUMatch = responseXml.match(/<maxNSU>(\d+)<\/maxNSU>/);
      if (ultNSURetornadoMatch) maxNSU = ultNSURetornadoMatch[1];
      else if (maxNSUMatch) maxNSU = maxNSUMatch[1];

      if (success && cStat === '138') {

        // Extrair cada docZip
        const docZipRegex = /<docZip[^>]*NSU="(\d+)"[^>]*schema="([^"]+)"[^>]*>([^<]+)<\/docZip>/g;
        let match: RegExpExecArray | null;
        while ((match = docZipRegex.exec(responseXml)) !== null) {
          const nsu    = match[1];
          const schema = match[2];
          const b64gz  = match[3].trim();

          try {
            const gz         = Buffer.from(b64gz, 'base64');
            const xmlDecoded = zlib.gunzipSync(gz).toString('utf8');
            docs.push({ nsu, schema, xml: xmlDecoded });
          } catch {
            this.sefazLogger.warn(`[DistDFe] Falha ao descomprimir NSU=${nsu}`);
          }
        }
      }
    } catch (e: unknown) {
      xMotivo = e instanceof Error ? e.message : 'Erro de comunicação com a SEFAZ';
      // Capturar corpo da resposta HTTP 500 para diagnóstico
      const axiosErr = e as any;
      if (axiosErr?.response?.data) {
        this.sefazLogger.error(`[DistDFe] Response body: ${JSON.stringify(axiosErr.response.data).slice(0, 500)}`);
      }
      this.sefazLogger.error(`[DistDFe] Error: ${xMotivo}`);
    }

    await this.logTransmission({
      companyId, type: 'NFE',
      endpoint: urls.distribuicaoDFe,
      method: 'POST',
      requestPayload: JSON.stringify({ ultNSU: nsuFormatado, cnpj: cnpj.replace(/\D/g,'').padStart(14,'0') }),
      responseXml,
      statusCode: success ? 200 : 500,
      success,
      processingTimeMs: Date.now() - startTime,
    });

    try {
      await this.prisma.sefazAuditLog.create({
        data: {
          companyId,
          endpoint: 'NFeDistribuicaoDFe',
          ambiente: ambienteOverride ?? (this.getAmbiente() as string) ?? '2',
          nsuEnviado: nsuFormatado,
          nsuRetornado: maxNSU !== nsuFormatado ? maxNSU : null,
          cStat,
          xMotivo: xMotivo.slice(0, 255),
          totalDocs: docs.length,
          origem: 'ERP',
          duracaoMs: Date.now() - startTime,
          proximaPermitida: cStat === '656' ? new Date(Date.now() + 60 * 60 * 1000) : null,
        },
      });
    } catch (logErr) {
      this.sefazLogger.warn(`[DistDFe] Falha ao gravar audit log: ${logErr instanceof Error ? logErr.message : logErr}`);
    }

    return { success, cStat, xMotivo, docs, maxNSU };
  }

  /**
   * Consulta um documento específico na SEFAZ pelo chave de acesso (consChNFe).
   * Retorna o procNFe completo (com itens), diferente do resNFe (sem itens).
   */
  async consultarChNFe(
    companyId: string,
    uf: string,
    cnpj: string,
    chNFe: string,
    ambienteOverride?: '1' | '2',
  ): Promise<{ xml: string | null; cStat: string; xMotivo: string }> {
    try { this.validateEnvironment(); } catch (e: unknown) {
      return { xml: null, cStat: '999', xMotivo: e instanceof Error ? e.message : 'Ambiente inválido' };
    }
    const ambiente  = ambienteOverride ?? (this.getAmbiente() as '1' | '2');
    const urls      = getSefazUrls(uf, ambiente);
    const ufCode    = this.ufToCode(uf);
    const cnpjLimpo = cnpj.replace(/\D/g, '').padStart(14, '0');
    const chNFeLimpa = chNFe.replace(/\D/g, '');

    const bodyXml = `<distDFeInt versao="1.01" xmlns="http://www.portalfiscal.inf.br/nfe"><tpAmb>${ambiente}</tpAmb><cUFAutor>${ufCode}</cUFAutor><CNPJ>${cnpjLimpo}</CNPJ><consChNFe><chNFe>${chNFeLimpa}</chNFe></consChNFe></distDFeInt>`;
    const ns      = 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe';
    const envelope = `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <soap:Header>
    <nfeCabecMsg xmlns="${ns}">
      <cUF>${ufCode}</cUF>
      <versaoDados>1.01</versaoDados>
    </nfeCabecMsg>
  </soap:Header>
  <soap:Body>
    <nfeDistDFeInteresse xmlns="${ns}">
      <nfeDadosMsg>${bodyXml}</nfeDadosMsg>
    </nfeDistDFeInteresse>
  </soap:Body>
</soap:Envelope>`;

    try {
      const httpsAgent = await this.buildHttpsAgent(companyId);
      const response   = await axios.post(urls.distribuicaoDFe, envelope, {
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          SOAPAction: `"${ns}/nfeDistDFeInteresse"`,
        },
        httpsAgent,
        timeout: 30000,
      });
      const responseXml = response.data as string;
      const parsed = this.parseResponse(responseXml);

      // Extrair docZip do resultado
      const docZipRegex = /<docZip[^>]*NSU="(\d+)"[^>]*schema="([^"]+)"[^>]*>([^<]+)<\/docZip>/g;
      const match = docZipRegex.exec(responseXml);
      if (match) {
        try {
          const gz = Buffer.from(match[3].trim(), 'base64');
          const xml = zlib.gunzipSync(gz).toString('utf8');
          return { xml, cStat: parsed.cStat, xMotivo: parsed.xMotivo };
        } catch {
          return { xml: null, cStat: '999', xMotivo: 'Falha ao descomprimir XML' };
        }
      }
      return { xml: null, cStat: parsed.cStat, xMotivo: parsed.xMotivo };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro de comunicação';
      return { xml: null, cStat: '999', xMotivo: msg };
    }
  }

  /**
   * Faz o parse de um XML de NF-e (procNFe ou resNFe) e retorna os campos
   * necessários para popular o NFeInbox.
   */
  parsearXmlNFe(xml: string): NFeXmlParsed | null {
    try {
      const get = (tag: string) => xml.match(new RegExp(`<${tag}[^>]*>([^<]+)<\/${tag}>`))?.[1]?.trim() ?? '';

      // Dados da nota
      const chNFe     = get('chNFe') || (xml.match(/Id="NFe(\d{44})"/)?.[1] ?? '');
      // resNFe não traz <nNF> nem <serie> — extrair da chave de acesso (44 dígitos):
      // pos 22-24 = série (3 dígitos), pos 25-33 = nNF (9 dígitos)
      const rawNNF    = get('nNF');
      const rawSerie  = get('serie');
      const nNF       = rawNNF  || (chNFe.length === 44 ? String(parseInt(chNFe.slice(25, 34), 10)) : '');
      const serie     = rawSerie || (chNFe.length === 44 ? String(parseInt(chNFe.slice(22, 25), 10)) : '1');
      const dhEmi     = get('dhEmi') || get('dEmi');
      const natOp     = get('natOp');
      const tpNF      = get('tpNF'); // 0=entrada 1=saída (do ponto de vista do emitente)

      // Emitente
      const cnpjEmit  = get('CNPJ');
      const xNomeEmit = get('xNome');

      // Totais
      const vNF       = parseFloat(get('vNF') || '0');
      const vFrete    = parseFloat(get('vFrete') || '0');
      const vSeg      = parseFloat(get('vSeg') || '0');
      const vOutro    = parseFloat(get('vOutro') || '0');
      const vDesc     = parseFloat(get('vDesc') || '0');
      const vProd     = parseFloat(get('vProd') || '0');
      const vICMS     = parseFloat(get('vICMS') || '0');
      const vIPI      = parseFloat(get('vIPI') || '0');
      const vPIS      = parseFloat(get('vPIS') || '0');
      const vCOFINS   = parseFloat(get('vCOFINS') || '0');

      // Itens — cada <det nItem="N">
      const items: NFeXmlItem[] = [];
      const detRegex = /<det\s+nItem="(\d+)"[^>]*>([\s\S]*?)<\/det>/g;
      let detMatch: RegExpExecArray | null;
      while ((detMatch = detRegex.exec(xml)) !== null) {
        const nItem   = parseInt(detMatch[1], 10);
        const detXml  = detMatch[2];
        const gv      = (tag: string) => detXml.match(new RegExp(`<${tag}[^>]*>([^<]+)<\/${tag}>`))?.[1]?.trim() ?? '';

        items.push({
          nItem,
          cProd:   gv('cProd'),
          xProd:   gv('xProd'),
          ncm:     gv('NCM'),
          cfop:    gv('CFOP'),
          uCom:    gv('uCom'),
          qCom:    parseFloat(gv('qCom') || '0'),
          vUnCom:  parseFloat(gv('vUnCom') || '0'),
          vProd:   parseFloat(gv('vProd') || '0'),
          vICMS:   parseFloat(gv('vICMS') || '0'),
          vIPI:    parseFloat(gv('vIPI') || '0'),
          vPIS:    parseFloat(gv('vPIS') || '0'),
          vCOFINS: parseFloat(gv('vCOFINS') || '0'),
        });
      }

      return {
        chNFe, nNF, serie, dhEmi, natOp, tpNF,
        cnpjEmit, xNomeEmit,
        vNF, vFrete, vSeg, vOutro, vDesc, vProd,
        vICMS, vIPI, vPIS, vCOFINS,
        items,
      };
    } catch {
      return null;
    }
  }

  /**
   * Consulta CT-es destinados ao CNPJ da empresa (CTeDistribuicaoDFe — nacional).
   * Funciona exatamente como distribuicaoDFe() mas para CT-e.
   */
  async distribuicaoDFeCte(
    companyId: string,
    uf: string,
    cnpj: string,
    ultNSU: string,
    ambienteOverride?: '1' | '2',
  ): Promise<DistDFeResult> {
    this.validateEnvironment();
    const ambiente    = ambienteOverride ?? (this.getAmbiente() as '1' | '2');
    const startTime   = Date.now();
    const nsuFormatado = ultNSU.padStart(15, '0');
    const ufCode      = this.ufToCode(uf);
    const cnpjLimpo   = cnpj.replace(/\D/g, '').padStart(14, '0');

    // CT-e DistDFe — Ambiente Nacional (AN)
    const endpoint = ambiente === '1'
      ? 'https://www1.cte.fazenda.gov.br/CTeDistribuicaoDFe/CTeDistribuicaoDFe.asmx'
      : 'https://hom1.cte.fazenda.gov.br/CTeDistribuicaoDFe/CTeDistribuicaoDFe.asmx';

    const ns = 'http://www.portalfiscal.inf.br/cte/wsdl/CTeDistribuicaoDFe';

    let responseXml = '';
    let success     = false;
    let docs: DistDFeDoc[] = [];
    let maxNSU      = nsuFormatado;
    let cStat       = '999';
    let xMotivo     = 'Erro de comunicação';

    try {
      const httpsAgent = await this.buildHttpsAgent(companyId);

      // CT-e DistribuicaoDFe usa distDFeInt (mesmo nome do NF-e) com namespace do CT-e
      const bodyXml = `<distDFeInt versao="1.00" xmlns="http://www.portalfiscal.inf.br/cte"><tpAmb>${ambiente}</tpAmb><cUFAutor>${ufCode}</cUFAutor><CNPJ>${cnpjLimpo}</CNPJ><distNSU><ultNSU>${nsuFormatado}</ultNSU></distNSU></distDFeInt>`;

      const envelope = `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <soap:Header>
    <cteCabecMsg xmlns="${ns}">
      <cUF>${ufCode}</cUF>
      <versaoDados>1.00</versaoDados>
    </cteCabecMsg>
  </soap:Header>
  <soap:Body>
    <cteDistDFeInteresse xmlns="${ns}">
      <cteDadosMsg>${bodyXml}</cteDadosMsg>
    </cteDistDFeInteresse>
  </soap:Body>
</soap:Envelope>`;

      const response = await axios.post(endpoint, envelope, {
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          SOAPAction: `"${ns}/cteDistDFeInteresse"`,
        },
        httpsAgent,
        timeout: 30000,
      });
      responseXml = response.data as string;;

      const parsed = this.parseResponse(responseXml);
      cStat   = parsed.cStat;
      xMotivo = parsed.xMotivo;
      success = ['137', '138'].includes(cStat);

      if (success && cStat === '138') {
        const maxNSUMatch = responseXml.match(/<maxNSU>(\d+)<\/maxNSU>/);
        if (maxNSUMatch) maxNSU = maxNSUMatch[1];

        const docZipRegex = /<docZip[^>]*NSU="(\d+)"[^>]*schema="([^"]+)"[^>]*>([^<]+)<\/docZip>/g;
        let match: RegExpExecArray | null;
        while ((match = docZipRegex.exec(responseXml)) !== null) {
          const nsu    = match[1];
          const schema = match[2];
          const b64gz  = match[3].trim();
          try {
            const gz         = Buffer.from(b64gz, 'base64');
            const xmlDecoded = zlib.gunzipSync(gz).toString('utf8');
            docs.push({ nsu, schema, xml: xmlDecoded });
          } catch {
            this.sefazLogger.warn(`[DistDFe-CTe] Falha ao descomprimir NSU=${nsu}`);
          }
        }
      }
    } catch (e: unknown) {
      xMotivo = e instanceof Error ? e.message : 'Erro de comunicação';
      const axiosErr = e as any;
      if (axiosErr?.response?.data) {
        this.sefazLogger.error(`[DistDFe-CTe] Response body: ${JSON.stringify(axiosErr.response.data).slice(0, 500)}`);
      }
      this.sefazLogger.error(`[DistDFe-CTe] Error: ${xMotivo}`);
    }

    await this.logTransmission({
      companyId, type: 'CTE',
      endpoint,
      method: 'POST',
      requestPayload: JSON.stringify({ ultNSU: nsuFormatado, cnpj: cnpjLimpo }),
      responseXml,
      statusCode: success ? 200 : 500,
      success,
      processingTimeMs: Date.now() - startTime,
    });

    try {
      await this.prisma.sefazAuditLog.create({
        data: {
          companyId,
          endpoint: 'CTeDistribuicaoDFe',
          ambiente,
          nsuEnviado: nsuFormatado,
          nsuRetornado: maxNSU !== nsuFormatado ? maxNSU : null,
          cStat,
          xMotivo: xMotivo.slice(0, 255),
          totalDocs: docs.length,
          origem: 'ERP',
          duracaoMs: Date.now() - startTime,
          proximaPermitida: cStat === '656' ? new Date(Date.now() + 60 * 60 * 1000) : null,
        },
      });
    } catch (logErr) {
      this.sefazLogger.warn(`[DistDFe-CTe] Falha ao gravar audit log: ${logErr instanceof Error ? logErr.message : logErr}`);
    }

    return { success, cStat, xMotivo, docs, maxNSU };
  }

  /**
   * Parse XML de CT-e (procCTe, resCTe) retornando campos para CteDocument.
   */
  parsearXmlCTe(xml: string): CTeXmlParsed | null {
    try {
      const get = (tag: string) => xml.match(new RegExp(`<${tag}[^>]*>([^<]+)<\\/${tag}>`))?.[1]?.trim() ?? '';

      // Chave do CT-e (44 dígitos)
      const chCTe = get('chCTe') || (xml.match(/Id="CTe(\d{44})"/)?.[1] ?? '');
      if (!chCTe) return null;

      const nCT    = get('nCT');
      const serie  = get('serie');
      const dhEmi  = get('dhEmi') || get('dEmi');
      const cfop   = get('CFOP');
      const modal  = get('modal'); // 01=rodo, 02=aéreo, 03=aqua, 04=ferro

      // Emitente (transportadora)
      const cnpjEmit  = get('CNPJ');
      const xNomeEmit = get('xNome');

      // Remetente e destinatário
      const remMatch  = xml.match(/<rem[\s\S]*?<\/rem>/);
      const destMatch = xml.match(/<dest[\s\S]*?<\/dest>/);
      const getFrom   = (block: string | null, tag: string) =>
        block?.match(new RegExp(`<${tag}[^>]*>([^<]+)<\\/${tag}>`))?.[1]?.trim() ?? '';

      const remetenteCnpj  = getFrom(remMatch?.[0] ?? null, 'CNPJ');
      const remetenteNome  = getFrom(remMatch?.[0] ?? null, 'xNome');
      const destCnpj       = getFrom(destMatch?.[0] ?? null, 'CNPJ');
      const destNome       = getFrom(destMatch?.[0] ?? null, 'xNome');

      // Valores
      const vTPrest = parseFloat(get('vTPrest') || '0');
      const vRec    = parseFloat(get('vRec')    || '0');
      const vICMS   = parseFloat(get('vICMS')   || '0');
      const pICMS   = parseFloat(get('pICMS')   || '12');
      const vBC     = parseFloat(get('vBC')     || '0');

      // Modal → enum CteModalidade
      const modalMap: Record<string, string> = {
        '01': 'RODOVIARIO', '02': 'AEREO', '03': 'AQUAVIARIO',
        '04': 'FERROVIARIO', '05': 'DUTOVIARIO', '06': 'MULTIMODAL',
      };
      const modalidade = modalMap[modal] ?? 'RODOVIARIO';

      // NF-es cobertas por este CT-e
      // CT-e 3.x: <infNFe><chNFe>44digits</chNFe></infNFe>
      // CT-e 4.x: <infNFe><chave>44digits</chave></infNFe>
      const refNFes: string[] = [];
      const infNFeBlocks = xml.match(/<infNFe>[\s\S]*?<\/infNFe>/g) ?? [];
      for (const block of infNFeBlocks) {
        const ch = block.match(/<(?:chNFe|chave)>(\d{44})<\/(?:chNFe|chave)>/)?.[1];
        if (ch) refNFes.push(ch);
      }

      return {
        chCTe, nCT, serie, dhEmi, cfop, modalidade,
        cnpjEmit, xNomeEmit,
        remetenteCnpj, remetenteNome, destCnpj, destNome,
        vTPrest, vRec, vICMS, pICMS, vBC,
        refNFes,
      };
    } catch {
      return null;
    }
  }

  /**
   * Parse XML de MDF-e (procMDFe, resMDFe) retornando campos para MdfeInbox.
   */
  parsearXmlMDFe(xml: string): MDFeXmlParsed | null {
    try {
      const get = (tag: string) => xml.match(new RegExp(`<${tag}[^>]*>([^<]+)<\\/${tag}>`))?.[1]?.trim() ?? '';

      const chMDFe = get('chMDFe') || (xml.match(/Id="MDFe(\d{44})"/)?.[1] ?? '');
      if (!chMDFe) return null;

      return {
        chMDFe,
        nMDF:      get('nMDF'),
        serie:     get('serie'),
        dhEmi:     get('dhEmi') || get('dEmi'),
        modal:     get('modal'),
        cnpjEmit:  get('CNPJ'),
        xNomeEmit: get('xNome'),
        ufIni:     get('cUFIni') ? null : get('UFIni'),
        ufFim:     get('cUFFim') ? null : get('UFFim'),
      };
    } catch {
      return null;
    }
  }

  /**
   * Parse XML de Evento DF-e (resEvento, procEventoNFe, procEventoCTe).
   */
  parsearXmlEvento(xml: string): DFeEventoParsed | null {
    try {
      const get = (tag: string) => xml.match(new RegExp(`<${tag}[^>]*>([^<]+)<\\/${tag}>`))?.[1]?.trim() ?? '';

      // A chave pode estar em chNFe, chCTe ou chMDFe
      const chNFe  = get('chNFe');
      const chCTe  = get('chCTe');
      const chMDFe = get('chMDFe');
      const chDFe  = chNFe || chCTe || chMDFe;
      if (!chDFe) return null;

      const tipoDocumento = chNFe ? 'NFe' : chCTe ? 'CTe' : 'MDFe';

      return {
        chDFe,
        tipoDocumento,
        tpEvento:     get('tpEvento'),
        xEvento:      get('xEvento'),
        nSeqEvento:   parseInt(get('nSeqEvento') || '1', 10),
        dhRegEvento:  get('dhRegEvento'),
        cStat:        get('cStat'),
      };
    } catch {
      return null;
    }
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

// ── Tipos DistDFe ─────────────────────────────────────────────────────────────
export interface DistDFeDoc {
  nsu:    string;
  schema: string; // 'resNFe', 'procNFe', 'resEvento', etc.
  xml:    string;
}

export interface DistDFeResult {
  success: boolean;
  cStat:   string;
  xMotivo: string;
  docs:    DistDFeDoc[];
  maxNSU:  string;
}

export interface NFeXmlItem {
  nItem:   number;
  cProd:   string;
  xProd:   string;
  ncm:     string;
  cfop:    string;
  uCom:    string;
  qCom:    number;
  vUnCom:  number;
  vProd:   number;
  vICMS:   number;
  vIPI:    number;
  vPIS:    number;
  vCOFINS: number;
}

export interface NFeXmlParsed {
  chNFe:     string;
  nNF:       string;
  serie:     string;
  dhEmi:     string;
  natOp:     string;
  tpNF:      string;
  cnpjEmit:  string;
  xNomeEmit: string;
  vNF:       number;
  vFrete:    number;
  vSeg:      number;
  vOutro:    number;
  vDesc:     number;
  vProd:     number;
  vICMS:     number;
  vIPI:      number;
  vPIS:      number;
  vCOFINS:   number;
  items:     NFeXmlItem[];
}

export interface CTeXmlParsed {
  chCTe:         string;
  nCT:           string;
  serie:         string;
  dhEmi:         string;
  cfop:          string;
  modalidade:    string;
  cnpjEmit:      string;
  xNomeEmit:     string;
  remetenteCnpj: string;
  remetenteNome: string;
  destCnpj:      string;
  destNome:      string;
  vTPrest:       number;
  vRec:          number;
  vICMS:         number;
  pICMS:         number;
  vBC:           number;
  refNFes:       string[]; // chaves das NF-es cobertas por este CT-e
}

export interface MDFeXmlParsed {
  chMDFe:    string;
  nMDF:      string;
  serie:     string;
  dhEmi:     string;
  modal:     string;  // 01=Rodoviário, 02=Aéreo, 03=Aquaviário, 04=Ferroviário
  cnpjEmit:  string;
  xNomeEmit: string;
  ufIni:     string | null;
  ufFim:     string | null;
}

export interface DFeEventoParsed {
  chDFe:        string;
  tipoDocumento: string; // NFe | CTe | MDFe
  tpEvento:     string;  // ex: 110111=Cancelamento
  xEvento:      string;
  nSeqEvento:   number;
  dhRegEvento:  string;
  cStat:        string;
}
