import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AuditAction as PrismaAuditAction } from '@prisma/client';
import { MembershipService } from './membership.service';
import { Auditable, AuditAction } from '../audit/audit.decorators';
import { createUpdateDiff } from '../audit/audit.helpers';
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
  @Auditable('Invitation')
  @AuditAction(({ result, args }) => ({
    action: PrismaAuditAction.CREATE,
    resourceId:
      typeof result === 'object' &&
      result !== null &&
      'invitation' in result &&
      typeof (result as { invitation?: { id?: string } }).invitation?.id ===
        'string'
        ? (result as { invitation: { id: string } }).invitation.id
        : 'unknown',
    diff: createUpdateDiff(
      null,
      typeof args.input === 'object' && args.input
        ? (args.input as Record<string, unknown>)
        : null,
    ),
  }))
  async inviteMember(
    @Args('input') input: InviteMemberInput,
  ): Promise<InviteMemberPayload> {
    return this.membershipService.inviteMember(input);
  }

  @Mutation(() => Boolean)
  @Auditable('Invitation')
  @AuditAction(({ args }) => ({
    action: PrismaAuditAction.UPDATE,
    resourceId:
      typeof args.input === 'object' &&
      args.input !== null &&
      'token' in (args.input as Record<string, unknown>)
        ? String((args.input as Record<string, unknown>).token)
        : 'unknown',
    diff: createUpdateDiff(null, { accepted: true }),
  }))
  async acceptInvitation(
    @Args('input') input: AcceptInvitationInput,
  ): Promise<boolean> {
    return this.membershipService.acceptInvitation(input);
  }

  @Mutation(() => Boolean)
  @Auditable('Invitation')
  @AuditAction(({ args }) => ({
    action: PrismaAuditAction.UPDATE,
    resourceId:
      typeof args.input === 'object' &&
      args.input !== null &&
      'token' in (args.input as Record<string, unknown>)
        ? String((args.input as Record<string, unknown>).token)
        : 'unknown',
    diff: createUpdateDiff(null, { declined: true }),
  }))
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
  @Auditable('UserTenantRole')
  @AuditAction(({ args }) => ({
    action: PrismaAuditAction.UPDATE,
    resourceId:
      typeof args.input === 'object' &&
      args.input !== null &&
      'userId' in (args.input as Record<string, unknown>)
        ? String((args.input as Record<string, unknown>).userId)
        : 'unknown',
    diff: createUpdateDiff(
      null,
      typeof args.input === 'object' && args.input
        ? (args.input as Record<string, unknown>)
        : null,
    ),
  }))
  async updateMemberRoles(
    @Args('input') input: UpdateMemberRolesInput,
  ): Promise<TenantMember> {
    return this.membershipService.updateMemberRoles(input);
  }

  @Mutation(() => Boolean)
  @Auditable('UserTenantRole')
  @AuditAction(({ args }) => ({
    action: PrismaAuditAction.DELETE,
    resourceId:
      typeof args.userId === 'string' && args.userId ? args.userId : 'unknown',
    diff: createUpdateDiff(null, { removed: true }),
  }))
  async removeMember(@Args('userId') userId: string): Promise<boolean> {
    return this.membershipService.removeMember(userId);
  }

  @Query(() => MyTenantsPayload)
  async myTenants(): Promise<MyTenantsPayload> {
    return this.membershipService.myTenants();
  }
}
