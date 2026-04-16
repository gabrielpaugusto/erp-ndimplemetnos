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
      include: { company: true, nbsCode: true },
    });

    if (!nfse) throw new Error('NFS-e não encontrada');

    const company = nfse.company;
    const competencia = nfse.dataCompetencia.toISOString().substring(0, 7); // YYYY-MM
    const tpAmb = company.ambienteNfse === 1 ? '1' : '2';

    const valorServico = Number(nfse.valorServico);
    const valorPis = Number(nfse.valorPis);
    const valorCofins = Number(nfse.valorCofins);
    const valorCsll = Number(nfse.valorCsll);
    const valorIr = Number(nfse.valorIr);
    const valorInss = Number(nfse.valorInss);

    const pPis =
      valorServico > 0
        ? ((valorPis / valorServico) * 100).toFixed(4)
        : '0.0000';
    const pCofins =
      valorServico > 0
        ? ((valorCofins / valorServico) * 100).toFixed(4)
        : '0.0000';
    const pCsll =
      valorServico > 0
        ? ((valorCsll / valorServico) * 100).toFixed(4)
        : '0.0000';
    const pIr =
      valorServico > 0
        ? ((valorIr / valorServico) * 100).toFixed(4)
        : '0.0000';
    const pInss =
      valorServico > 0
        ? ((valorInss / valorServico) * 100).toFixed(4)
        : '0.0000';

    const tomadorDoc =
      nfse.tomadorCpfCnpj.replace(/\D/g, '').length === 14
        ? `<CNPJ>${nfse.tomadorCpfCnpj.replace(/\D/g, '')}</CNPJ>`
        : `<CPF>${nfse.tomadorCpfCnpj.replace(/\D/g, '')}</CPF>`;

    const endTomador = nfse.tomadorLogradouro
      ? `
      <end>
        <xLgr>${nfse.tomadorLogradouro}</xLgr>
        <nro>${nfse.tomadorNumero ?? 'S/N'}</nro>
        ${nfse.tomadorComplemento ? `<xCpl>${nfse.tomadorComplemento}</xCpl>` : ''}
        <xBairro>${nfse.tomadorBairro ?? ''}</xBairro>
        <cMun>${nfse.tomadorCodMunicipio ?? ''}</cMun>
        <UF>${nfse.tomadorUf ?? ''}</UF>
        <CEP>${nfse.tomadorCep ?? ''}</CEP>
      </end>`
      : '';

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
          <cMun>${company.codigoMunicipioIbge ?? ''}</cMun>
        </locPrestacao>
      </COM>
    </serv>
    <valores>
      <vServPrest>
        <vReceb>${valorServico.toFixed(2)}</vReceb>
      </vServPrest>
      <trib>
        <tribNac>
          <pISS>${nfse.aliquotaIss.toFixed(4)}</pISS>
          <tpRetISSQN>${nfse.issRetido ? '1' : '2'}</tpRetISSQN>
        </tribNac>
        <retTrib>
          <pPIS>${pPis}</pPIS>
          <pCOFINS>${pCofins}</pCOFINS>
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
