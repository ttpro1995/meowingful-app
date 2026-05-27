import { Global, Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { FileStorageModule } from '../file-storage/file-storage.module';
import { RbacModule } from '../rbac/rbac.module';
import { FeatureGuard } from './feature.guard';
import { TenantConfigResolver } from './tenant-config.resolver';
import { TenantConfigService } from './tenant-config.service';
import { TenantResolver } from './tenant.resolver';
import { TenantService } from './tenant.service';
import { TenantContext } from './tenant.context';
import { TenantGuard } from './tenant.guard';
import { TenantContextInterceptor } from './tenant-context.interceptor';
import { TenantLogoAuthGuard } from './tenant-logo-auth.guard';
import { TenantLogoController } from './tenant-logo.controller';

@Global()
@Module({
  imports: [FileStorageModule, RbacModule],
  controllers: [TenantLogoController],
  providers: [
    TenantResolver,
    TenantService,
    TenantConfigResolver,
    TenantConfigService,
    TenantContext,
    TenantGuard,
    FeatureGuard,
    TenantContextInterceptor,
    TenantLogoAuthGuard,
    {
      provide: APP_GUARD,
      useExisting: TenantGuard,
    },
    {
      provide: APP_GUARD,
      useExisting: FeatureGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useExisting: TenantContextInterceptor,
    },
  ],
  exports: [TenantContext, TenantConfigService],
})
export class TenantModule {}
