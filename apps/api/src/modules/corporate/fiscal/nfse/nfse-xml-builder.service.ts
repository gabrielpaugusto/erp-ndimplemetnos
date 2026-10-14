import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';
import * as forge from 'node-forge';
import { SignedXml } from 'xml-crypto';
import * as crypto from 'crypto';

@Injectable()
export class NfseXmlBuilderService {
  constructor(private readonly prisma: PrismaService) {}

  async buildDps(nfseId: string): Promise<string> {
    const nfse = await this.prisma.nfseEmitida.findUnique({
      where: { id: nfseId },
      include: {
        company: {
          include: {
            taxRegimeConfigs: {
              where: { vigenciaFim: null },
              orderBy: { vigenciaInicio: 'desc' },
              take: 1,
            },
          },
        },
        nbsCode: true,
        lc116Servico: true,
      },
    });

    if (!nfse) throw new Error('NFS-e não encontrada');

    const company = nfse.company;
    const competencia = nfse.dataCompetencia.toISOString().substring(0, 7);
    const tpAmb = company.ambienteNfse === 1 ? '1' : '2';

    // LC 214/2025: PIS/COFINS extintos; CBS assume para serviços a partir de 01/01/2027.
    // Regras dependem da data de emissão — compatibilidade total com homologação em 2026.
    const anoEmissao = nfse.dataEmissao.getFullYear();
    const regime2027 = anoEmissao >= 2027;

    // Alíquotas CBS/IBS do TaxRegimeConfig ativo (parametrizáveis)
    const taxCfg = (company as any).taxRegimeConfigs?.[0];
    const ALIQ_CBS_PAD  = taxCfg?.aliqCbsPadrao    ? Number(taxCfg.aliqCbsPadrao)    : 0.9;    // 0,9% teste 2026
    const ALIQ_IBS_UF   = taxCfg?.aliqIbsUfPadrao  ? Number(taxCfg.aliqIbsUfPadrao)  : 0.05;   // 0,05% estadual
    const ALIQ_IBS_MUN  = taxCfg?.aliqIbsMunPadrao ? Number(taxCfg.aliqIbsMunPadrao) : 0.05;   // 0,05% municipal

    const valorServico  = Number(nfse.valorServico);
    const valorDeducoes = Number(nfse.valorDeducoes ?? 0);
    const valorCsll     = Number(nfse.valorCsll);
    const valorIr       = Number(nfse.valorIr);
    const valorInss     = Number(nfse.valorInss);
    const valorIss      = Number(nfse.valorIss);

    // CBS/IBS: usa valores do banco se preenchidos, senão auto-calc para tributado
    const cstIbsCbs = (nfse as any).cstIbsCbs ?? '000';
    const tributado  = cstIbsCbs === '000';

    let valorCbs    = Number((nfse as any).valorCbs ?? 0);
    let aliqCbs     = Number((nfse as any).aliqCbs  ?? 0);
    let valorIbsUf  = Number((nfse as any).valorIbsUf  ?? 0);
    let aliqIbsUf   = Number((nfse as any).aliqIbsUf   ?? 0);
    let valorIbsMun = Number((nfse as any).valorIbsMun ?? 0);
    let aliqIbsMun  = Number((nfse as any).aliqIbsMun  ?? 0);

    if (regime2027 && tributado && valorCbs === 0 && valorIbsUf === 0) {
      // Auto-calc CBS/IBS sobre base = valorServico - deduções
      const base  = valorServico - valorDeducoes;
      aliqCbs     = ALIQ_CBS_PAD;
      valorCbs    = parseFloat((base * aliqCbs / 100).toFixed(2));
      aliqIbsUf   = ALIQ_IBS_UF;
      valorIbsUf  = parseFloat((base * aliqIbsUf / 100).toFixed(2));
      aliqIbsMun  = ALIQ_IBS_MUN;
      valorIbsMun = parseFloat((base * aliqIbsMun / 100).toFixed(2));
    }

    const valorIbsTot = valorIbsUf + valorIbsMun;

    // vLiq = valorServico - deduções - retenções (ISS retido, IRRF, CSLL, INSS)
    const retencoes = (nfse.issRetido ? valorIss : 0) + valorIr + valorCsll + valorInss;
    const vLiq      = valorServico - valorDeducoes - retencoes;

    // vNF: 2026 = vLiq | 2027 = vLiq + vCBS + vIBSTot (CBS/IBS entram na nota)
    const vNF = regime2027
      ? parseFloat((vLiq + valorCbs + valorIbsTot).toFixed(2))
      : parseFloat(vLiq.toFixed(2));

    // Alíquotas p/ retTrib (para cálculo percentual)
    const base4pct  = valorServico > 0 ? valorServico : 1;
    const pCsll     = ((valorCsll / base4pct) * 100).toFixed(4);
    const pIr       = ((valorIr   / base4pct) * 100).toFixed(4);
    const pInss     = ((valorInss / base4pct) * 100).toFixed(4);
    // PIS/COFINS: só em 2026; zerados e omitidos em 2027
    const valorPis    = regime2027 ? 0 : Number(nfse.valorPis);
    const valorCofins = regime2027 ? 0 : Number(nfse.valorCofins);
    const pPis    = ((valorPis    / base4pct) * 100).toFixed(4);
    const pCofins = ((valorCofins / base4pct) * 100).toFixed(4);

    // NT 009 — tribMun
    const cRegTrib    = (nfse as any).cRegTrib    ?? 3;
    const cRegEspTrib = (nfse as any).cRegEspTrib ?? 0;
    const indSN       = (nfse as any).indSN       ?? 2;
    const cMunFg      = (nfse as any).cMunFg      ?? company.codigoMunicipioIbge ?? '';
    const cServMun    = nfse.lc116Servico?.codigo  ?? '';

    // NT 009 — Exigibilidade ISS (tribNac)
    const indExigIssqn      = (nfse as any).indExigIssqn      ?? 1;
    const nProcessoSuspenso = (nfse as any).nProcessoSuspenso ?? null;

    // NT 009 — Descontos
    const vDescIncond = Number((nfse as any).vDescIncond ?? 0);
    const vDescCond   = Number((nfse as any).vDescCond   ?? 0);

    const tomadorDoc =
      nfse.tomadorCpfCnpj.replace(/\D/g, '').length === 14
        ? `<CNPJ>${nfse.tomadorCpfCnpj.replace(/\D/g, '')}</CNPJ>`
        : `<CPF>${nfse.tomadorCpfCnpj.replace(/\D/g, '')}</CPF>`;

    const endTomador = nfse.tomadorLogradouro
      ? `<end>
        <xLgr>${nfse.tomadorLogradouro}</xLgr>
        <nro>${nfse.tomadorNumero ?? 'S/N'}</nro>
        ${nfse.tomadorComplemento ? `<xCpl>${nfse.tomadorComplemento}</xCpl>` : ''}
        <xBairro>${nfse.tomadorBairro ?? ''}</xBairro>
        <cMun>${nfse.tomadorCodMunicipio ?? ''}</cMun>
        <UF>${nfse.tomadorUf ?? ''}</UF>
        <CEP>${nfse.tomadorCep ?? ''}</CEP>
      </end>`
      : '';

    // Bloco IBSCBS no tribNac — apenas para 2027+ (CBS substitui PIS/COFINS nos serviços)
    const ibscbsBlock = regime2027
      ? `<IBSCBS>
          <CST>${cstIbsCbs}</CST>
          <gCBS>
            <pAliqCBS>${aliqCbs.toFixed(4)}</pAliqCBS>
            <vCBS>${valorCbs.toFixed(2)}</vCBS>
          </gCBS>
          ${valorIbsUf > 0 ? `<gIBSUF>
            <pAliqIBSUF>${aliqIbsUf.toFixed(4)}</pAliqIBSUF>
            <vIBSUF>${valorIbsUf.toFixed(2)}</vIBSUF>
          </gIBSUF>` : ''}
          ${valorIbsMun > 0 ? `<gIBSMun>
            <pAliqIBSMun>${aliqIbsMun.toFixed(4)}</pAliqIBSMun>
            <vIBSMun>${valorIbsMun.toFixed(2)}</vIBSMun>
          </gIBSMun>` : ''}
        </IBSCBS>`
      : '';

    // retTrib: PIS/COFINS apenas em 2026 (extintos em 2027)
    const retTribPisCofins = regime2027
      ? ''
      : `<pPIS>${pPis}</pPIS>
          <pCOFINS>${pCofins}</pCOFINS>`;

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<DPS xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.00">
  <infDPS Id="DPS${nfse.id}">
    <tpAmb>${tpAmb}</tpAmb>
    <dhEmi>${nfse.dataEmissao.toISOString()}</dhEmi>
    <verAplic>1.00</verAplic>
    <serie>${nfse.serie}</serie>
    <nDPS>${nfse.numero}</nDPS>
    <dCompet>${competencia}</dCompet>
    <prest>
      <CNPJ>${company.cnpj}</CNPJ>
      <IM>${company.inscricaoMunicipal ?? ''}</IM>
      <xNome>${company.razaoSocial}</xNome>
      <end>
        <xLgr>${company.logradouro ?? ''}</xLgr>
        <nro>${company.numero ?? 'S/N'}</nro>
        <xBairro>${company.bairro ?? ''}</xBairro>
        <cMun>${company.codigoMunicipioIbge ?? ''}</cMun>
        <UF>${company.uf ?? ''}</UF>
        <CEP>${company.cep ?? ''}</CEP>
      </end>
    </prest>
    <toma>
      ${tomadorDoc}
      <xNome>${nfse.tomadorNome}</xNome>
      ${endTomador}
      ${nfse.tomadorEmail ? `<email>${nfse.tomadorEmail}</email>` : ''}
      ${nfse.tomadorTelefone ? `<fone>${nfse.tomadorTelefone}</fone>` : ''}
    </toma>
    <serv>
      <cServ>
        <cNBS>${nfse.nbsCode?.codigo ?? ''}</cNBS>
        <xDescServ>${nfse.discriminacao}</xDescServ>
      </cServ>
      <COM>
        <locPrestacao>
          <cMun>${cMunFg}</cMun>
          <cPais>1058</cPais>
        </locPrestacao>
      </COM>
    </serv>
    <valores>
      <vServPrest>
        <vReceb>${valorServico.toFixed(2)}</vReceb>
        ${valorDeducoes  > 0 ? `<vDeducao>${valorDeducoes.toFixed(2)}</vDeducao>`     : ''}
        ${vDescIncond    > 0 ? `<vDescIncond>${vDescIncond.toFixed(2)}</vDescIncond>` : ''}
        ${vDescCond      > 0 ? `<vDescCond>${vDescCond.toFixed(2)}</vDescCond>`       : ''}
      </vServPrest>
      <vNF>${vNF.toFixed(2)}</vNF>
      <trib>
        <tribNac>
          <pISS>${nfse.aliquotaIss.toFixed(4)}</pISS>
          <tpRetISSQN>${nfse.issRetido ? '1' : '2'}</tpRetISSQN>
          <indExigISSQN>${indExigIssqn}</indExigISSQN>
          ${nProcessoSuspenso ? `<nProcessoSuspenso>${nProcessoSuspenso}</nProcessoSuspenso>` : ''}
          ${ibscbsBlock}
        </tribNac>
        <tribMun>
          <cMunFG>${cMunFg}</cMunFG>
          ${cServMun ? `<cServMun>${cServMun}</cServMun>` : ''}
          <cRegTrib>${cRegTrib}</cRegTrib>
          <cRegEspTrib>${cRegEspTrib}</cRegEspTrib>
          <indSN>${indSN}</indSN>
        </tribMun>
        <retTrib>
          ${retTribPisCofins}
          <pCSLL>${pCsll}</pCSLL>
          <pIRRF>${pIr}</pIRRF>
          <pINSS>${pInss}</pINSS>
        </retTrib>
      </trib>
    </valores>
  </infDPS>
</DPS>`;

    return xml;
  }

  /**
   * Assina o DPS com assinatura XMLDSig (enveloped RSA-SHA256) usando o
   * certificado A1 da empresa armazenado criptografado no banco.
   */
  async assinarDps(xmlDps: string, companyId: string): Promise<string> {
    // Buscar certificado da empresa
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { certDigitalConteudo: true, certDigitalSenha: true },
    });

    if (!company?.certDigitalConteudo || !company?.certDigitalSenha) {
      throw new Error(
        'Certificado digital não instalado. Instale o certificado A1 em Configurações → NF-e/SEFAZ.',
      );
    }

    // Descriptografar certificado (AES-256-CBC com IV prefix — mesma lógica do SefazClientService)
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

    // Extrair chave privada e certificado do PFX com node-forge
    const p12Asn1 = forge.asn1.fromDer(forge.util.createBuffer(pfxBuffer.toString('binary')));
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, senha);

    const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
    const keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0];
    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
    const allCerts = certBags[forge.pki.oids.certBag] ?? [];

    if (!keyBag?.key) throw new Error('Chave privada não encontrada no certificado');
    if (allCerts.length === 0) throw new Error('Certificado não encontrado no PFX');

    const privateKeyPem = forge.pki.privateKeyToPem(keyBag.key);
    const certPem = forge.pki.certificateToPem(allCerts[0]!.cert!);

    // Extrair base64 do certificado (sem headers PEM) para KeyInfo
    const certBase64Clean = certPem
      .replace('-----BEGIN CERTIFICATE-----', '')
      .replace('-----END CERTIFICATE-----', '')
      .replace(/\r?\n/g, '');

    // Assinar com xml-crypto (XMLDSig enveloped RSA-SHA256)
    const sig = new SignedXml({ privateKey: privateKeyPem });

    sig.addReference({
      xpath: '//*[local-name()="DPS"]',
      digestAlgorithm: 'http://www.w3.org/2001/04/xmlenc#sha256',
      transforms: [
        'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
        'http://www.w3.org/2001/10/xml-exc-c14n#',
      ],
    });

    (sig as any).signingKey = privateKeyPem;
    (sig as any).canonicalizationAlgorithm = 'http://www.w3.org/2001/10/xml-exc-c14n#';
    (sig as any).signatureAlgorithm = 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256';

    // Adicionar X509Certificate ao KeyInfo
    (sig as any).keyInfoProvider = {
      getKeyInfo: () =>
        `<X509Data><X509Certificate>${certBase64Clean}</X509Certificate></X509Data>`,
      getKey: () => Buffer.from(privateKeyPem),
    };

    sig.computeSignature(xmlDps);
    return sig.getSignedXml();
  }
}
