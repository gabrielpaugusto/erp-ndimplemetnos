import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';
import * as https from 'https';
import * as zlib from 'zlib';
import { promisify } from 'util';
import axios from 'axios';
import * as forge from 'node-forge';
import * as crypto from 'crypto';
import { XMLParser } from 'fast-xml-parser';

const gunzip = promisify(zlib.gunzip);

// ─── Tipos da API ADN Contribuinte (swagger oficial RFB) ─────────────────────
export interface DistribuicaoNSU {
  NSU: number | null;
  ChaveAcesso: string | null;
  TipoDocumento: 'NENHUM' | 'DPS' | 'PEDIDO_REGISTRO_EVENTO' | 'NFSE' | 'EVENTO' | 'CNC';
  TipoEvento: string | null;
  ArquivoXml: string | null;        // base64(GZip(XML))
  DataHoraGeracao: string | null;
}

export interface LoteDistribuicaoNSUResponse {
  StatusProcessamento: 'REJEICAO' | 'NENHUM_DOCUMENTO_LOCALIZADO' | 'DOCUMENTOS_LOCALIZADOS';
  LoteDFe: DistribuicaoNSU[] | null;
  Alertas: { Codigo: string; Descricao: string }[] | null;
  Erros: { Codigo: string; Descricao: string }[] | null;
  TipoAmbiente: 'PRODUCAO' | 'HOMOLOGACAO';
  VersaoAplicativo: string | null;
  DataHoraProcessamento: string;
}

export interface NfseRecebidaParsed {
  numero: string;
  chaveAcesso: string | null;
  nsu: number;
  dataHoraGeracao: string | null;
  prestadorCnpj: string;
  prestadorNome: string;
  prestadorIm: string | null;
  prestadorMunicipio: string | null;
  prestadorUf: string | null;
  tomadorCnpj: string | null;
  discriminacao: string | null;
  valorServico: number;
  valorIss: number;
  aliquotaIss: number;
  issRetido: boolean;
  dataEmissao: string;
  dataCompetencia: string | null;
  xmlOriginal: string;
}

