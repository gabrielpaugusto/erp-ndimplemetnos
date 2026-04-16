import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';
import * as forge from 'node-forge';
import * as crypto from 'crypto';

@Injectable()
export class CertificadoService {
  constructor(private readonly prisma: PrismaService) {}

  // AES-256-CBC encryption key from env (must be 32 bytes)
  private get encKey(): Buffer {
    const key = process.env.CERT_ENCRYPTION_KEY;
    if (!key) {
      throw new Error('CERT_ENCRYPTION_KEY não configurada. Defina esta variável de ambiente.');
    }
    // pad or truncate to 32 bytes
    return Buffer.from(key.padEnd(32, '0').slice(0, 32));
  }

  private encrypt(data: Buffer): Buffer {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', this.encKey, iv);
    const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
    // prefix iv (16 bytes) + encrypted
    return Buffer.concat([iv, encrypted]);
  }

  private decrypt(data: Buffer): Buffer {
    const iv = data.subarray(0, 16);
    const encrypted = data.subarray(16);
    const decipher = crypto.createDecipheriv('aes-256-cbc', this.encKey, iv);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]);
  }

  async upload(companyId: string, pfxBuffer: Buffer, senha: string) {
    // Validate the certificate with the password
    let cert: forge.pki.Certificate;
    try {
      const p12Asn1 = forge.asn1.fromDer(forge.util.createBuffer(pfxBuffer.toString('binary')));
      const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, senha);
      const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
      const bag = certBags[forge.pki.oids.certBag]?.[0];
      if (!bag?.cert) throw new Error('Certificado não encontrado no arquivo PFX');
      cert = bag.cert;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new BadRequestException(`Certificado inválido ou senha incorreta: ${msg}`);
    }

    // Extract info
    const cnField = cert.subject.getField('CN');
    const cn: string = (cnField?.value as string | undefined) ?? 'Desconhecido';
    const validade = new Date(cert.validity.notAfter);

    // Check if expired
    if (validade < new Date()) {
      throw new BadRequestException(
        `Certificado vencido em ${validade.toLocaleDateString('pt-BR')}. Utilize um certificado válido.`,
      );
    }

    // Encrypt and save
    const encrypted = this.encrypt(pfxBuffer);
    const senhaEncrypted = this.encrypt(Buffer.from(senha, 'utf8'));

    await this.prisma.company.update({
      where: { id: companyId },
      data: {
        certDigitalConteudo: new Uint8Array(encrypted),
        certDigitalSenha: senhaEncrypted.toString('base64'),
        certDigitalValidade: validade,
        certDigitalCn: cn,
      },
    });

    return {
      cn,
      validade: validade.toISOString(),
      diasRestantes: Math.floor((validade.getTime() - Date.now()) / 86400000),
    };
  }

  async getStatus(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: {
        certDigitalValidade: true,
        certDigitalCn: true,
        certDigitalConteudo: true,
      },
    });
    if (!company) throw new NotFoundException('Empresa não encontrada');
    if (!company.certDigitalConteudo) {
      return { instalado: false };
    }
    const validade = company.certDigitalValidade;
    const diasRestantes = validade
      ? Math.floor((validade.getTime() - Date.now()) / 86400000)
      : null;
    return {
      instalado: true,
      cn: company.certDigitalCn,
      validade: validade?.toISOString() ?? null,
      diasRestantes,
      vencido: diasRestantes !== null && diasRestantes < 0,
      alertaVencimento: diasRestantes !== null && diasRestantes >= 0 && diasRestantes <= 30,
    };
  }

  async remove(companyId: string) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new NotFoundException('Empresa não encontrada');
    await this.prisma.company.update({
      where: { id: companyId },
      data: {
        certDigitalConteudo: null,
        certDigitalSenha: null,
        certDigitalValidade: null,
        certDigitalCn: null,
      },
    });
    return { ok: true };
  }

  // Called by NfeService when signing documents
  async getCertificateForSigning(companyId: string): Promise<{ pfx: Buffer; senha: string }> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: {
        certDigitalConteudo: true,
        certDigitalSenha: true,
        certDigitalValidade: true,
      },
    });
    if (!company?.certDigitalConteudo) {
      throw new BadRequestException('Nenhum certificado digital instalado para esta empresa');
    }
    if (company.certDigitalValidade && company.certDigitalValidade < new Date()) {
      throw new BadRequestException(
        'Certificado digital vencido. Faça upload de um certificado válido.',
      );
    }
    const pfx = this.decrypt(Buffer.from(company.certDigitalConteudo));
    const senhaBuffer = Buffer.from(company.certDigitalSenha!, 'base64');
    const senha = this.decrypt(senhaBuffer).toString('utf8');
    return { pfx, senha };
  }
}
