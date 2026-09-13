import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { RbacModule } from '../rbac/rbac.module';
import { FeatureGuard } from '../tenant/feature.guard';
import { TenantGuard } from '../tenant/tenant.guard';
import { CrmResolver } from './crm.resolver';
import { CrmService } from './crm.service';
import {
  CrmQueueLifecycle,
  CrmScheduler,
  crmEventQueueProvider,
} from './crm.queue';

@Global()
@Module({
  imports: [RbacModule],
  providers: [
    CrmResolver,
    CrmService,
    CrmScheduler,
    CrmQueueLifecycle,
    crmEventQueueProvider,
    TenantGuard,
    FeatureGuard,
    {
      provide: APP_GUARD,
      useExisting: TenantGuard,
    },
    {
      provide: APP_GUARD,
      useExisting: FeatureGuard,
    },
  ],
  exports: [CrmService],
})
export class CrmModule {}