@Injectable()
export class NfseRfbClientService {
  private readonly logger = new Logger(NfseRfbClientService.name);
  private readonly xmlParser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    parseTagValue: true,
    trimValues: true,
  });

  constructor(private readonly prisma: PrismaService) {}

  // ─── URLs base por ambiente ──────────────────────────────────────────────
  // Produção:          https://nfse.fazenda.gov.br
  // Produção Restrita: https://adn.producaorestrita.nfse.gov.br/contribuintes
  //   (swagger: https://adn.producaorestrita.nfse.gov.br/contribuintes/docs/index.html)
  //   O domínio hom.nfse.fazenda.gov.br estava bloqueado pelo proxy ARR da RFB.
  private getBaseUrl(ambiente: '1' | '2'): string {
    return ambiente === '1'
      ? 'https://nfse.fazenda.gov.br'
      : 'https://adn.producaorestrita.nfse.gov.br/contribuintes';
  }

  // ─── Agente mTLS com certificado A1 da empresa ──────────────────────────
  private async buildHttpsAgent(companyId: string): Promise<https.Agent> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { certDigitalConteudo: true, certDigitalSenha: true },
    });

    if (!company?.certDigitalConteudo || !company?.certDigitalSenha) {
      throw new Error(
        'Certificado digital não instalado. Instale o certificado A1 em Configurações → NF-e/SEFAZ.',
      );
    }

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
    const senhaBuffer = Buffer.from(company.certDigitalSenha, 'base64');
    const senha = decrypt(senhaBuffer).toString('utf8');

    const p12Asn1 = forge.asn1.fromDer(forge.util.createBuffer(pfxBuffer.toString('binary')));
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, senha);

    const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });

    const keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0];
    const allCerts = certBags[forge.pki.oids.certBag] ?? [];

    if (!keyBag?.key || allCerts.length === 0) {
      throw new Error('Não foi possível extrair chave/certificado do arquivo .pfx');
    }

    const privateKeyPem = forge.pki.privateKeyToPem(keyBag.key);

    // Separar certificado do usuário (primeiro) dos intermediários/raiz
    const clientCert = allCerts[0]?.cert;
    const certChainPem = allCerts
      .map((bag) => forge.pki.certificateToPem(bag.cert!))
      .join('\n');

    // ── Diagnóstico do certificado ──────────────────────────────────────
    if (clientCert) {
      const subject = clientCert.subject.getField('CN')?.value ?? '(sem CN)';
      const notAfter = clientCert.validity.notAfter.toISOString();

      // Verifica Extended Key Usage (OID 1.3.6.1.5.5.7.3.2 = clientAuth)
      const ekuExt = clientCert.getExtension('extKeyUsage') as any;
      const hasClientAuth = ekuExt?.clientAuth === true;
      const ekuValues = ekuExt
        ? Object.entries(ekuExt)
            .filter(([k, v]) => k !== 'name' && k !== 'id' && k !== 'critical' && v === true)
            .map(([k]) => k)
            .join(', ')
        : 'nenhum';

      this.logger.log(
        `[Cert] CN=${subject} | Validade=${notAfter} | EKU=[${ekuValues}] | clientAuth=${hasClientAuth}`,
      );

      if (!hasClientAuth) {
        this.logger.warn(
          '[Cert] ATENÇÃO: O certificado NÃO possui Extended Key Usage "clientAuth" (1.3.6.1.5.5.7.3.2). ' +
          'A API NFS-e ADN exige certificado com "Autenticação do Cliente". ' +
          'Certificados de assinatura (NF-e/SEFAZ) geralmente NÃO têm essa extensão.',
        );
      }
    }
    // ────────────────────────────────────────────────────────────────────

    return new https.Agent({
      key: privateKeyPem,
      cert: certChainPem,
      rejectUnauthorized: true,
    });
  }

  // ─── Descomprime ArquivoXml (base64 → GZip → XML string) ───────────────
  async descomprimirXml(arqBase64: string): Promise<string> {
    const compressed = Buffer.from(arqBase64, 'base64');
    try {
      const decompressed = await gunzip(compressed);
      return decompressed.toString('utf-8');
    } catch {
      // Se não for GZip, pode ser base64 direto de XML
      return compressed.toString('utf-8');
    }
  }

  // ─── Extrai campos principais de um XML de NFS-e ────────────────────────
  // Estrutura real da NFS-e Nacional (RFB):
  // NFSe > infNFSe > emit          (prestador/emitente: CNPJ, xNome, enderNac)
  //                > valores       (vBC, vISSQN, pAliqAplic, vLiq)
  //                > DPS > infDPS > prest  (CNPJ, IM do prestador)
  //                              > toma   (tomador: CNPJ, xNome)
  //                              > serv   > cServ > xDescServ
  //                              > valores > vServPrest > vServ
  //                              > valores > trib > tribMun > tpRetISSQN
  parseNfseXml(xml: string, nsu: number, chaveAcesso: string | null, dataHoraGeracao: string | null): NfseRecebidaParsed {
    let parsed: any = {};
    try {
      parsed = this.xmlParser.parse(xml);
    } catch {
      this.logger.warn(`Não foi possível parsear XML do NSU ${nsu}`);
    }

    const infNFSe = parsed?.NFSe?.infNFSe ?? parsed?.nfse?.infNFSe ?? {};

    // Emitente (prestador) fica em infNFSe.emit
    const emit  = infNFSe?.emit ?? {};
    const ender = emit?.enderNac ?? {};
    const cnpjPrest = String(emit?.CNPJ ?? emit?.cnpj ?? '').replace(/\D/g, '');
    const nomePrest = String(emit?.xNome ?? emit?.razaoSocial ?? '');
    const codMun    = String(ender?.cMun ?? '');
    const uf        = String(ender?.UF   ?? ender?.uf ?? '');

    // Valores do ISS ficam em infNFSe.valores
    const valsNFSe = infNFSe?.valores ?? {};
    const vIss     = Number(valsNFSe?.vISSQN   ?? valsNFSe?.vISS     ?? 0);
    const aliqIss  = Number(valsNFSe?.pAliqAplic ?? valsNFSe?.pAliqIss ?? 0);

    // DPS está aninhado em infNFSe.DPS.infDPS
    const infDPS = infNFSe?.DPS?.infDPS ?? infNFSe?.dps?.infDPS ?? {};

    // IM do prestador em infDPS.prest
    const prest   = infDPS?.prest ?? {};
    const imPrest = String(prest?.IM ?? prest?.im ?? '');

    // Tomador em infDPS.toma
    const toma     = infDPS?.toma ?? infDPS?.tomador ?? {};
    const cnpjToma = String(toma?.CNPJ ?? toma?.cnpj ?? '').replace(/\D/g, '') || null;

    // Discriminação do serviço em infDPS.serv.cServ.xDescServ
    const serv = infDPS?.serv ?? {};
    const cServ = serv?.cServ ?? {};
    const disc  = String(cServ?.xDescServ ?? serv?.xDisc ?? serv?.discriminacao ?? '');

    // Valor do serviço em infDPS.valores.vServPrest.vServ
    const valsDPS   = infDPS?.valores ?? {};
    const vServPrest = valsDPS?.vServPrest ?? {};
    const vServ     = Number(vServPrest?.vServ ?? valsNFSe?.vBC ?? 0);

    // Retenção de ISS: tpRetISSQN=1 → retido na fonte
    const tribMun  = valsDPS?.trib?.tribMun ?? {};
    const issRet   = Number(tribMun?.tpRetISSQN ?? 0) === 1;

    // Número e datas
    const nNumero  = String(infNFSe?.nNFSe ?? infNFSe?.nDFSe ?? nsu);
    const dtEmis   = String(infDPS?.dhEmi  ?? infNFSe?.dhProc ?? dataHoraGeracao ?? '');
    const dtComp   = String(infDPS?.dCompet ?? '') || null;

    return {
      numero: nNumero,
      chaveAcesso,
      nsu,
      dataHoraGeracao,
      prestadorCnpj: cnpjPrest,
      prestadorNome: nomePrest,
      prestadorIm: imPrest || null,
      prestadorMunicipio: codMun || null,
      prestadorUf: uf || null,
      tomadorCnpj: cnpjToma,
      discriminacao: disc || null,
      valorServico: vServ,
      valorIss: vIss,
      aliquotaIss: aliqIss,
      issRetido: issRet,
      dataEmissao: dtEmis || new Date().toISOString(),
      dataCompetencia: dtComp,
      xmlOriginal: xml,
    };
  }

  // ─── Consulta DFe por NSU — endpoint oficial swagger: GET /DFe/{NSU} ───
  async consultarDFe(
    companyId: string,
    ambiente: '1' | '2',
    nsu: bigint,
    cnpj: string,
  ): Promise<LoteDistribuicaoNSUResponse> {
    const agent = await this.buildHttpsAgent(companyId);
    const baseUrl = this.getBaseUrl(ambiente);
    const url = `${baseUrl}/DFe/${nsu.toString()}`;

    this.logger.log(`[NFS-e] GET ${url} | cnpjConsulta=${cnpj} | lote=true`);

    try {
      const response = await axios.get<LoteDistribuicaoNSUResponse>(url, {
        httpsAgent: agent,
        headers: { Accept: 'application/json' },
        params: { cnpjConsulta: cnpj, lote: true },
        timeout: 30000,
      });
      this.logger.log(`[NFS-e] Resposta ${response.status} | StatusProcessamento=${response.data?.StatusProcessamento}`);
      return response.data;
    } catch (err: any) {
      const status = err.response?.status ?? 'sem status';
      const ct = err.response?.headers?.['content-type'] ?? '';
      const body = typeof err.response?.data === 'string'
        ? err.response.data.slice(0, 300)
        : JSON.stringify(err.response?.data ?? {}).slice(0, 300);
      this.logger.error(`[NFS-e] ERRO ${status} | Content-Type: ${ct} | Body: ${body}`);
      throw err;
    }
  }

  // ─── Emitir NFS-e (DPS) ─────────────────────────────────────────────────
  // Produção:          POST /contribuinte/nfse
  // Produção Restrita: POST /nfse  (base já inclui /contribuintes)
  async emitirNfse(companyId: string, ambiente: '1' | '2', dpsXml: string): Promise<any> {
    const agent = await this.buildHttpsAgent(companyId);
    const baseUrl = this.getBaseUrl(ambiente);
    const path = ambiente === '1' ? '/contribuinte/nfse' : '/nfse';

    const response = await axios.post(
      `${baseUrl}${path}`,
      dpsXml,
      {
        httpsAgent: agent,
        headers: { 'Content-Type': 'application/xml', Accept: 'application/json' },
        timeout: 30000,
      },
    );
    return response.data;
  }

  // ─── Cancelar NFS-e ─────────────────────────────────────────────────────
  async cancelarNfse(companyId: string, ambiente: '1' | '2', id: string, motivo: string): Promise<any> {
    const agent = await this.buildHttpsAgent(companyId);
    const baseUrl = this.getBaseUrl(ambiente);
    const path = ambiente === '1' ? `/contribuinte/nfse/${id}` : `/nfse/${id}`;

    const response = await axios.delete(`${baseUrl}${path}`, {
      httpsAgent: agent,
      headers: { 'Content-Type': 'application/json' },
      data: { motivo },
      timeout: 30000,
    });
    return response.data;
  }

  // ─── Consultar NFS-e emitida por ID ─────────────────────────────────────
  async consultarNfse(companyId: string, ambiente: '1' | '2', id: string): Promise<any> {
    const agent = await this.buildHttpsAgent(companyId);
    const baseUrl = this.getBaseUrl(ambiente);
    const path = ambiente === '1' ? `/contribuinte/nfse/${id}` : `/nfse/${id}`;

    const response = await axios.get(`${baseUrl}${path}`, {
      httpsAgent: agent,
      headers: { Accept: 'application/json' },
      timeout: 30000,
    });
    return response.data;
  }
}
