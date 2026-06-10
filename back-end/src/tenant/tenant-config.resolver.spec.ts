import { TenantConfigService } from './tenant-config.service';
import { TenantConfigResolver } from './tenant-config.resolver';
import { TenantFeature } from './tenant-config.types';

describe('TenantConfigResolver', () => {
  const tenantConfig = jest.fn();
  const updateTenantConfig = jest.fn();
  const setFeatureFlag = jest.fn();

  const tenantConfigService = {
    tenantConfig,
    updateTenantConfig,
    setFeatureFlag,
  } as unknown as TenantConfigService;

  const resolver = new TenantConfigResolver(tenantConfigService);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('delegates tenantConfig query to service', async () => {
    tenantConfig.mockResolvedValueOnce({ id: 'config-1' });

    const result = await resolver.tenantConfig();

    expect(tenantConfig).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ id: 'config-1' });
  });

  it('delegates updateTenantConfig mutation to service', async () => {
    const input = {
      primaryColor: '#000000',
    };
    updateTenantConfig.mockResolvedValueOnce({ id: 'config-1', ...input });

    const result = await resolver.updateTenantConfig(input);

    expect(updateTenantConfig).toHaveBeenCalledWith(input);
    expect(result).toEqual({ id: 'config-1', ...input });
  });

  it('delegates setFeatureFlag mutation to service', async () => {
    setFeatureFlag.mockResolvedValueOnce({ id: 'config-1' });

    const result = await resolver.setFeatureFlag(
      'tenant-1',
      TenantFeature.CRM,
      true,
    );

    expect(setFeatureFlag).toHaveBeenCalledWith(
      'tenant-1',
      TenantFeature.CRM,
      true,
    );
    expect(result).toEqual({ id: 'config-1' });
  });
});
