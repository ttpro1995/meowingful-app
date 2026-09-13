import { Test, TestingModule } from '@nestjs/testing';
import { CrmService } from './crm.service';
import { PrismaService } from '../prisma/prisma.service';
import { getTenantContext } from '../tenant/tenant-context.storage';
import { SortDirection } from '../shared/pagination/pagination.args';

jest.mock('../tenant/tenant-context.storage', () => ({
  getTenantContext: jest.fn(),
}));

describe('CrmService', () => {
  let service: CrmService;

  const mockPrismaService = {
    lead: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      delete: jest.fn(),
    },
    customer: {
      create: jest.fn(),
    },
    leadNote: {
      create: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    $transaction: jest.fn(),
  } as unknown as PrismaService & { $transaction: jest.Mock };

  const mockLead = mockPrismaService.lead as unknown as {
    create: jest.Mock;
    update: jest.Mock;
    findUnique: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    count: jest.Mock;
    delete: jest.Mock;
  };
  const mockLeadNote = mockPrismaService.leadNote as unknown as {
    create: jest.Mock;
  };
  const mockUser = mockPrismaService.user as unknown as {
    findUnique: jest.Mock;
    findFirst: jest.Mock;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CrmService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<CrmService>(CrmService);
    jest.clearAllMocks();
  });

  it('rejects createLead when caller has no tenant context', async () => {
    (getTenantContext as jest.Mock).mockReturnValue({
      tenantId: undefined,
      isSuperAdmin: false,
    });

    await expect(
      service.createLead({ name: 'Alice', email: 'alice@test.com' }),
    ).rejects.toThrow();
  });

  it('creates a lead with caller tenantId and default status NEW', async () => {
    (getTenantContext as jest.Mock).mockReturnValue({
      tenantId: 'tenant-1',
      isSuperAdmin: false,
    });

    const createdLead = {
      id: 'lead-1',
      tenantId: 'tenant-1',
      name: 'Alice',
      email: 'alice@test.com',
      phone: null,
      source: null,
      status: 'NEW',
      score: null,
      assignedToId: null,
      pipelineStageId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      notes: [],
    };

    mockLead.create.mockResolvedValue(createdLead);

    const result = await service.createLead({
      name: 'Alice',
      email: 'alice@test.com',
    });

    expect(result.name).toBe('Alice');
    expect(mockLead.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          tenantId: 'tenant-1',
          name: 'Alice',
          email: 'alice@test.com',
        },
        include: { notes: true },
      }),
    );
  });

  it('throws BadRequestException when assignedToId belongs to another tenant', async () => {
    (getTenantContext as jest.Mock).mockReturnValue({
      tenantId: 'tenant-1',
      isSuperAdmin: false,
    });

    mockUser.findUnique.mockResolvedValue({
      id: 'user-2',
      tenantId: 'tenant-2',
      username: 'bob',
    });

    await expect(
      service.createLead({
        name: 'Alice',
        email: 'alice@test.com',
        assignedToId: 'user-2',
      }),
    ).rejects.toThrow();
  });

  describe('updateLead', () => {
    it('updates an existing lead within the same tenant', async () => {
      (getTenantContext as jest.Mock).mockReturnValue({
        tenantId: 'tenant-1',
        isSuperAdmin: false,
      });

      const existingLead = {
        id: 'lead-1',
        tenantId: 'tenant-1',
        name: 'Alice',
        email: 'alice@test.com',
        phone: null,
        source: null,
        status: 'NEW',
        score: null,
        assignedToId: null,
        pipelineStageId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        notes: [],
      };

      const updatedLead = {
        ...existingLead,
        name: 'Alice Updated',
        status: 'CONTACTED',
      };

      mockLead.findUnique.mockResolvedValue(existingLead);
      mockLead.update.mockResolvedValue(updatedLead);

      const result = await service.updateLead('lead-1', {
        name: 'Alice Updated',
        status: 'CONTACTED',
      });

      expect(result.name).toBe('Alice Updated');

      expect(mockLead.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'lead-1' },
          data: expect.objectContaining({
            name: 'Alice Updated',
            status: 'CONTACTED',
          }) as Record<string, unknown>,
          include: { notes: true },
        }),
      );
    });

    it('throws BadRequestException when lead does not exist', async () => {
      (getTenantContext as jest.Mock).mockReturnValue({
        tenantId: 'tenant-1',
        isSuperAdmin: false,
      });

      mockLead.findUnique.mockResolvedValue(null);

      await expect(
        service.updateLead('missing-lead', { name: 'New Name' }),
      ).rejects.toThrow();
    });

    it('throws BadRequestException when lead belongs to another tenant', async () => {
      (getTenantContext as jest.Mock).mockReturnValue({
        tenantId: 'tenant-1',
        isSuperAdmin: false,
      });

      mockLead.findUnique.mockResolvedValue({
        id: 'lead-1',
        tenantId: 'tenant-2',
      });

      await expect(
        service.updateLead('lead-1', { name: 'New Name' }),
      ).rejects.toThrow();
    });

    it('throws BadRequestException when updating status to CONVERTED', async () => {
      (getTenantContext as jest.Mock).mockReturnValue({
        tenantId: 'tenant-1',
        isSuperAdmin: false,
      });

      const existingLead = {
        id: 'lead-1',
        tenantId: 'tenant-1',
        name: 'Alice',
        email: 'alice@test.com',
        phone: null,
        source: null,
        status: 'QUALIFIED',
        score: null,
        assignedToId: null,
        pipelineStageId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        notes: [],
      };

      mockLead.findUnique.mockResolvedValue(existingLead);

      await expect(
        service.updateLead('lead-1', { status: 'CONVERTED' }),
      ).rejects.toThrow();
    });

    it('throws BadRequestException when assignedToId belongs to another tenant', async () => {
      (getTenantContext as jest.Mock).mockReturnValue({
        tenantId: 'tenant-1',
        isSuperAdmin: false,
      });

      const existingLead = {
        id: 'lead-1',
        tenantId: 'tenant-1',
        name: 'Alice',
        email: 'alice@test.com',
        phone: null,
        source: null,
        status: 'NEW',
        score: null,
        assignedToId: null,
        pipelineStageId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        notes: [],
      };

      mockLead.findUnique.mockResolvedValue(existingLead);
      mockUser.findUnique.mockResolvedValue({
        id: 'user-2',
        tenantId: 'tenant-2',
        username: 'bob',
      });

      await expect(
        service.updateLead('lead-1', { assignedToId: 'user-2' }),
      ).rejects.toThrow();
    });
  });

  describe('deleteLead', () => {
    it('deletes an existing lead within the same tenant', async () => {
      (getTenantContext as jest.Mock).mockReturnValue({
        tenantId: 'tenant-1',
        isSuperAdmin: false,
      });

      const existingLead = {
        id: 'lead-1',
        tenantId: 'tenant-1',
        name: 'Alice',
        email: 'alice@test.com',
        phone: null,
        source: null,
        status: 'NEW',
        score: null,
        assignedToId: null,
        pipelineStageId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        notes: [],
      };

      mockLead.findUnique.mockResolvedValue(existingLead);
      mockLead.delete.mockResolvedValue({ ...existingLead });

      const result = await service.deleteLead('lead-1');

      expect(result.id).toBe('lead-1');
      expect(mockLead.delete).toHaveBeenCalledWith({
        where: { id: 'lead-1' },
        include: { notes: true },
      });
    });

    it('throws BadRequestException when lead does not exist', async () => {
      (getTenantContext as jest.Mock).mockReturnValue({
        tenantId: 'tenant-1',
        isSuperAdmin: false,
      });

      mockLead.findUnique.mockResolvedValue(null);

      await expect(service.deleteLead('missing-lead')).rejects.toThrow();
    });
  });

  describe('convertLeadToCustomer', () => {
    it('creates a Customer and marks the lead as CONVERTED', async () => {
      (getTenantContext as jest.Mock).mockReturnValue({
        tenantId: 'tenant-1',
        isSuperAdmin: false,
      });

      const lead = {
        id: 'lead-1',
        tenantId: 'tenant-1',
        name: 'Alice',
        email: 'alice@test.com',
        phone: null,
        source: null,
        status: 'QUALIFIED',
        score: 5,
        assignedToId: null,
        pipelineStageId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        notes: [],
      };

      const customer = {
        id: 'customer-1',
        tenantId: 'tenant-1',
        leadId: 'lead-1',
        name: 'Alice',
        email: 'alice@test.com',
        phone: null,
        createdAt: new Date(),
      };

      mockLead.findUnique.mockResolvedValue(lead);
      (mockPrismaService.$transaction as jest.Mock).mockResolvedValue([
        customer,
        { ...lead, status: 'CONVERTED' },
      ]);

      const result = await service.convertLeadToCustomer('lead-1');

      expect(result.id).toBe('customer-1');
      expect(mockPrismaService.$transaction).toHaveBeenCalledTimes(1);
      const calls = (mockPrismaService.$transaction as jest.Mock).mock
        .calls as unknown[][];
      expect(calls[0][0]).toHaveLength(2);
    });

    it('throws ConflictException when lead is already CONVERTED', async () => {
      (getTenantContext as jest.Mock).mockReturnValue({
        tenantId: 'tenant-1',
        isSuperAdmin: false,
      });

      const lead = {
        id: 'lead-1',
        tenantId: 'tenant-1',
        name: 'Alice',
        email: 'alice@test.com',
        phone: null,
        source: null,
        status: 'CONVERTED',
        score: 5,
        assignedToId: null,
        pipelineStageId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        notes: [],
      };

      mockLead.findUnique.mockResolvedValue(lead);

      await expect(service.convertLeadToCustomer('lead-1')).rejects.toThrow();
    });

    it('throws BadRequestException when lead does not exist', async () => {
      (getTenantContext as jest.Mock).mockReturnValue({
        tenantId: 'tenant-1',
        isSuperAdmin: false,
      });

      mockLead.findUnique.mockResolvedValue(null);

      await expect(
        service.convertLeadToCustomer('missing-lead'),
      ).rejects.toThrow();
    });
  });

  describe('assignLead', () => {
    it('assigns lead to a user in the same tenant', async () => {
      (getTenantContext as jest.Mock).mockReturnValue({
        tenantId: 'tenant-1',
        isSuperAdmin: false,
      });

      const lead = {
        id: 'lead-1',
        tenantId: 'tenant-1',
        name: 'Alice',
        email: 'alice@test.com',
        phone: null,
        source: null,
        status: 'NEW',
        score: null,
        assignedToId: null,
        pipelineStageId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        notes: [],
      };

      const assignee = {
        id: 'user-2',
        tenantId: 'tenant-1',
        username: 'bob',
      };

      const updatedLead = { ...lead, assignedToId: 'user-2' };

      mockLead.findUnique.mockResolvedValue(lead);
      mockUser.findUnique.mockResolvedValue(assignee);
      mockLead.update.mockResolvedValue(updatedLead);

      const result = await service.assignLead({
        leadId: 'lead-1',
        userId: 'user-2',
      });

      expect(result.assignedToId).toBe('user-2');
      expect(mockLead.update).toHaveBeenCalledWith({
        where: { id: 'lead-1' },
        data: { assignedToId: 'user-2' },
        include: { notes: true },
      });
    });

    it('throws BadRequestException when assignee user does not exist', async () => {
      (getTenantContext as jest.Mock).mockReturnValue({
        tenantId: 'tenant-1',
        isSuperAdmin: false,
      });

      const lead = {
        id: 'lead-1',
        tenantId: 'tenant-1',
        name: 'Alice',
        email: 'alice@test.com',
        phone: null,
        source: null,
        status: 'NEW',
        score: null,
        assignedToId: null,
        pipelineStageId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        notes: [],
      };

      mockLead.findUnique.mockResolvedValue(lead);
      mockUser.findUnique.mockResolvedValue(null);

      await expect(
        service.assignLead({ leadId: 'lead-1', userId: 'missing-user' }),
      ).rejects.toThrow('Assignee user not found');
    });

    it('throws BadRequestException when assignee belongs to a different tenant', async () => {
      (getTenantContext as jest.Mock).mockReturnValue({
        tenantId: 'tenant-1',
        isSuperAdmin: false,
      });

      const lead = {
        id: 'lead-1',
        tenantId: 'tenant-1',
        name: 'Alice',
        email: 'alice@test.com',
        phone: null,
        source: null,
        status: 'NEW',
        score: null,
        assignedToId: null,
        pipelineStageId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const assignee = {
        id: 'user-2',
        tenantId: 'tenant-2',
        username: 'bob',
      };

      mockLead.findUnique.mockResolvedValue(lead);
      mockUser.findUnique.mockResolvedValue(assignee);

      await expect(
        service.assignLead({ leadId: 'lead-1', userId: 'user-2' }),
      ).rejects.toThrow();
    });

    it('throws BadRequestException when lead does not exist', async () => {
      (getTenantContext as jest.Mock).mockReturnValue({
        tenantId: 'tenant-1',
        isSuperAdmin: false,
      });

      mockLead.findUnique.mockResolvedValue(null);

      await expect(
        service.assignLead({ leadId: 'missing-lead', userId: 'user-2' }),
      ).rejects.toThrow();
    });
  });

  describe('addLeadNote', () => {
    it('creates a note for an existing lead in the same tenant', async () => {
      (getTenantContext as jest.Mock).mockReturnValue({
        tenantId: 'tenant-1',
        userId: 'user-1',
        isSuperAdmin: false,
      });

      const lead = {
        id: 'lead-1',
        tenantId: 'tenant-1',
        name: 'Alice',
        email: 'alice@test.com',
        phone: null,
        source: null,
        status: 'NEW',
        score: null,
        assignedToId: null,
        pipelineStageId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const note = {
        id: 'note-1',
        leadId: 'lead-1',
        authorId: 'user-1',
        content: 'Follow up scheduled',
        createdAt: new Date(),
      };

      mockLead.findUnique.mockResolvedValue(lead);
      mockUser.findFirst.mockResolvedValue({
        id: 'user-1',
        tenantId: 'tenant-1',
        username: 'alice',
      });
      mockLeadNote.create.mockResolvedValue(note);

      const result = await service.addLeadNote(
        { leadId: 'lead-1', content: 'Follow up scheduled' },
        'user-1',
      );

      expect(result.content).toBe('Follow up scheduled');
      expect(mockLeadNote.create).toHaveBeenCalledWith({
        data: {
          tenantId: 'tenant-1',
          leadId: 'lead-1',
          authorId: 'user-1',
          content: 'Follow up scheduled',
        },
      });
    });

    it('throws BadRequestException when lead does not exist', async () => {
      (getTenantContext as jest.Mock).mockReturnValue({
        tenantId: 'tenant-1',
        userId: 'user-1',
        isSuperAdmin: false,
      });

      mockLead.findUnique.mockResolvedValue(null);

      await expect(
        service.addLeadNote(
          { leadId: 'missing-lead', content: 'Note' },
          'user-1',
        ),
      ).rejects.toThrow();
    });

    it('throws BadRequestException when author is not in tenant', async () => {
      (getTenantContext as jest.Mock).mockReturnValue({
        tenantId: 'tenant-1',
        userId: 'user-1',
        isSuperAdmin: false,
      });

      const lead = {
        id: 'lead-1',
        tenantId: 'tenant-1',
        name: 'Alice',
        email: 'alice@test.com',
        phone: null,
        source: null,
        status: 'NEW',
        score: null,
        assignedToId: null,
        pipelineStageId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockLead.findUnique.mockResolvedValue(lead);
      mockUser.findFirst.mockResolvedValue(null);

      await expect(
        service.addLeadNote({ leadId: 'lead-1', content: 'Note' }, 'user-2'),
      ).rejects.toThrow('Author not found in tenant');
    });
  });

  describe('lead', () => {
    it('returns a lead by id scoped to caller tenant', async () => {
      (getTenantContext as jest.Mock).mockReturnValue({
        tenantId: 'tenant-1',
        isSuperAdmin: false,
      });

      const lead = {
        id: 'lead-1',
        tenantId: 'tenant-1',
        name: 'Alice',
        email: 'alice@test.com',
        phone: null,
        source: null,
        status: 'NEW',
        score: null,
        assignedToId: null,
        pipelineStageId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        notes: [],
      };

      mockLead.findFirst.mockResolvedValue(lead);

      const result = await service.lead('lead-1');

      expect(result?.id).toBe('lead-1');
      expect(mockLead.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'lead-1', tenantId: 'tenant-1' },
        }),
      );
    });

    it('returns null when lead is not found', async () => {
      (getTenantContext as jest.Mock).mockReturnValue({
        tenantId: 'tenant-1',
        isSuperAdmin: false,
      });

      mockLead.findFirst.mockResolvedValue(null);

      const result = await service.lead('missing-lead');

      expect(result).toBeNull();
    });
  });

  describe('leads', () => {
    it('returns paginated leads scoped to caller tenant', async () => {
      (getTenantContext as jest.Mock).mockReturnValue({
        tenantId: 'tenant-1',
        isSuperAdmin: false,
      });

      mockLead.count.mockResolvedValue(2);
      mockLead.findMany.mockResolvedValue([
        {
          id: 'lead-1',
          tenantId: 'tenant-1',
          name: 'Alice',
          email: 'alice@test.com',
          phone: null,
          source: null,
          status: 'NEW',
          score: null,
          assignedToId: null,
          pipelineStageId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          notes: [],
        },
        {
          id: 'lead-2',
          tenantId: 'tenant-1',
          name: 'Bob',
          email: 'bob@test.com',
          phone: null,
          source: null,
          status: 'QUALIFIED',
          score: 5,
          assignedToId: 'user-2',
          pipelineStageId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          notes: [],
        },
      ]);

      const result = await service.leads({
        pagination: { page: 1, limit: 20 },
      });

      expect(result.totalCount).toBe(2);
      expect(result.leads.length).toBe(2);
      expect(result.pageInfo.page).toBe(1);
      expect(result.pageInfo.limit).toBe(20);
      expect(result.pageInfo.total).toBe(2);
      expect(result.pageInfo.totalPages).toBe(1);
      expect(mockLead.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: 'tenant-1' },
          skip: 0,
          take: 20,
        }),
      );
    });

    it('applies status filter', async () => {
      (getTenantContext as jest.Mock).mockReturnValue({
        tenantId: 'tenant-1',
        isSuperAdmin: false,
      });

      mockLead.count.mockResolvedValue(1);
      mockLead.findMany.mockResolvedValue([
        {
          id: 'lead-1',
          tenantId: 'tenant-1',
          name: 'Alice',
          email: 'alice@test.com',
          phone: null,
          source: null,
          status: 'QUALIFIED',
          score: 5,
          assignedToId: null,
          pipelineStageId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          notes: [],
        },
      ]);

      await service.leads({
        filter: { status: { equals: 'QUALIFIED' } },
        pagination: { page: 1, limit: 20 },
      });

      expect(mockLead.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: 'tenant-1', status: 'QUALIFIED' },
        }),
      );
    });

    it('applies assignedToId filter', async () => {
      (getTenantContext as jest.Mock).mockReturnValue({
        tenantId: 'tenant-1',
        isSuperAdmin: false,
      });

      mockLead.count.mockResolvedValue(0);
      mockLead.findMany.mockResolvedValue([]);

      await service.leads({
        filter: { assignedToId: { equals: 'user-2' } },
        pagination: { page: 1, limit: 20 },
      });

      expect(mockLead.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenantId: 'tenant-1',
            assignedToId: { equals: 'user-2', mode: 'insensitive' },
          },
        }),
      );
    });

    it('applies source filter', async () => {
      (getTenantContext as jest.Mock).mockReturnValue({
        tenantId: 'tenant-1',
        isSuperAdmin: false,
      });

      mockLead.count.mockResolvedValue(0);
      mockLead.findMany.mockResolvedValue([]);

      await service.leads({
        filter: { source: { contains: 'web' } },
        pagination: { page: 1, limit: 20 },
      });

      expect(mockLead.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenantId: 'tenant-1',
            source: { contains: 'web', mode: 'insensitive' },
          },
        }),
      );
    });

    it('applies from/to date filters', async () => {
      (getTenantContext as jest.Mock).mockReturnValue({
        tenantId: 'tenant-1',
        isSuperAdmin: false,
      });

      mockLead.count.mockResolvedValue(0);
      mockLead.findMany.mockResolvedValue([]);

      const from = new Date('2026-01-01T00:00:00Z');
      const to = new Date('2026-12-31T23:59:59Z');

      await service.leads({
        filter: {
          from: { gte: '2026-01-01T00:00:00Z' },
          to: { lte: '2026-12-31T23:59:59Z' },
        },
        pagination: { page: 1, limit: 20 },
      });

      expect(mockLead.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenantId: 'tenant-1',
            createdAt: {
              gte: from,
              lte: to,
            },
          },
        }),
      );
    });

    it('applies orderBy ascending', async () => {
      (getTenantContext as jest.Mock).mockReturnValue({
        tenantId: 'tenant-1',
        isSuperAdmin: false,
      });

      mockLead.count.mockResolvedValue(0);
      mockLead.findMany.mockResolvedValue([]);

      await service.leads({
        orderBy: { field: 'name', direction: SortDirection.ASC },
        pagination: { page: 1, limit: 20 },
      });

      expect(mockLead.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { name: 'asc' },
        }),
      );
    });

    it('throws BadRequestException for unsupported orderBy field', async () => {
      (getTenantContext as jest.Mock).mockReturnValue({
        tenantId: 'tenant-1',
        isSuperAdmin: false,
      });

      await expect(
        service.leads({
          orderBy: { field: 'invalidField', direction: SortDirection.ASC },
          pagination: { page: 1, limit: 20 },
        }),
      ).rejects.toThrow();
    });

    it('returns empty pageInfo when filtered results are empty', async () => {
      (getTenantContext as jest.Mock).mockReturnValue({
        tenantId: 'tenant-1',
        isSuperAdmin: false,
      });

      mockLead.count.mockResolvedValue(0);
      mockLead.findMany.mockResolvedValue([]);

      const result = await service.leads({
        filter: { status: { equals: 'LOST' } },
        pagination: { page: 1, limit: 20 },
      });

      expect(result.totalCount).toBe(0);
      expect(result.pageInfo.totalPages).toBe(0);
      expect(result.pageInfo.total).toBe(0);
    });

    it('always scopes findMany by tenantId', async () => {
      (getTenantContext as jest.Mock).mockReturnValue({
        tenantId: 'tenant-1',
        isSuperAdmin: false,
      });

      mockLead.count.mockResolvedValue(0);
      mockLead.findMany.mockResolvedValue([]);

      await service.leads({
        pagination: { page: 1, limit: 20 },
      });

      expect(mockLead.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: 'tenant-1' },
        }),
      );
    });
  });
});
