import { Module } from '@nestjs/common';
import { MembershipResolver } from './membership.resolver';
import { MembershipService } from './membership.service';
import { DashboardModule } from '../dashboard/dashboard.module';

@Module({
  imports: [DashboardModule],
  providers: [MembershipResolver, MembershipService],
})
export class MembershipModule {}
