import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { basename, extname, join } from 'node:path';

@Injectable()
export class FileStorageService {
  private readonly localStoragePath: string;
  private readonly appPublicUrl: string;
  private readonly s3Endpoint: string | null;
  private readonly s3Region: string;
  private readonly s3Bucket: string | null;
  private readonly s3PublicBaseUrl: string | null;
  private readonly s3ForcePathStyle: boolean;
  private readonly s3Client: S3Client | null;

  constructor(private readonly configService: ConfigService) {
    this.localStoragePath = this.configService.get<string>(
      'FILE_STORAGE_LOCAL_PATH',
      join(process.cwd(), 'uploads', 'tenant-logos'),
    );
    this.appPublicUrl = this.configService.get<string>(
      'APP_PUBLIC_URL',
      'http://localhost:3500',
    );
    this.s3Endpoint = this.configService.get<string>('S3_ENDPOINT') ?? null;
    this.s3Region = this.configService.get<string>('S3_REGION', 'us-east-1');
    this.s3Bucket = this.configService.get<string>('S3_BUCKET') ?? null;
    this.s3PublicBaseUrl =
      this.configService.get<string>('S3_PUBLIC_BASE_URL') ?? null;
    this.s3ForcePathStyle =
      this.configService.get<string>('S3_FORCE_PATH_STYLE', 'true') !== 'false';

    if (!this.s3Bucket) {
      this.s3Client = null;
      return;
    }

    this.s3Client = new S3Client({
      region: this.s3Region,
      endpoint: this.s3Endpoint ?? undefined,
      forcePathStyle: this.s3ForcePathStyle,
      credentials:
        this.configService.get<string>('S3_ACCESS_KEY_ID') &&
        this.configService.get<string>('S3_SECRET_ACCESS_KEY')
          ? {
              accessKeyId: this.configService.get<string>('S3_ACCESS_KEY_ID')!,
              secretAccessKey: this.configService.get<string>(
                'S3_SECRET_ACCESS_KEY',
              )!,
            }
          : undefined,
    });
  }

  isS3StorageEnabled(): boolean {
    return !!(this.s3Client && this.s3Bucket);
  }

  private sanitizeSegment(value: string): string {
    const sanitized = value
      .replace(/[^a-zA-Z0-9._-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    return sanitized || 'file';
  }

  private toS3PublicUrl(objectKey: string): string {
    if (!this.s3Bucket) {
      throw new InternalServerErrorException('S3 bucket is not configured');
    }

    if (this.s3PublicBaseUrl) {
      return `${this.s3PublicBaseUrl.replace(/\/$/, '')}/${objectKey}`;
    }

    if (this.s3Endpoint) {
      return `${this.s3Endpoint.replace(/\/$/, '')}/${this.s3Bucket}/${objectKey}`;
    }

    return `https://${this.s3Bucket}.s3.${this.s3Region}.amazonaws.com/${objectKey}`;
  }

  private async uploadToS3(
    tenantId: string,
    objectName: string,
    file: Express.Multer.File,
  ): Promise<string> {
    if (!this.s3Client || !this.s3Bucket) {
      throw new InternalServerErrorException('S3 client is not configured');
    }

    const objectKey = `tenant-logos/${this.sanitizeSegment(tenantId)}/${objectName}`;

    try {
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.s3Bucket,
          Key: objectKey,
          Body: file.buffer,
          ContentType: file.mimetype,
        }),
      );
    } catch {
      throw new InternalServerErrorException('Failed to store logo file');
    }

    return this.toS3PublicUrl(objectKey);
  }

  private async uploadToLocal(
    tenantId: string,
    objectName: string,
    file: Express.Multer.File,
  ): Promise<string> {
    const safeTenantId = this.sanitizeSegment(tenantId);
    const directoryPath = join(this.localStoragePath, safeTenantId);
    const absolutePath = join(directoryPath, objectName);

    try {
      await fs.mkdir(directoryPath, { recursive: true });
      await fs.writeFile(absolutePath, file.buffer);
    } catch {
      throw new InternalServerErrorException('Failed to store logo file');
    }

    return `${this.appPublicUrl.replace(/\/$/, '')}/api/v1/tenant/logo/${encodeURIComponent(safeTenantId)}/${encodeURIComponent(objectName)}`;
  }

  async uploadTenantLogo(
    tenantId: string,
    file: Express.Multer.File,
  ): Promise<string> {
    if (!file?.buffer) {
      throw new InternalServerErrorException('Logo file is missing content');
    }

    const rawExtension = extname(basename(file.originalname || 'logo'));
    const extension = /^[.a-zA-Z0-9]+$/.test(rawExtension)
      ? rawExtension.toLowerCase()
      : '';
    const objectName = `${Date.now()}-${randomUUID()}${extension || '.bin'}`;

    if (this.isS3StorageEnabled()) {
      return this.uploadToS3(tenantId, objectName, file);
    }

    return this.uploadToLocal(tenantId, objectName, file);
  }

  resolveLocalLogoPath(tenantId: string, fileName: string): string | null {
    if (this.isS3StorageEnabled()) {
      return null;
    }

    const safeTenantId = this.sanitizeSegment(tenantId);
    const safeFileName = this.sanitizeSegment(basename(fileName));

    return join(this.localStoragePath, safeTenantId, safeFileName);
  }
}
