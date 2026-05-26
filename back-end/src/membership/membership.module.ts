import { Module } from '@nestjs/common';
import { MembershipResolver } from './membership.resolver';
import { MembershipService } from './membership.service';

@Module({
  providers: [MembershipResolver, MembershipService],
})
export class MembershipModule {}
