import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as Minio from 'minio';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private client: Minio.Client;
  private readonly bucket = 'erp-attachments';

  async onModuleInit() {
    this.client = new Minio.Client({
      endPoint: process.env.MINIO_ENDPOINT || 'localhost',
      port: parseInt(process.env.MINIO_PORT || '9000'),
      useSSL: false,
      accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
      secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
    });

    try {
      const exists = await this.client.bucketExists(this.bucket);
      if (!exists) {
        await this.client.makeBucket(this.bucket);
        this.logger.log(`Bucket '${this.bucket}' criado.`);
      } else {
        this.logger.log(`Bucket '${this.bucket}' já existe.`);
      }

      // Bucket dedicado para XMLs de NF-e (backup imutável)
      const nfeBucket = 'nfe-xml';
      const nfeBucketExists = await this.client.bucketExists(nfeBucket);
      if (!nfeBucketExists) {
        await this.client.makeBucket(nfeBucket, 'us-east-1');
        this.logger.log(`Bucket '${nfeBucket}' criado.`);
      }
    } catch (err) {
      this.logger.warn(`Não foi possível conectar ao MinIO: ${err}. Uploads desabilitados.`);
    }
  }

  async upload(
    objectKey: string,
    buffer: Buffer,
    mimeType: string,
  ): Promise<{ bucket: string; objectKey: string; fileUrl: string }> {
    await this.client.putObject(this.bucket, objectKey, buffer, buffer.length, {
      'Content-Type': mimeType,
    });
    const fileUrl = `http://${process.env.MINIO_ENDPOINT || 'localhost'}:${process.env.MINIO_PORT || '9000'}/${this.bucket}/${objectKey}`;
    return { bucket: this.bucket, objectKey, fileUrl };
  }

  async getPresignedUrl(objectKey: string, expirySeconds = 3600): Promise<string> {
    return this.client.presignedGetObject(this.bucket, objectKey, expirySeconds);
  }

  async delete(objectKey: string): Promise<void> {
    await this.client.removeObject(this.bucket, objectKey);
  }

  getBucket(): string {
    return this.bucket;
  }

  async ping(): Promise<boolean> {
    try {
      await this.client.bucketExists(this.bucket);
      return true;
    } catch {
      return false;
    }
  }

  async uploadNfeXml(nfeId: string, chaveAcesso: string, xml: string): Promise<string | null> {
    const key = `nfe/${chaveAcesso}.xml`;
    try {
      await this.client.putObject('nfe-xml', key, Buffer.from(xml, 'utf8'), {
        'Content-Type': 'application/xml',
        'x-amz-meta-nfe-id': nfeId,
      });
      return key;
    } catch (e) {
      this.logger.warn(`MinIO NF-e upload failed ${nfeId}: ${(e as any)?.message ?? e}`);
      return null;
    }
  }
}
