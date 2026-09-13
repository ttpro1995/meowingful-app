import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma, LeadStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  AddLeadNoteInput,
  AssignLeadInput,
  CreateLeadInput,
  Customer,
  Lead,
  LeadNote,
  LeadsFilterInput,
  LeadsPayload,
  LeadsQueryInput,
  UpdateLeadInput,
  CreatePipelineInput,
  UpdatePipelineInput,
  Pipeline,
  PipelineStage,
  PipelineBoard,
  UpdatePipelineStageInput,
  PipelineStageInput,
  BoardColumn,
} from './crm.types';
import { getTenantContext } from '../tenant/tenant-context.storage';
import { DateFilter, StringFilter } from '../shared/pagination/filter.types';
import { SortDirection } from '../shared/pagination/pagination.args';
import { paginate } from '../shared/pagination/paginate';
import { CRM_EVENT_QUEUE_TOKEN } from './crm.queue';

const LEAD_SORTABLE_FIELDS = new Set([
  'createdAt',
  'updatedAt',
  'name',
  'status',
  'score',
  'assignedToId',
]);

@Injectable()
export class CrmService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional()
    @Inject(CRM_EVENT_QUEUE_TOKEN)
    private readonly eventQueue?: {
      add(name: string, data: Record<string, unknown>): Promise<unknown>;
    },
  ) {}

  private assertAuthenticated(): string {
    const context = getTenantContext();
    if (!context?.tenantId) {
      throw new UnauthorizedException('UNAUTHORIZED');
    }

    return context.tenantId;
  }

  private toStringFilter(
    filter?: StringFilter,
  ): Prisma.StringFilter | undefined {
    if (!filter) {
      return undefined;
    }

    const where: Prisma.StringFilter = {
      mode: 'insensitive',
    };

    if (filter.equals) {
      where.equals = filter.equals;
    }

    if (filter.contains) {
      where.contains = filter.contains;
    }

    if (filter.startsWith) {
      where.startsWith = filter.startsWith;
    }

    if (filter.endsWith) {
      where.endsWith = filter.endsWith;
    }

    if (filter.in && filter.in.length > 0) {
      where.in = filter.in;
    }

    return Object.keys(where).length > 1 ? where : undefined;
  }

  private toDateFilter(filter?: DateFilter): Prisma.DateTimeFilter | undefined {
    if (!filter) {
      return undefined;
    }

    const where: Prisma.DateTimeFilter = {};

    if (filter.equals) {
      where.equals = new Date(filter.equals);
    }

    if (filter.gt) {
      where.gt = new Date(filter.gt);
    }

    if (filter.gte) {
      where.gte = new Date(filter.gte);
    }

    if (filter.lt) {
      where.lt = new Date(filter.lt);
    }

    if (filter.lte) {
      where.lte = new Date(filter.lte);
    }

    return Object.keys(where).length > 0 ? where : undefined;
  }

  private buildLeadsWhereInput(
    filter?: LeadsFilterInput,
  ): Prisma.LeadWhereInput {
    const where: Prisma.LeadWhereInput = {};

    const statusFilter = filter?.status;
    if (statusFilter?.equals) {
      where.status = statusFilter.equals as LeadStatus;
    }

    if (statusFilter?.in && statusFilter.in.length > 0) {
      where.status = { in: statusFilter.in as LeadStatus[] };
    }

    const assignedToIdFilter = this.toStringFilter(filter?.assignedToId);
    if (assignedToIdFilter) {
      where.assignedToId = assignedToIdFilter;
    }

    const sourceFilter = this.toStringFilter(filter?.source);
    if (sourceFilter) {
      where.source = sourceFilter;
    }

    const fromFilter = this.toDateFilter(filter?.from);
    const toFilter = this.toDateFilter(filter?.to);

    if (fromFilter || toFilter) {
      const dateFilter: Prisma.DateTimeFilter = { ...fromFilter, ...toFilter };
      where.createdAt = dateFilter;
    }

    return where;
  }

  private resolveLeadsOrderBy(
    orderField: string | undefined,
    direction: SortDirection | undefined,
  ): Prisma.LeadOrderByWithRelationInput {
    const field = orderField ?? 'createdAt';
    if (!LEAD_SORTABLE_FIELDS.has(field)) {
      throw new BadRequestException(`Unsupported orderBy.field: ${field}`);
    }

    const prismaDirection: Prisma.SortOrder =
      direction === SortDirection.DESC ? 'desc' : 'asc';

    return {
      [field]: prismaDirection,
    };
  }

  private normalizeLead(
    lead: Prisma.LeadGetPayload<{ include: { notes: boolean } }>,
  ): Lead {
    return {
      id: lead.id,
      tenantId: lead.tenantId,
      name: lead.name,
      email: lead.email ?? undefined,
      phone: lead.phone ?? undefined,
      source: lead.source ?? undefined,
      status: lead.status,
      score: lead.score ?? undefined,
      assignedToId: lead.assignedToId ?? undefined,
      pipelineStageId: lead.pipelineStageId ?? undefined,
      pipelineId: lead.pipelineId ?? undefined,
      stageEnteredAt: lead.stageEnteredAt ?? undefined,
      slaBreached: lead.slaBreached,
      notes: lead.notes.map((note) => ({
        id: note.id,
        leadId: note.leadId,
        authorId: note.authorId,
        content: note.content,
        createdAt: note.createdAt,
      })),
      createdAt: lead.createdAt,
      updatedAt: lead.updatedAt,
    };
  }

  private normalizeCustomer(
    customer: Prisma.CustomerGetPayload<Prisma.CustomerDefaultArgs>,
  ): Customer {
    return {
      id: customer.id,
      tenantId: customer.tenantId,
      leadId: customer.leadId ?? undefined,
      name: customer.name,
      email: customer.email ?? undefined,
      phone: customer.phone ?? undefined,
      createdAt: customer.createdAt,
    };
  }

  async createLead(input: CreateLeadInput): Promise<Lead> {
    const tenantId = this.assertAuthenticated();

    if (input.assignedToId) {
      const assignee = await this.prisma.user.findUnique({
        where: { id: input.assignedToId },
      });
      if (!assignee || assignee.tenantId !== tenantId) {
        throw new BadRequestException('Assignee belongs to a different tenant');
      }
    }

    const lead = await this.prisma.lead.create({
      data: {
        tenantId,
        name: input.name,
        email: input.email,
        phone: input.phone,
        source: input.source,
        score: input.score,
        assignedToId: input.assignedToId,
      },
      include: {
        notes: true,
      },
    });

    return this.normalizeLead(lead);
  }

  async updateLead(leadId: string, input: UpdateLeadInput): Promise<Lead> {
    const tenantId = this.assertAuthenticated();

    const existing = await this.prisma.lead.findUnique({
      where: { id: leadId },
    });

    if (!existing || existing.tenantId !== tenantId) {
      throw new BadRequestException('Lead not found');
    }

    if (input.status === LeadStatus.CONVERTED) {
      throw new BadRequestException(
        'Use convertLeadToCustomer mutation to convert a lead',
      );
    }

    if (input.assignedToId) {
      const assignee = await this.prisma.user.findUnique({
        where: { id: input.assignedToId },
      });
      if (!assignee || assignee.tenantId !== tenantId) {
        throw new BadRequestException('Assignee belongs to a different tenant');
      }
    }

    const lead = await this.prisma.lead.update({
      where: { id: leadId },
      data: {
        name: input.name,
        email: input.email,
        phone: input.phone,
        source: input.source,
        status: input.status,
        score: input.score,
        assignedToId: input.assignedToId,
      },
      include: {
        notes: true,
      },
    });

    return this.normalizeLead(lead);
  }

  async deleteLead(leadId: string): Promise<Lead> {
    const tenantId = this.assertAuthenticated();

    const existing = await this.prisma.lead.findUnique({
      where: { id: leadId },
    });

    if (!existing || existing.tenantId !== tenantId) {
      throw new BadRequestException('Lead not found');
    }

    const lead = await this.prisma.lead.delete({
      where: { id: leadId },
      include: {
        notes: true,
      },
    });

    return this.normalizeLead(lead);
  }

  async convertLeadToCustomer(leadId: string): Promise<Customer> {
    const tenantId = this.assertAuthenticated();

    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
      include: { notes: true },
    });

    if (!lead || lead.tenantId !== tenantId) {
      throw new BadRequestException('Lead not found');
    }

    if (lead.status === LeadStatus.CONVERTED) {
      throw new ConflictException('Lead is already converted');
    }

    try {
      const [customer] = await this.prisma.$transaction([
        this.prisma.customer.create({
          data: {
            tenantId,
            leadId: lead.id,
            name: lead.name,
            email: lead.email,
            phone: lead.phone,
          },
        }),
        this.prisma.lead.update({
          where: { id: leadId },
          data: { status: LeadStatus.CONVERTED },
        }),
      ]);

      return this.normalizeCustomer(customer);
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: string }).code === 'P2002'
      ) {
        throw new ConflictException('Lead is already converted');
      }
      throw error;
    }
  }

  async assignLead(input: AssignLeadInput): Promise<Lead> {
    const tenantId = this.assertAuthenticated();

    const lead = await this.prisma.lead.findUnique({
      where: { id: input.leadId },
    });

    if (!lead || lead.tenantId !== tenantId) {
      throw new BadRequestException('Lead not found');
    }

    const assignee = await this.prisma.user.findUnique({
      where: { id: input.userId },
    });

    if (!assignee) {
      throw new BadRequestException('Assignee user not found');
    }

    if (assignee.tenantId !== tenantId) {
      throw new BadRequestException('Assignee belongs to a different tenant');
    }

    const updatedLead = await this.prisma.lead.update({
      where: { id: input.leadId },
      data: { assignedToId: input.userId },
      include: {
        notes: true,
      },
    });

    return this.normalizeLead(updatedLead);
  }

  async addLeadNote(
    input: AddLeadNoteInput,
    authorId: string,
  ): Promise<LeadNote> {
    const tenantId = this.assertAuthenticated();

    const lead = await this.prisma.lead.findUnique({
      where: { id: input.leadId },
    });

    if (!lead || lead.tenantId !== tenantId) {
      throw new BadRequestException('Lead not found');
    }

    const author = await this.prisma.user.findFirst({
      where: { id: authorId, tenantId },
    });

    if (!author) {
      throw new BadRequestException('Author not found in tenant');
    }

    return this.prisma.leadNote.create({
      data: {
        tenantId,
        leadId: input.leadId,
        authorId,
        content: input.content,
      },
    });
  }

  async lead(leadId: string): Promise<Lead | null> {
    const tenantId = this.assertAuthenticated();

    const lead = await this.prisma.lead.findFirst({
      where: {
        id: leadId,
        tenantId,
      },
      include: {
        notes: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    return lead ? this.normalizeLead(lead) : null;
  }

  async leads(query: LeadsQueryInput = {}): Promise<LeadsPayload> {
    const tenantId = this.assertAuthenticated();

    const { page, limit, skip, take } = paginate(
      query.pagination?.page,
      query.pagination?.limit,
    );

    const filterWhere = this.buildLeadsWhereInput(query.filter);
    const where: Prisma.LeadWhereInput = {
      ...filterWhere,
      tenantId,
    };

    const orderBy = this.resolveLeadsOrderBy(
      query.orderBy?.field,
      query.orderBy?.direction,
    );

    const totalCount = await this.prisma.lead.count({ where });

    const leads = await this.prisma.lead.findMany({
      where,
      orderBy,
      skip,
      take,
      include: {
        notes: true,
      },
    });

    return {
      data: leads.map((lead) => this.normalizeLead(lead)),
      leads: leads.map((lead) => this.normalizeLead(lead)),
      totalCount,
      pageInfo: {
        total: totalCount,
        page,
        limit,
        totalPages: totalCount === 0 ? 0 : Math.ceil(totalCount / limit),
      },
    };
  }

  private normalizeStage(stage: {
    id: string;
    pipelineId: string;
    name: string;
    order: number;
    color: string;
    slaDurationH: number | null;
  }): PipelineStage {
    return { ...stage, slaDurationH: stage.slaDurationH ?? undefined };
  }

  private normalizePipeline(pipeline: {
    id: string;
    tenantId: string;
    name: string;
    createdAt: Date;
    updatedAt: Date;
    stages: Array<{
      id: string;
      pipelineId: string;
      name: string;
      order: number;
      color: string;
      slaDurationH: number | null;
    }>;
  }): Pipeline {
    return {
      ...pipeline,
      stages: pipeline.stages.map((stage) => this.normalizeStage(stage)),
    };
  }

  async createPipeline(input: CreatePipelineInput): Promise<Pipeline> {
    const tenantId = this.assertAuthenticated();
    if (!input.stages.length)
      throw new BadRequestException('Pipeline requires at least one stage');
    const orders = input.stages.map((stage) => stage.order);
    if (new Set(orders).size !== orders.length)
      throw new BadRequestException('Stage orders must be unique');
    const pipeline = await this.prisma.pipeline.create({
      data: {
        tenantId,
        name: input.name,
        stages: {
          create: input.stages.map((stage) => ({
            ...stage,
            color: stage.color ?? '#6B7280',
          })),
        },
      },
      include: { stages: { orderBy: { order: 'asc' } } },
    });
    return this.normalizePipeline(pipeline);
  }

  async updatePipeline(
    pipelineId: string,
    input: UpdatePipelineInput,
  ): Promise<Pipeline> {
    const tenantId = this.assertAuthenticated();
    const existing = await this.prisma.pipeline.findFirst({
      where: { id: pipelineId, tenantId },
    });
    if (!existing) throw new BadRequestException('Pipeline not found');
    if (input.stages) {
      if (!input.stages.length) {
        throw new BadRequestException('Pipeline requires at least one stage');
      }
      const orders = input.stages.map((stage) => stage.order);
      if (new Set(orders).size !== orders.length)
        throw new BadRequestException('Stage orders must be unique');
    }
    const pipeline = await this.prisma.$transaction(async (tx) => {
      if (input.stages) {
        const activeLeadCount = await tx.lead.count({
          where: { tenantId, pipelineId },
        });
        if (activeLeadCount) {
          throw new ConflictException(
            'Cannot replace pipeline stages while leads are active',
          );
        }
        const stageIds = await tx.pipelineStage.findMany({
          where: { pipelineId },
          select: { id: true },
        });
        const transitionCount = await tx.stageTransition.count({
          where: {
            tenantId,
            toStageId: { in: stageIds.map((stage) => stage.id) },
          },
        });
        if (transitionCount) {
          throw new ConflictException(
            'Cannot replace pipeline stages after transitions exist',
          );
        }
        await tx.pipelineStage.deleteMany({ where: { pipelineId } });
        await tx.pipelineStage.createMany({
          data: input.stages.map((stage) => ({
            pipelineId,
            ...stage,
            color: stage.color ?? '#6B7280',
          })),
        });
      }
      return tx.pipeline.update({
        where: { id: pipelineId },
        data: { name: input.name },
        include: { stages: { orderBy: { order: 'asc' } } },
      });
    });
    return this.normalizePipeline(pipeline);
  }

  async deletePipeline(pipelineId: string): Promise<Pipeline> {
    const tenantId = this.assertAuthenticated();
    const existing = await this.prisma.pipeline.findFirst({
      where: { id: pipelineId, tenantId },
      include: { stages: true },
    });
    if (!existing) throw new BadRequestException('Pipeline not found');
    const active = await this.prisma.lead.count({
      where: { tenantId, pipelineId },
    });
    if (active)
      throw new ConflictException('Cannot delete pipeline with active leads');
    await this.prisma.pipeline.delete({ where: { id: pipelineId } });
    return this.normalizePipeline({ ...existing, stages: existing.stages });
  }

  async createStage(
    pipelineId: string,
    input: PipelineStageInput,
  ): Promise<PipelineStage> {
    const tenantId = this.assertAuthenticated();
    const pipeline = await this.prisma.pipeline.findFirst({
      where: { id: pipelineId, tenantId },
    });
    if (!pipeline) throw new BadRequestException('Pipeline not found');
    const duplicateOrder = await this.prisma.pipelineStage.findFirst({
      where: { pipelineId, order: input.order },
    });
    if (duplicateOrder) {
      throw new ConflictException(
        'Stage order must be unique within a pipeline',
      );
    }
    return this.normalizeStage(
      await this.prisma.pipelineStage.create({
        data: { pipelineId, ...input, color: input.color ?? '#6B7280' },
      }),
    );
  }

  async updateStage(
    stageId: string,
    input: UpdatePipelineStageInput,
  ): Promise<PipelineStage> {
    const tenantId = this.assertAuthenticated();
    const stage = await this.prisma.pipelineStage.findFirst({
      where: { id: stageId, pipeline: { tenantId } },
    });
    if (!stage) throw new BadRequestException('Pipeline stage not found');
    if (input.order !== undefined) {
      const duplicateOrder = await this.prisma.pipelineStage.findFirst({
        where: {
          pipelineId: stage.pipelineId,
          order: input.order,
          id: { not: stageId },
        },
      });
      if (duplicateOrder) {
        throw new ConflictException(
          'Stage order must be unique within a pipeline',
        );
      }
    }
    return this.normalizeStage(
      await this.prisma.pipelineStage.update({
        where: { id: stageId },
        data: input,
      }),
    );
  }

  async deleteStage(stageId: string): Promise<PipelineStage> {
    const tenantId = this.assertAuthenticated();
    const stage = await this.prisma.pipelineStage.findFirst({
      where: { id: stageId, pipeline: { tenantId } },
    });
    if (!stage) throw new BadRequestException('Pipeline stage not found');
    const active = await this.prisma.lead.count({
      where: { tenantId, pipelineStageId: stageId },
    });
    if (active)
      throw new ConflictException('Cannot delete stage with active leads');
    await this.prisma.pipelineStage.delete({ where: { id: stageId } });
    return this.normalizeStage(stage);
  }

  async moveLeadToStage(leadId: string, stageId: string): Promise<Lead> {
    const tenantId = this.assertAuthenticated();
    const userId = getTenantContext()?.userId;
    if (!userId) throw new UnauthorizedException('UNAUTHORIZED');
    const lead = await this.prisma.lead.findFirst({
      where: { id: leadId, tenantId },
    });
    const stage = await this.prisma.pipelineStage.findFirst({
      where: { id: stageId, pipeline: { tenantId } },
    });
    if (!lead) throw new BadRequestException('Lead not found');
    if (!stage) throw new BadRequestException('Pipeline stage not found');
    if (lead.pipelineId && lead.pipelineId !== stage.pipelineId)
      throw new BadRequestException('Stage belongs to a different pipeline');
    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.stageTransition.create({
        data: {
          tenantId,
          leadId,
          fromStageId: lead.pipelineStageId,
          toStageId: stageId,
          movedByUserId: userId,
          movedAt: now,
        },
      });
      return tx.lead.update({
        where: { id: leadId },
        data: {
          pipelineId: stage.pipelineId,
          pipelineStageId: stageId,
          stageEnteredAt: now,
          slaBreached: false,
        },
        include: { notes: true },
      });
    });
    return this.normalizeLead(updated);
  }

  async pipelineBoard(
    pipelineId: string,
    query?: LeadsQueryInput,
  ): Promise<PipelineBoard> {
    const tenantId = this.assertAuthenticated();
    const pipeline = await this.prisma.pipeline.findFirst({
      where: { id: pipelineId, tenantId },
      include: { stages: { orderBy: { order: 'asc' } } },
    });
    if (!pipeline) throw new BadRequestException('Pipeline not found');
    const where = {
      tenantId,
      pipelineId,
      ...this.buildLeadsWhereInput(query?.filter),
    };
    const leads = await this.prisma.lead.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      include: { notes: true },
    });
    const normalized = leads.map((lead) => this.normalizeLead(lead));
    const columns: BoardColumn[] = pipeline.stages.map((stage) => ({
      stage: this.normalizeStage(stage),
      leads: normalized.filter((lead) => lead.pipelineStageId === stage.id),
      totalCount: normalized.filter((lead) => lead.pipelineStageId === stage.id)
        .length,
    }));
    return { pipeline: this.normalizePipeline(pipeline), columns };
  }

  async checkSlaBreaches(): Promise<number> {
    const now = new Date();
    const stages = await this.prisma.pipelineStage.findMany({
      where: { slaDurationH: { not: null } },
      include: { pipeline: true },
    });
    let breached = 0;
    for (const stage of stages) {
      const cutoff = new Date(
        now.getTime() - (stage.slaDurationH ?? 0) * 3600000,
      );
      const leads = await this.prisma.lead.findMany({
        where: {
          tenantId: stage.pipeline.tenantId,
          pipelineStageId: stage.id,
          slaBreached: false,
          stageEnteredAt: { lt: cutoff },
        },
        include: { notes: true },
      });
      for (const lead of leads) {
        const updated = await this.prisma.lead.updateMany({
          where: { id: lead.id, slaBreached: false },
          data: { slaBreached: true },
        });
        if (!updated.count) continue;
        if (!this.eventQueue) throw new Error('CRM event queue is unavailable');
        await this.eventQueue.add('SLA_BREACHED', {
          event: 'SLA_BREACHED',
          tenantId: lead.tenantId,
          leadId: lead.id,
          pipelineId: stage.pipelineId,
          stageId: stage.id,
          occurredAt: now.toISOString(),
        });
        breached++;
      }
    }
    return breached;
  }
}
