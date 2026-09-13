import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AuditAction as PrismaAuditAction } from '@prisma/client';
import { RequirePermission } from '../rbac/permission.guard';
import { CrmService } from './crm.service';
import { Auditable, AuditAction } from '../audit/audit.decorators';
import { createUpdateDiff } from '../audit/audit.helpers';
import { getTenantContext } from '../tenant/tenant-context.storage';
import {
  AddLeadNoteInput,
  AssignLeadInput,
  CreateLeadInput,
  Customer,
  Lead,
  LeadNote,
  LeadsPayload,
  LeadsQueryInput,
  UpdateLeadInput,
} from './crm.types';

@Resolver(() => Lead)
export class CrmResolver {
  constructor(private readonly crmService: CrmService) {}

  @Query(() => Lead, { nullable: true })
  async lead(@Args('leadId') leadId: string): Promise<Lead | null> {
    return this.crmService.lead(leadId);
  }

  @Query(() => LeadsPayload)
  async leads(
    @Args('query', { nullable: true }) query?: LeadsQueryInput,
  ): Promise<LeadsPayload> {
    return this.crmService.leads(query ?? {});
  }

  @Mutation(() => Lead)
  @RequirePermission('lead:create')
  @Auditable('Lead')
  @AuditAction(({ result }) => ({
    action: PrismaAuditAction.CREATE,
    resourceId:
      typeof result === 'object' &&
      result !== null &&
      'id' in result &&
      typeof result.id === 'string'
        ? (result as { id: string }).id
        : 'unknown',
    diff: createUpdateDiff(
      null,
      typeof result === 'object' && result !== null && 'name' in result
        ? {
            name: (result as { name?: string }).name ?? null,
            email: (result as { email?: string }).email ?? null,
          }
        : null,
    ),
  }))
  async createLead(@Args('input') input: CreateLeadInput): Promise<Lead> {
    return this.crmService.createLead(input);
  }

  @Mutation(() => Lead)
  @RequirePermission('lead:update')
  @Auditable('Lead')
  @AuditAction(({ args }) => ({
    action: PrismaAuditAction.UPDATE,
    resourceId:
      typeof args.leadId === 'string' && args.leadId ? args.leadId : 'unknown',
    diff: createUpdateDiff(
      null,
      typeof args.input === 'object' && args.input
        ? (args.input as Record<string, unknown>)
        : null,
    ),
  }))
  async updateLead(
    @Args('leadId') leadId: string,
    @Args('input') input: UpdateLeadInput,
  ): Promise<Lead> {
    return this.crmService.updateLead(leadId, input);
  }

  @Mutation(() => Lead)
  @RequirePermission('lead:delete')
  @Auditable('Lead')
  @AuditAction(({ args }) => ({
    action: PrismaAuditAction.DELETE,
    resourceId:
      typeof args.leadId === 'string' && args.leadId ? args.leadId : 'unknown',
    diff: createUpdateDiff(null, { deleted: true }),
  }))
  async deleteLead(@Args('leadId') leadId: string): Promise<Lead> {
    return this.crmService.deleteLead(leadId);
  }

  @Mutation(() => Customer)
  @RequirePermission('lead:update')
  @Auditable('Lead')
  @AuditAction(({ args, result }) => ({
    action: PrismaAuditAction.UPDATE,
    resourceId:
      typeof args.leadId === 'string' && args.leadId ? args.leadId : 'unknown',
    diff: createUpdateDiff(
      { status: 'CONVERTED' },
      {
        status: 'CONVERTED',
        customerId: (result as { id?: string } | null)?.id ?? null,
      },
    ),
  }))
  async convertLeadToCustomer(
    @Args('leadId') leadId: string,
  ): Promise<Customer> {
    return this.crmService.convertLeadToCustomer(leadId);
  }

  @Mutation(() => Lead)
  @RequirePermission('lead:assign')
  @Auditable('Lead')
  @AuditAction(({ args }) => ({
    action: PrismaAuditAction.UPDATE,
    resourceId:
      typeof args.input === 'object' && args.input && 'leadId' in args.input
        ? ((args.input as { leadId?: string }).leadId ?? 'unknown')
        : 'unknown',
    diff: createUpdateDiff(
      null,
      typeof args.input === 'object' && args.input
        ? (args.input as Record<string, unknown>)
        : null,
    ),
  }))
  async assignLead(@Args('input') input: AssignLeadInput): Promise<Lead> {
    return this.crmService.assignLead(input);
  }

  @Mutation(() => LeadNote)
  @RequirePermission('lead:update')
  @Auditable('LeadNote')
  @AuditAction(({ result }) => ({
    action: PrismaAuditAction.CREATE,
    resourceId:
      typeof result === 'object' &&
      result !== null &&
      'id' in result &&
      typeof result.id === 'string'
        ? (result as { id: string }).id
        : 'unknown',
    diff: createUpdateDiff(null, {
      leadId: (result as { leadId?: string } | null)?.leadId ?? null,
    }),
  }))
  async addLeadNote(@Args('input') input: AddLeadNoteInput): Promise<LeadNote> {
    const authorId = getTenantContext()?.userId ?? 'unknown';
    return this.crmService.addLeadNote(input, authorId);
  }
}
