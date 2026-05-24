import { Module, Global } from '@nestjs/common';
import { PermissionService } from './permission.service';
import { PermissionGuard } from './permission.guard';
import { RbacResolver } from './rbac.resolver';
import { PrismaService } from '../prisma/prisma.service';
import { RedisModule } from '../redis/redis.module';

@Global()
@Module({
  imports: [RedisModule],
  providers: [PermissionService, PermissionGuard, RbacResolver, PrismaService],
  exports: [PermissionService, PermissionGuard],
})
export class RbacModule {}
