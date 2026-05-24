import { Module, Global } from '@nestjs/common';
import { PermissionService } from './permission.service';
import { PermissionGuard } from './permission.guard';
import { RbacResolver } from './rbac.resolver';
import { PrismaService } from '../prisma/prisma.service';

@Global()
@Module({
  providers: [PermissionService, PermissionGuard, RbacResolver, PrismaService],
  exports: [PermissionService, PermissionGuard],
})
export class RbacModule {}
