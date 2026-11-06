import { Injectable, BadRequestException } from '@nestjs/common';
import * as forge from 'node-forge';
import { SignedXml } from 'xml-crypto';

@Injectable()
export class NfeSignerService {
  /**
   * Signs the NF-e XML using RSA-SHA1 with proper C14N (Canonical XML 1.0).
   * Uses xml-crypto for standards-compliant canonicalization per SEFAZ NT 2019.001.
   *
   * @param xml - The unsigned NF-e XML string (must contain <infNFe Id="NFe...">)
   * @param pfxBuffer - The .pfx certificate file content
   * @param senha - The certificate password
   * @returns The signed XML string with <Signature> injected after </infNFe>
   */
  signXml(xml: string, pfxBuffer: Buffer, senha: string): string {
    let privateKeyPem: string;
    let certPem: string;

    try {
      const p12Asn1 = forge.asn1.fromDer(forge.util.createBuffer(pfxBuffer.toString('binary')));
      const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, senha);

      const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
      const keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0];
      if (!keyBag?.key) throw new Error('Chave privada não encontrada no certificado');
      privateKeyPem = forge.pki.privateKeyToPem(keyBag.key as forge.pki.rsa.PrivateKey);

      const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
      const certBag = certBags[forge.pki.oids.certBag]?.[0];
      if (!certBag?.cert) throw new Error('Certificado não encontrado no .pfx');
      certPem = forge.pki.certificateToPem(certBag.cert);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new BadRequestException(`Falha ao carregar certificado para assinatura: ${msg}`);
    }

    const sig = new SignedXml({
      privateKey: privateKeyPem,
      publicCert: certPem,
      canonicalizationAlgorithm: 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
      signatureAlgorithm: 'http://www.w3.org/2000/09/xmldsig#rsa-sha1',
    });

    sig.addReference({
      xpath: "//*[local-name(.)='infNFe']",
      transforms: [
        'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
        'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
      ],
      digestAlgorithm: 'http://www.w3.org/2000/09/xmldsig#sha1',
    });

    // Minify before signing: SEFAZ SP (cStat 588) rejects whitespace between tags
    xml = xml.replace(/>\s+</g, '><').trim();

    try {
      sig.computeSignature(xml, {
        location: {
          reference: "//*[local-name(.)='infNFe']",
          action: 'after',
        },
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new BadRequestException(`Falha ao assinar XML da NF-e: ${msg}`);
    }

    return sig.getSignedXml();
  }
}
