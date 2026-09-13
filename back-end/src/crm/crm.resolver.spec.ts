import { CrmResolver } from './crm.resolver';
import { CrmService } from './crm.service';
import { REQUIRE_PERMISSION_KEY } from '../rbac/permission.guard';

describe('CrmResolver', () => {
  const createLead = jest.fn();
  const updateLead = jest.fn();
  const deleteLead = jest.fn();
  const convertLeadToCustomer = jest.fn();
  const assignLead = jest.fn();
  const addLeadNote = jest.fn();
  const lead = jest.fn();
  const leads = jest.fn();

  const crmService = {
    createLead,
    updateLead,
    deleteLead,
    convertLeadToCustomer,
    assignLead,
    addLeadNote,
    lead,
    leads,
  } as unknown as CrmService;

  const resolver = new CrmResolver(crmService);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('delegates lead to crm service', async () => {
    lead.mockResolvedValueOnce({
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
    });

    const result = await resolver.lead('lead-1');

    expect(lead).toHaveBeenCalledWith('lead-1');
    expect(result!.id).toBe('lead-1');
  });

  it('delegates leads to crm service', async () => {
    leads.mockResolvedValueOnce({
      data: [],
      leads: [],
      totalCount: 0,
      pageInfo: { total: 0, page: 1, limit: 20, totalPages: 0 },
    } as any);

    const result = (await resolver.leads()) as {
      data: unknown[];
      leads: unknown[];
      totalCount: number;
    };

    expect(leads).toHaveBeenCalledWith({});
    expect(result.totalCount).toBe(0);
  });

  it('delegates createLead to crm service', async () => {
    const input = {
      name: 'Alice',
      email: 'alice@test.com',
    };
    createLead.mockResolvedValueOnce({
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
    });

    const result = await resolver.createLead(input);

    expect(createLead).toHaveBeenCalledWith(input);
    expect(result.id).toBe('lead-1');
  });

  it('delegates updateLead to crm service', async () => {
    updateLead.mockResolvedValueOnce({
      id: 'lead-1',
      tenantId: 'tenant-1',
      name: 'Alice Updated',
      email: 'alice@test.com',
      phone: null,
      source: null,
      status: 'CONTACTED',
      score: null,
      assignedToId: null,
      pipelineStageId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      notes: [],
    });

    const result = await resolver.updateLead('lead-1', {
      name: 'Alice Updated',
    });

    expect(updateLead).toHaveBeenCalledWith('lead-1', {
      name: 'Alice Updated',
    });
    expect(result.name).toBe('Alice Updated');
  });

  it('delegates deleteLead to crm service', async () => {
    deleteLead.mockResolvedValueOnce({
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
    });

    const result = await resolver.deleteLead('lead-1');

    expect(deleteLead).toHaveBeenCalledWith('lead-1');
    expect(result.id).toBe('lead-1');
  });

  it('delegates convertLeadToCustomer to crm service', async () => {
    convertLeadToCustomer.mockResolvedValueOnce({
      id: 'customer-1',
      tenantId: 'tenant-1',
      leadId: 'lead-1',
      name: 'Alice',
      email: 'alice@test.com',
      phone: null,
      createdAt: new Date(),
    });

    const result = await resolver.convertLeadToCustomer('lead-1');

    expect(convertLeadToCustomer).toHaveBeenCalledWith('lead-1');
    expect(result.id).toBe('customer-1');
  });

  it('delegates assignLead to crm service', async () => {
    const input = { leadId: 'lead-1', userId: 'user-2' };
    assignLead.mockResolvedValueOnce({
      id: 'lead-1',
      tenantId: 'tenant-1',
      name: 'Alice',
      email: 'alice@test.com',
      phone: null,
      source: null,
      status: 'NEW',
      score: null,
      assignedToId: 'user-2',
      pipelineStageId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      notes: [],
    });

    const result = await resolver.assignLead(input);

    expect(assignLead).toHaveBeenCalledWith(input);
    expect(result.assignedToId).toBe('user-2');
  });

  it('delegates addLeadNote to crm service', async () => {
    const input = { leadId: 'lead-1', content: 'Note content' };
    addLeadNote.mockResolvedValueOnce({
      id: 'note-1',
      leadId: 'lead-1',
      authorId: 'user-1',
      content: 'Note content',
      createdAt: new Date(),
    });

    const result = await resolver.addLeadNote(input);

    expect(addLeadNote).toHaveBeenCalledWith(input, expect.any(String));
    expect(result.content).toBe('Note content');
  });

  it('has @RequirePermission on createLead', () => {
    const metadata = Reflect.getMetadata(
      REQUIRE_PERMISSION_KEY,
      resolver['createLead'],
    ) as string | undefined;
    expect(metadata).toBe('lead:create');
  });

  it('has @RequirePermission on updateLead', () => {
    const metadata = Reflect.getMetadata(
      REQUIRE_PERMISSION_KEY,
      resolver['updateLead'],
    ) as string | undefined;
    expect(metadata).toBe('lead:update');
  });

  it('has @RequirePermission on deleteLead', () => {
    const metadata = Reflect.getMetadata(
      REQUIRE_PERMISSION_KEY,
      resolver['deleteLead'],
    ) as string | undefined;
    expect(metadata).toBe('lead:delete');
  });

  it('has @RequirePermission on assignLead', () => {
    const metadata = Reflect.getMetadata(
      REQUIRE_PERMISSION_KEY,
      resolver['assignLead'],
    ) as string | undefined;
    expect(metadata).toBe('lead:assign');
  });
});
