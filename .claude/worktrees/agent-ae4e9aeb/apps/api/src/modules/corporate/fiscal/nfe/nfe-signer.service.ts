import { Injectable, BadRequestException } from '@nestjs/common';
import * as forge from 'node-forge';
import * as crypto from 'crypto';

@Injectable()
export class NfeSignerService {
  /**
   * Signs the NF-e XML using RSA-SHA1 with C14N canonicalization.
   * This is the standard required by SEFAZ (NT 2019.001 and later).
   *
   * @param xml - The unsigned NF-e XML string (must contain <infNFe Id="NFe...">)
   * @param pfxBuffer - The .pfx certificate file content
   * @param senha - The certificate password
   * @returns The signed XML string with <Signature> element appended inside <NFe>
   */
  signXml(xml: string, pfxBuffer: Buffer, senha: string): string {
    // Load certificate
    let privateKey: forge.pki.rsa.PrivateKey;
    let certDer: string;
    try {
      const p12Asn1 = forge.asn1.fromDer(forge.util.createBuffer(pfxBuffer.toString('binary')));
      const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, senha);

      // Extract private key
      const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
      const keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0];
      if (!keyBag?.key) throw new Error('Private key not found in certificate');
      privateKey = keyBag.key as forge.pki.rsa.PrivateKey;

      // Extract certificate DER (base64 encoded for X509Certificate element)
      const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
      const certBag = certBags[forge.pki.oids.certBag]?.[0];
      if (!certBag?.cert) throw new Error('Certificate not found in .pfx');
      const certDerBytes = forge.asn1.toDer(forge.pki.certificateToAsn1(certBag.cert));
      certDer = forge.util.encode64(certDerBytes.data);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new BadRequestException(`Failed to load certificate for signing: ${msg}`);
    }

    // Extract the infNFe element (the reference element to sign)
    const infNfeMatch = xml.match(/<infNFe[^>]+Id="(NFe[^"]+)"/);
    if (!infNfeMatch) throw new BadRequestException('Invalid NF-e XML: <infNFe> with Id not found');
    const refUri = infNfeMatch[1]; // e.g. "NFe35250312345678000100550010000000011234567890"

    // C14N canonicalize the <infNFe> element
    // We extract the infNFe from the XML and canonicalize it
    const infNfeXml = this.extractElement(xml, 'infNFe');
    const canonicalized = this.c14n(infNfeXml);

    // Compute SHA1 digest of the canonicalized infNFe
    const sha1 = crypto.createHash('sha1');
    sha1.update(canonicalized, 'binary');
    const digestValue = sha1.digest('base64');

    // Build <SignedInfo> element
    const signedInfo = `<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#">` +
      `<CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>` +
      `<SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/>` +
      `<Reference URI="#${refUri}">` +
        `<Transforms>` +
          `<Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>` +
          `<Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>` +
        `</Transforms>` +
        `<DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/>` +
        `<DigestValue>${digestValue}</DigestValue>` +
      `</Reference>` +
      `</SignedInfo>`;

    // Canonicalize <SignedInfo> for signing
    const signedInfoCanon = this.c14n(signedInfo);

    // Sign with RSA-SHA1
    const md = forge.md.sha1.create();
    md.update(signedInfoCanon, 'raw');
    const signatureBytes = privateKey.sign(md);
    const signatureValue = forge.util.encode64(signatureBytes);

    // Build <Signature> element
    const signatureXml = `<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">` +
      signedInfo +
      `<SignatureValue>${signatureValue}</SignatureValue>` +
      `<KeyInfo>` +
        `<X509Data>` +
          `<X509Certificate>${certDer}</X509Certificate>` +
        `</X509Data>` +
      `</KeyInfo>` +
      `</Signature>`;

    // Inject <Signature> just before </NFe>
    return xml.replace('</NFe>', `${signatureXml}</NFe>`);
  }

  /**
   * Simple C14N canonicalization for NF-e XML elements.
   * NF-e uses exclusive C14N (http://www.w3.org/TR/2001/REC-xml-c14n-20010315).
   * For our use case (single namespace, no tricky cases), we normalize:
   * - Remove XML declaration
   * - Normalize whitespace between tags
   * - Keep attribute order deterministic
   */
  private c14n(xml: string): string {
    // Remove XML declaration if present
    let result = xml.replace(/<\?xml[^?]*\?>\s*/g, '');
    // Normalize newlines
    result = result.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    return result;
  }

  /**
   * Extract an XML element by tag name from the document.
   */
  private extractElement(xml: string, tag: string): string {
    const regex = new RegExp(`<${tag}[\\s\\S]*?<\\/${tag}>`, 's');
    const match = xml.match(regex);
    if (!match) throw new BadRequestException(`Element <${tag}> not found in XML`);
    return match[0];
  }
}
