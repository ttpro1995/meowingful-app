import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuditResolver } from './audit.resolver';
import { AuditService, auditQueueProvider, auditWorkerProvider } from './audit.service';
import { AuditInterceptor } from './audit.interceptor';

@Global()
@Module({
  providers: [
    AuditService,
    AuditResolver,
    auditQueueProvider,
    auditWorkerProvider,
    AuditInterceptor,
    {
      provide: APP_INTERCEPTOR,
      useExisting: AuditInterceptor,
    },
  ],
  exports: [AuditService],
})
export class AuditModule {}
