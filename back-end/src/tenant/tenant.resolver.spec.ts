import { TenantResolver } from './tenant.resolver';
import { TenantService } from './tenant.service';

describe('TenantResolver', () => {
  const createTenant = jest.fn();
  const updateTenant = jest.fn();
  const deactivateTenant = jest.fn();
  const tenants = jest.fn();
  const myTenant = jest.fn();

  const tenantService = {
    createTenant,
    updateTenant,
    deactivateTenant,
    tenants,
    myTenant,
  } as unknown as TenantService;

  const resolver = new TenantResolver(tenantService);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('delegates createTenant to tenant service', async () => {
    const input = {
      name: 'Tenant 1',
      slug: 'tenant-1',
      contactEmail: 'owner@tenant-1.test',
    };
    createTenant.mockResolvedValueOnce({ id: 'tenant-1' });

    const result = await resolver.createTenant(input);

    expect(createTenant).toHaveBeenCalledWith(input);
    expect(result).toEqual({ id: 'tenant-1' });
  });

  it('delegates updateTenant to tenant service', async () => {
    const input = {
      name: 'Tenant Updated',
    };
    updateTenant.mockResolvedValueOnce({
      id: 'tenant-1',
      name: 'Tenant Updated',
    });

    const result = await resolver.updateTenant('tenant-1', input);

    expect(updateTenant).toHaveBeenCalledWith('tenant-1', input);
    expect(result).toEqual({ id: 'tenant-1', name: 'Tenant Updated' });
  });

  it('delegates deactivateTenant to tenant service', async () => {
    deactivateTenant.mockResolvedValueOnce({ id: 'tenant-1', isActive: false });

    const result = await resolver.deactivateTenant('tenant-1');

    expect(deactivateTenant).toHaveBeenCalledWith('tenant-1');
    expect(result).toEqual({ id: 'tenant-1', isActive: false });
  });

  it('calls tenants with empty query when query is not provided', async () => {
    tenants.mockResolvedValueOnce({ tenants: [], totalCount: 0 });

    const result = await resolver.tenants();

    expect(tenants).toHaveBeenCalledWith({});
    expect(result).toEqual({ tenants: [], totalCount: 0 });
  });

  it('delegates myTenant to tenant service', async () => {
    myTenant.mockResolvedValueOnce({ id: 'tenant-1' });

    const result = await resolver.myTenant();

    expect(myTenant).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ id: 'tenant-1' });
  });
});
