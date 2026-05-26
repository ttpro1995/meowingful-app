import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { MembershipService } from './membership.service';
import {
  AcceptInvitationInput,
  DeclineInvitationInput,
  InviteMemberInput,
  InviteMemberPayload,
  MembersPayload,
  MembersQueryInput,
  MyTenantsPayload,
  TenantMember,
  UpdateMemberRolesInput,
} from './membership.types';

@Resolver(() => TenantMember)
export class MembershipResolver {
  constructor(private readonly membershipService: MembershipService) {}

  @Mutation(() => InviteMemberPayload)
  async inviteMember(
    @Args('input') input: InviteMemberInput,
  ): Promise<InviteMemberPayload> {
    return this.membershipService.inviteMember(input);
  }

  @Mutation(() => Boolean)
  async acceptInvitation(
    @Args('input') input: AcceptInvitationInput,
  ): Promise<boolean> {
    return this.membershipService.acceptInvitation(input);
  }

  @Mutation(() => Boolean)
  async declineInvitation(
    @Args('input') input: DeclineInvitationInput,
  ): Promise<boolean> {
    return this.membershipService.declineInvitation(input);
  }

  @Query(() => MembersPayload)
  async members(
    @Args('query', { nullable: true }) query?: MembersQueryInput,
  ): Promise<MembersPayload> {
    return this.membershipService.members(query ?? {});
  }

  @Mutation(() => TenantMember)
  async updateMemberRoles(
    @Args('input') input: UpdateMemberRolesInput,
  ): Promise<TenantMember> {
    return this.membershipService.updateMemberRoles(input);
  }

  @Mutation(() => Boolean)
  async removeMember(@Args('userId') userId: string): Promise<boolean> {
    return this.membershipService.removeMember(userId);
  }

  @Query(() => MyTenantsPayload)
  async myTenants(): Promise<MyTenantsPayload> {
    return this.membershipService.myTenants();
  }
}
