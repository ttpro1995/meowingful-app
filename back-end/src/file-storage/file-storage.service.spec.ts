import { InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileStorageService } from './file-storage.service';

const createFile = (
  overrides: Partial<Express.Multer.File> = {},
): Express.Multer.File =>
  ({
    originalname: 'tenant-logo.png',
    mimetype: 'image/png',
    buffer: Buffer.from('logo-data'),
    ...overrides,
  }) as Express.Multer.File;

describe('FileStorageService', () => {
  let tempPath: string;

  beforeEach(async () => {
    tempPath = join(
      tmpdir(),
      `meowingful-file-storage-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    );
    await fs.mkdir(tempPath, { recursive: true });
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await fs.rm(tempPath, { recursive: true, force: true });
  });

  it('stores tenant logo in local storage when S3 is not configured', async () => {
    const service = new FileStorageService(
      new ConfigService({
        FILE_STORAGE_LOCAL_PATH: tempPath,
        APP_PUBLIC_URL: 'http://app.local',
      }),
    );

    const logoUrl = await service.uploadTenantLogo(
      'tenant #1',
      createFile({ originalname: 'Tenant Logo.PNG' }),
    );

    expect(service.isS3StorageEnabled()).toBe(false);
    expect(logoUrl).toContain('http://app.local/api/v1/tenant/logo/tenant-1/');

    const encodedPath = logoUrl.split('/api/v1/tenant/logo/')[1] ?? '';
    const [tenantSegment, objectSegment] = encodedPath.split('/');

    expect(tenantSegment).toBe('tenant-1');
    const objectName = decodeURIComponent(objectSegment ?? '');
    expect(objectName.endsWith('.png')).toBe(true);

    await expect(
      fs.access(join(tempPath, tenantSegment ?? '', objectName)),
    ).resolves.toBeUndefined();
  });

  it('throws when local file cannot be written', async () => {
    const writeFileSpy = jest
      .spyOn(fs, 'writeFile')
      .mockRejectedValueOnce(new Error('disk-full'));

    const service = new FileStorageService(
      new ConfigService({
        FILE_STORAGE_LOCAL_PATH: tempPath,
      }),
    );

    await expect(
      service.uploadTenantLogo('tenant-1', createFile()),
    ).rejects.toThrow(InternalServerErrorException);
    expect(writeFileSpy).toHaveBeenCalledTimes(1);
  });

  it('throws when logo file content is missing', async () => {
    const service = new FileStorageService(
      new ConfigService({
        FILE_STORAGE_LOCAL_PATH: tempPath,
      }),
    );

    await expect(
      service.uploadTenantLogo(
        'tenant-1',
        createFile({ buffer: undefined as unknown as Buffer }),
      ),
    ).rejects.toThrow(InternalServerErrorException);
  });

  it('returns null local path when S3 storage is enabled', () => {
    const service = new FileStorageService(
      new ConfigService({
        S3_BUCKET: 'tenant-assets',
      }),
    );

    expect(service.isS3StorageEnabled()).toBe(true);
    expect(service.resolveLocalLogoPath('tenant-1', 'logo.png')).toBeNull();
  });

  it('resolves sanitized local logo path in local mode', () => {
    const service = new FileStorageService(
      new ConfigService({
        FILE_STORAGE_LOCAL_PATH: tempPath,
      }),
    );

    const resolved = service.resolveLocalLogoPath(
      'tenant id !!',
      '../logo final.png',
    );

    expect(resolved).toBe(join(tempPath, 'tenant-id', 'logo-final.png'));
  });

  it('uploads to S3 and returns URL with configured public base URL', async () => {
    const sendSpy = jest
      .spyOn(S3Client.prototype, 'send')
      .mockResolvedValue({} as Awaited<ReturnType<S3Client['send']>>);

    const service = new FileStorageService(
      new ConfigService({
        S3_BUCKET: 'tenant-assets',
        S3_ENDPOINT: 'https://s3.internal.local',
        S3_PUBLIC_BASE_URL: 'https://cdn.example.com/',
      }),
    );

    const logoUrl = await service.uploadTenantLogo(
      'tenant #1',
      createFile({
        originalname: 'logo.svg',
        mimetype: 'image/svg+xml',
      }),
    );

    const command = sendSpy.mock.calls[0]?.[0] as PutObjectCommand;
    expect(command.input.Bucket).toBe('tenant-assets');
    expect(command.input.Key).toContain('tenant-logos/tenant-1/');
    expect(command.input.ContentType).toBe('image/svg+xml');
    expect(logoUrl).toContain('https://cdn.example.com/tenant-logos/tenant-1/');
  });

  it('builds URL from S3 endpoint when public base URL is not configured', async () => {
    jest
      .spyOn(S3Client.prototype, 'send')
      .mockResolvedValue({} as Awaited<ReturnType<S3Client['send']>>);

    const service = new FileStorageService(
      new ConfigService({
        S3_BUCKET: 'tenant-assets',
        S3_ENDPOINT: 'https://minio.local:9000/',
      }),
    );

    const logoUrl = await service.uploadTenantLogo('tenant-1', createFile());

    expect(logoUrl).toContain(
      'https://minio.local:9000/tenant-assets/tenant-logos/tenant-1/',
    );
  });

  it('builds AWS S3 URL when endpoint and public base URL are not configured', async () => {
    jest
      .spyOn(S3Client.prototype, 'send')
      .mockResolvedValue({} as Awaited<ReturnType<S3Client['send']>>);

    const service = new FileStorageService(
      new ConfigService({
        S3_BUCKET: 'tenant-assets',
        S3_REGION: 'eu-west-1',
      }),
    );

    const logoUrl = await service.uploadTenantLogo('tenant-1', createFile());

    expect(logoUrl).toContain(
      'https://tenant-assets.s3.eu-west-1.amazonaws.com/tenant-logos/tenant-1/',
    );
  });

  it('throws when S3 upload fails', async () => {
    jest.spyOn(S3Client.prototype, 'send').mockRejectedValueOnce(new Error());

    const service = new FileStorageService(
      new ConfigService({
        S3_BUCKET: 'tenant-assets',
      }),
    );

    await expect(
      service.uploadTenantLogo('tenant-1', createFile()),
    ).rejects.toThrow(InternalServerErrorException);
  });
});
