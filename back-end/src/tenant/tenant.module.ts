import { Global, Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { TenantResolver } from './tenant.resolver';
import { TenantService } from './tenant.service';
import { TenantContext } from './tenant.context';
import { TenantGuard } from './tenant.guard';
import { TenantContextInterceptor } from './tenant-context.interceptor';

@Global()
@Module({
  providers: [
    TenantResolver,
    TenantService,
    TenantContext,
    TenantGuard,
    TenantContextInterceptor,
    {
      provide: APP_GUARD,
      useExisting: TenantGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useExisting: TenantContextInterceptor,
    },
  ],
  exports: [TenantContext],
})
export class TenantModule {}
