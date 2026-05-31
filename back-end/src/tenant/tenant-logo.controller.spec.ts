import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Response } from 'express';
import { promises as fs } from 'node:fs';
import { TenantLogoController } from './tenant-logo.controller';
import { TenantConfigService } from './tenant-config.service';
import { RequestWithTenantContext } from './tenant.request';

describe('TenantLogoController', () => {
  const uploadTenantLogo = jest.fn();
  const resolveLocalLogoPath = jest.fn();

  const tenantConfigService = {
    uploadTenantLogo,
    resolveLocalLogoPath,
  } as unknown as TenantConfigService;

  const controller = new TenantLogoController(tenantConfigService);

  const createFile = (
    overrides: Partial<Express.Multer.File> = {},
  ): Express.Multer.File =>
    ({
      originalname: 'logo.png',
      mimetype: 'image/png',
      buffer: Buffer.from('logo'),
      ...overrides,
    }) as Express.Multer.File;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('throws when uploaded file is missing', async () => {
    const request = {
      tenantContext: {
        tenantId: 'tenant-1',
      },
    } as RequestWithTenantContext;

    await expect(
      controller.uploadTenantLogo(
        undefined as unknown as Express.Multer.File,
        request,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws when tenant id is missing from request context', async () => {
    const request = {
      tenantContext: null,
    } as RequestWithTenantContext;

    await expect(
      controller.uploadTenantLogo(createFile(), request),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('throws when service does not return a logo URL', async () => {
    uploadTenantLogo.mockResolvedValueOnce({ logoUrl: undefined });
    const request = {
      tenantContext: {
        tenantId: 'tenant-1',
      },
    } as RequestWithTenantContext;

    await expect(
      controller.uploadTenantLogo(createFile(), request),
    ).rejects.toThrow(BadRequestException);
  });

  it('uploads logo and returns generated URL', async () => {
    const file = createFile();
    uploadTenantLogo.mockResolvedValueOnce({
      logoUrl: 'https://cdn.example.com/tenant-1/logo.png',
    });

    const request = {
      tenantContext: {
        tenantId: 'tenant-1',
      },
    } as RequestWithTenantContext;

    const result = await controller.uploadTenantLogo(file, request);

    expect(uploadTenantLogo).toHaveBeenCalledWith('tenant-1', file);
    expect(result).toEqual({
      logoUrl: 'https://cdn.example.com/tenant-1/logo.png',
    });
  });

  it('throws NotFoundException when logo is not served from local storage', async () => {
    resolveLocalLogoPath.mockReturnValueOnce(null);

    const response = {
      sendFile: jest.fn(),
    } as unknown as Response;

    await expect(
      controller.getTenantLogo('tenant-1', 'logo.png', response),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws NotFoundException when logo file does not exist', async () => {
    resolveLocalLogoPath.mockReturnValueOnce('/tmp/missing-logo.png');
    jest.spyOn(fs, 'access').mockRejectedValueOnce(new Error('missing'));

    const response = {
      sendFile: jest.fn(),
    } as unknown as Response;

    await expect(
      controller.getTenantLogo('tenant-1', 'logo.png', response),
    ).rejects.toThrow(NotFoundException);
  });

  it('decodes filename, verifies file existence, and serves the file', async () => {
    resolveLocalLogoPath.mockReturnValueOnce('/tmp/tenant-logo.png');
    jest.spyOn(fs, 'access').mockResolvedValueOnce(undefined);

    const sendFile = jest.fn();
    const response = {
      sendFile,
    } as unknown as Response;

    await controller.getTenantLogo('tenant-1', 'logo%20file.png', response);

    expect(resolveLocalLogoPath).toHaveBeenCalledWith(
      'tenant-1',
      'logo file.png',
    );
    expect(sendFile).toHaveBeenCalledWith('/tmp/tenant-logo.png');
  });
});
