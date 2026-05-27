import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { promises as fs } from 'node:fs';
import type { Response } from 'express';
import { TenantConfigService } from './tenant-config.service';
import { TenantLogoAuthGuard } from './tenant-logo-auth.guard';
import type { RequestWithTenantContext } from './tenant.request';

@Controller('tenant/logo')
export class TenantLogoController {
  constructor(private readonly tenantConfigService: TenantConfigService) {}

  @Post()
  @UseGuards(TenantLogoAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 2 * 1024 * 1024,
      },
      fileFilter: (_req, file, callback) => {
        if (!file.mimetype.startsWith('image/')) {
          callback(
            new BadRequestException(
              'Only image uploads are supported for logo',
            ),
            false,
          );
          return;
        }

        callback(null, true);
      },
    }),
  )
  async uploadTenantLogo(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: RequestWithTenantContext,
  ): Promise<{ logoUrl: string }> {
    if (!file) {
      throw new BadRequestException('Logo file is required');
    }

    const tenantId = req.tenantContext?.tenantId;
    if (!tenantId) {
      throw new UnauthorizedException('UNAUTHORIZED');
    }

    const tenantConfig = await this.tenantConfigService.uploadTenantLogo(
      tenantId,
      file,
    );

    if (!tenantConfig.logoUrl) {
      throw new BadRequestException('Logo URL was not generated');
    }

    return {
      logoUrl: tenantConfig.logoUrl,
    };
  }

  @Get(':tenantId/:fileName')
  async getTenantLogo(
    @Param('tenantId') tenantId: string,
    @Param('fileName') fileName: string,
    @Res() res: Response,
  ): Promise<void> {
    const localPath = this.tenantConfigService.resolveLocalLogoPath(
      tenantId,
      decodeURIComponent(fileName),
    );

    if (!localPath) {
      throw new NotFoundException('Logo is not served from local storage');
    }

    try {
      await fs.access(localPath);
    } catch {
      throw new NotFoundException('Logo not found');
    }

    res.sendFile(localPath);
  }
}
