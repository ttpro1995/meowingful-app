import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import { Link, useNavigate } from 'react-router-dom';
import {
  CHANGE_PASSWORD,
  GET_USER,
  LOGOUT,
  MY_TENANT,
  TENANT_CONFIG,
  MY_TENANTS,
  SWITCH_TENANT,
  UPDATE_TENANT_CONFIG,
  UPDATE_USER,
} from '../graphql/queries';
import { useAuth } from '../context/useAuth';

interface User {
  id: string;
  tenantId: string;
  username: string;
  name: string;
  bio: string | null;
  role: string;
  createdAt: string;
  updatedAt: string;
}

interface GetUserQuery {
  getUser: User;
}

interface UpdateUserMutation {
  updateUser: User;
}

interface ChangePasswordMutation {
  changePassword: boolean;
}

interface LogoutMutation {
  logout: boolean;
}

interface TenantMembership {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  roleNames: string[];
}

interface MyTenantsQuery {
  myTenants: {
    memberships: TenantMembership[];
  };
}

interface TenantBranding {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
}

interface MyTenantQuery {
  myTenant: TenantBranding;
}

interface TenantBusinessHours {
  mon?: string | null;
  tue?: string | null;
  wed?: string | null;
  thu?: string | null;
  fri?: string | null;
  sat?: string | null;
  sun?: string | null;
}

interface TenantFeatures {
  crm: boolean;
  elearning: boolean;
  call_center: boolean;
  live_classes: boolean;
  marketplace: boolean;
}

interface TenantConfig {
  id: string;
  tenantId: string;
  logoUrl?: string | null;
  primaryColor: string;
  subdomain?: string | null;
  timezone: string;
  defaultLanguage: string;
  businessHours?: TenantBusinessHours | null;
  features: TenantFeatures;
}

interface TenantConfigQuery {
  tenantConfig: TenantConfig;
}

interface UpdateTenantConfigMutation {
  updateTenantConfig: TenantConfig;
}

interface TenantConfigInput {
  primaryColor?: string;
  subdomain?: string;
  timezone?: string;
  defaultLanguage?: string;
  businessHours?: {
    mon?: string;
    tue?: string;
    wed?: string;
    thu?: string;
    fri?: string;
    sat?: string;
    sun?: string;
  };
}

interface SwitchTenantMutation {
  switchTenant: {
    accessToken: string;
    user: {
      id: string;
      tenantId: string;
      username: string;
      name: string;
      bio: string | null;
      role: string;
    };
  };
}

function toGraphQLErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && 'graphQLErrors' in error) {
    const graphqlError = error as { graphQLErrors: Array<{ message: string }> };
    return graphqlError.graphQLErrors[0]?.message || fallback;
  }

  return fallback;
}

export default function Profile() {
  const {
    user: authUser,
    token,
    login,
    logout,
    updateUser: updateAuthUser,
  } = useAuth();
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [tenantSelectionOverride, setTenantSelectionOverride] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [tenantConfigDraft, setTenantConfigDraft] = useState<TenantConfigInput>({});
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const canManageTenantConfig =
    authUser?.role === 'TENANT_ADMIN' || authUser?.role === 'SUPER_ADMIN';

  const graphqlEndpoint =
    import.meta.env.VITE_GRAPHQL_ENDPOINT || 'http://localhost:3500/graphql';
  const apiBaseUrl = graphqlEndpoint.endsWith('/graphql')
    ? graphqlEndpoint.slice(0, -'/graphql'.length)
    : graphqlEndpoint;
  const logoUploadEndpoint = `${apiBaseUrl}/api/v1/tenant/logo`;

  const { data, refetch } = useQuery<GetUserQuery>(GET_USER, {
    variables: { userId: authUser?.id },
    skip: !authUser?.id,
  });

  const {
    data: membershipsData,
    refetch: refetchTenants,
  } = useQuery<MyTenantsQuery>(MY_TENANTS, {
    skip: !token,
  });

  const { data: tenantBrandingData, refetch: refetchMyTenant } =
    useQuery<MyTenantQuery>(MY_TENANT, {
      skip: !token,
    });

  const { data: tenantConfigData, refetch: refetchTenantConfig } =
    useQuery<TenantConfigQuery>(TENANT_CONFIG, {
      skip: !token || !canManageTenantConfig,
    });

  const [updateUser] = useMutation<UpdateUserMutation>(UPDATE_USER);
  const [updateTenantConfigMutation, { loading: updatingTenantConfig }] =
    useMutation<UpdateTenantConfigMutation>(UPDATE_TENANT_CONFIG);
  const [changePassword] = useMutation<ChangePasswordMutation>(CHANGE_PASSWORD);
  const [logoutMutation] = useMutation<LogoutMutation>(LOGOUT);
  const [switchTenantMutation, { loading: switchingTenant }] =
    useMutation<SwitchTenantMutation>(SWITCH_TENANT);

  const memberships = useMemo(
    () => membershipsData?.myTenants.memberships ?? [],
    [membershipsData],
  );

  const activeMembership = useMemo(
    () => memberships.find((membership) => membership.tenantId === authUser?.tenantId),
    [authUser?.tenantId, memberships],
  );

  const selectedTenantId = useMemo(() => {
    if (
      tenantSelectionOverride &&
      memberships.some((membership) => membership.tenantId === tenantSelectionOverride)
    ) {
      return tenantSelectionOverride;
    }

    if (authUser?.tenantId) {
      return authUser.tenantId;
    }

    return memberships[0]?.tenantId ?? '';
  }, [authUser?.tenantId, memberships, tenantSelectionOverride]);

  const tenantBranding = tenantBrandingData?.myTenant;
  const tenantConfig = tenantConfigData?.tenantConfig;

  const resolvedBusinessHours = useMemo(
    () => ({
      mon:
        tenantConfigDraft.businessHours?.mon ??
        tenantConfig?.businessHours?.mon ??
        '',
      tue:
        tenantConfigDraft.businessHours?.tue ??
        tenantConfig?.businessHours?.tue ??
        '',
      wed:
        tenantConfigDraft.businessHours?.wed ??
        tenantConfig?.businessHours?.wed ??
        '',
      thu:
        tenantConfigDraft.businessHours?.thu ??
        tenantConfig?.businessHours?.thu ??
        '',
      fri:
        tenantConfigDraft.businessHours?.fri ??
        tenantConfig?.businessHours?.fri ??
        '',
      sat:
        tenantConfigDraft.businessHours?.sat ??
        tenantConfig?.businessHours?.sat ??
        '',
      sun:
        tenantConfigDraft.businessHours?.sun ??
        tenantConfig?.businessHours?.sun ??
        '',
    }),
    [tenantConfig, tenantConfigDraft.businessHours],
  );

  const resolvedPrimaryColor =
    tenantConfigDraft.primaryColor ?? tenantConfig?.primaryColor ?? '#3B82F6';

  // Initialize name/bio from data when editing starts (lazy init via function)
  const initializeForm = () => {
    if (data?.getUser) {
      setName(data.getUser.name);
      setBio(data.getUser.bio || '');
    }
    setIsEditing(true);
  };

  useEffect(() => {
    if (!token) {
      navigate('/login');
    }
  }, [token, navigate]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      const { data } = await updateUser({
        variables: {
          userId: authUser?.id,
          input: { name, bio },
        },
      });

      if (data?.updateUser) {
        updateAuthUser({ name, bio });
        setIsEditing(false);
        setSuccess('Profile updated successfully!');
        void refetch();
      }
    } catch (err: unknown) {
      setError(toGraphQLErrorMessage(err, 'Update failed'));
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    try {
      const { data } = await changePassword({
        variables: {
          userId: authUser?.id,
          input: { currentPassword, newPassword },
        },
      });

      if (data?.changePassword) {
        setIsChangingPassword(false);
        setSuccess('Password changed successfully!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (err: unknown) {
      setError(toGraphQLErrorMessage(err, 'Password change failed'));
    }
  };

  const handleTenantSwitch = async () => {
    setError('');
    setSuccess('');

    if (!selectedTenantId) {
      setError('Please select a tenant');
      return;
    }

    if (selectedTenantId === authUser?.tenantId) {
      setSuccess('You are already using this tenant.');
      return;
    }

    try {
      const { data } = await switchTenantMutation({
        variables: {
          tenantId: selectedTenantId,
        },
      });

      if (data?.switchTenant) {
        login(data.switchTenant.accessToken, data.switchTenant.user);
        setSuccess('Active tenant switched successfully!');
        void refetch();
        void refetchTenants();
      }
    } catch (err: unknown) {
      setError(toGraphQLErrorMessage(err, 'Failed to switch tenant'));
    }
  };

  const setBusinessHour = (
    day: keyof NonNullable<TenantConfigInput['businessHours']>,
    value: string,
  ) => {
    setTenantConfigDraft((current) => ({
      ...current,
      businessHours: {
        ...(current.businessHours ?? {}),
        [day]: value,
      },
    }));
  };

  const handleUpdateTenantConfiguration = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const businessHours = Object.entries(resolvedBusinessHours).reduce(
      (result, [day, value]) => {
        const normalizedValue = value.trim();
        if (normalizedValue.length > 0) {
          result[day as keyof NonNullable<TenantConfigInput['businessHours']>] =
            normalizedValue;
        }

        return result;
      },
      {} as NonNullable<TenantConfigInput['businessHours']>,
    );

    const input: TenantConfigInput = {
      primaryColor: resolvedPrimaryColor,
      subdomain:
        (tenantConfigDraft.subdomain ?? tenantConfig?.subdomain ?? '')
          .trim()
          .toLowerCase() || undefined,
      timezone: (tenantConfigDraft.timezone ?? tenantConfig?.timezone ?? 'UTC').trim(),
      defaultLanguage: (
        tenantConfigDraft.defaultLanguage ??
        tenantConfig?.defaultLanguage ??
        'en'
      ).trim(),
      businessHours,
    };

    try {
      const { data } = await updateTenantConfigMutation({
        variables: {
          input,
        },
      });

      if (data?.updateTenantConfig) {
        setTenantConfigDraft({});
        setSuccess('Tenant configuration updated successfully!');
        void refetchTenantConfig();
        void refetchMyTenant();
      }
    } catch (err: unknown) {
      setError(toGraphQLErrorMessage(err, 'Failed to update tenant configuration'));
    }
  };

  const handleTenantLogoUpload = async () => {
    setError('');
    setSuccess('');

    if (!logoFile) {
      setError('Please select a logo file before uploading');
      return;
    }

    if (!token) {
      setError('UNAUTHORIZED');
      return;
    }

    const formData = new FormData();
    formData.append('file', logoFile);

    setIsUploadingLogo(true);

    try {
      const response = await fetch(logoUploadEndpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const payload = (await response
        .json()
        .catch(() => ({}))) as { logoUrl?: string; message?: string };

      if (!response.ok || !payload.logoUrl) {
        throw new Error(payload.message || 'Logo upload failed');
      }

      setLogoFile(null);
      setSuccess('Tenant logo uploaded successfully!');
      void refetchMyTenant();
      void refetchTenantConfig();
    } catch (err: unknown) {
      const fallbackMessage = 'Logo upload failed';
      setError(err instanceof Error ? err.message : fallbackMessage);
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logoutMutation();
    } catch {
      // Fall back to client-side logout to avoid trapping the user in an invalid state.
    } finally {
      logout();
      navigate('/login');
    }
  };

  if (!token) {
    return null;
  }

  return (
    <div className="container">
      <h1>Profile</h1>

      <div
        className="tenant-nav"
        style={{
          borderColor: resolvedPrimaryColor,
        }}
      >
        {tenantBranding?.logoUrl ? (
          <img
            src={tenantBranding.logoUrl}
            alt={`${tenantBranding.name} logo`}
            className="tenant-nav-logo"
          />
        ) : (
          <div
            className="tenant-nav-logo tenant-nav-logo-fallback"
            style={{
              backgroundColor: resolvedPrimaryColor,
            }}
          >
            {(tenantBranding?.name || activeMembership?.tenantName || 'T')
              .slice(0, 1)
              .toUpperCase()}
          </div>
        )}
        <div className="tenant-nav-meta">
          <strong>{tenantBranding?.name || activeMembership?.tenantName || 'Tenant'}</strong>
          <span>@{tenantBranding?.slug || activeMembership?.tenantSlug || 'default'}</span>
        </div>
      </div>
      
      {error && <div className="error">{error}</div>}
      {success && <div className="success">{success}</div>}

      <div className="profile-section">
        <h2>Account Information</h2>
        <div className="info-row">
          <strong>Username:</strong> {authUser?.username}
        </div>
        <div className="info-row">
          <strong>Active tenant:</strong>{' '}
          {activeMembership?.tenantName || authUser?.tenantId || 'Unknown'}
        </div>
        <div className="info-row">
          <strong>Member since:</strong>{' '}
          {data?.getUser?.createdAt
            ? new Date(data.getUser.createdAt).toLocaleDateString()
            : ''}
        </div>
        {canManageTenantConfig && (
          <div className="button-group dashboard-entry-link-row">
            <Link to="/admin/dashboard" className="btn-secondary">
              Open Admin Dashboard
            </Link>
          </div>
        )}
      </div>

      <div className="profile-section">
        <h2>Tenant Context</h2>

        {memberships.length === 0 ? (
          <p>No memberships found for your account.</p>
        ) : (
          <>
            <div className="form-group">
              <label htmlFor="tenantId">Active Tenant</label>
              <select
                id="tenantId"
                value={selectedTenantId}
                onChange={(e) => setTenantSelectionOverride(e.target.value)}
              >
                {memberships.map((membership) => (
                  <option key={membership.tenantId} value={membership.tenantId}>
                    {membership.tenantName} ({membership.roleNames.join(', ')})
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleTenantSwitch}
              className="btn-primary"
              disabled={switchingTenant || selectedTenantId === authUser?.tenantId}
            >
              {switchingTenant ? 'Switching...' : 'Switch Tenant'}
            </button>
          </>
        )}
      </div>

      {canManageTenantConfig && (
        <div className="profile-section">
          <h2>Tenant Configuration</h2>
          <form onSubmit={handleUpdateTenantConfiguration} className="form tenant-config-form">
            <div className="form-group">
              <label htmlFor="primaryColor">Primary Color</label>
              <input
                type="color"
                id="primaryColor"
                value={resolvedPrimaryColor}
                onChange={(e) =>
                  setTenantConfigDraft((current) => ({
                    ...current,
                    primaryColor: e.target.value,
                  }))
                }
              />
            </div>

            <div className="form-group">
              <label htmlFor="subdomain">Subdomain</label>
              <input
                type="text"
                id="subdomain"
                placeholder="myschool"
                value={tenantConfigDraft.subdomain ?? tenantConfig?.subdomain ?? ''}
                onChange={(e) =>
                  setTenantConfigDraft((current) => ({
                    ...current,
                    subdomain: e.target.value,
                  }))
                }
              />
            </div>

            <div className="form-group">
              <label htmlFor="timezone">Timezone</label>
              <input
                type="text"
                id="timezone"
                value={tenantConfigDraft.timezone ?? tenantConfig?.timezone ?? 'UTC'}
                onChange={(e) =>
                  setTenantConfigDraft((current) => ({
                    ...current,
                    timezone: e.target.value,
                  }))
                }
              />
            </div>

            <div className="form-group">
              <label htmlFor="defaultLanguage">Default Language</label>
              <input
                type="text"
                id="defaultLanguage"
                placeholder="en"
                value={
                  tenantConfigDraft.defaultLanguage ??
                  tenantConfig?.defaultLanguage ??
                  'en'
                }
                onChange={(e) =>
                  setTenantConfigDraft((current) => ({
                    ...current,
                    defaultLanguage: e.target.value,
                  }))
                }
              />
            </div>

            <div className="tenant-business-hours-grid">
              <div className="form-group">
                <label htmlFor="business-mon">Mon</label>
                <input
                  type="text"
                  id="business-mon"
                  placeholder="09:00-18:00"
                  value={resolvedBusinessHours.mon}
                  onChange={(e) => setBusinessHour('mon', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label htmlFor="business-tue">Tue</label>
                <input
                  type="text"
                  id="business-tue"
                  placeholder="09:00-18:00"
                  value={resolvedBusinessHours.tue}
                  onChange={(e) => setBusinessHour('tue', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label htmlFor="business-wed">Wed</label>
                <input
                  type="text"
                  id="business-wed"
                  placeholder="09:00-18:00"
                  value={resolvedBusinessHours.wed}
                  onChange={(e) => setBusinessHour('wed', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label htmlFor="business-thu">Thu</label>
                <input
                  type="text"
                  id="business-thu"
                  placeholder="09:00-18:00"
                  value={resolvedBusinessHours.thu}
                  onChange={(e) => setBusinessHour('thu', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label htmlFor="business-fri">Fri</label>
                <input
                  type="text"
                  id="business-fri"
                  placeholder="09:00-18:00"
                  value={resolvedBusinessHours.fri}
                  onChange={(e) => setBusinessHour('fri', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label htmlFor="business-sat">Sat</label>
                <input
                  type="text"
                  id="business-sat"
                  placeholder="10:00-14:00"
                  value={resolvedBusinessHours.sat}
                  onChange={(e) => setBusinessHour('sat', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label htmlFor="business-sun">Sun</label>
                <input
                  type="text"
                  id="business-sun"
                  placeholder="closed"
                  value={resolvedBusinessHours.sun}
                  onChange={(e) => setBusinessHour('sun', e.target.value)}
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn-primary"
              disabled={updatingTenantConfig}
            >
              {updatingTenantConfig ? 'Saving...' : 'Save Tenant Settings'}
            </button>
          </form>

          <div className="tenant-logo-upload">
            <label htmlFor="tenant-logo-upload">Tenant Logo</label>
            <input
              id="tenant-logo-upload"
              type="file"
              accept="image/*"
              onChange={(event) => {
                const nextFile = event.target.files?.[0] ?? null;
                setLogoFile(nextFile);
              }}
            />
            <button
              type="button"
              className="btn-secondary"
              onClick={handleTenantLogoUpload}
              disabled={isUploadingLogo}
            >
              {isUploadingLogo ? 'Uploading...' : 'Upload Logo'}
            </button>
          </div>
        </div>
      )}

      <div className="profile-section">
        <h2>Profile Details</h2>
        {isEditing ? (
          <form onSubmit={handleUpdateProfile} className="form">
            <div className="form-group">
              <label htmlFor="name">Display Name</label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="bio">Bio</label>
              <textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={4}
              />
            </div>

            <div className="button-group">
              <button type="submit" className="btn-primary">
                Save Changes
              </button>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="profile-details">
            <div className="info-row">
              <strong>Name:</strong> {data?.getUser?.name || name}
            </div>
            <div className="info-row">
              <strong>Bio:</strong>{' '}
              {data?.getUser?.bio || bio || 'No bio set'}
            </div>
            <button onClick={initializeForm} className="btn-primary">
              Edit Profile
            </button>
          </div>
        )}
      </div>

      <div className="profile-section">
        <h2>Security</h2>
        {isChangingPassword ? (
          <form onSubmit={handleChangePassword} className="form">
            <div className="form-group">
              <label htmlFor="currentPassword">Current Password</label>
              <input
                type="password"
                id="currentPassword"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="newPassword">New Password</label>
              <input
                type="password"
                id="newPassword"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm New Password</label>
              <input
                type="password"
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>

            <div className="button-group">
              <button type="submit" className="btn-primary">
                Change Password
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsChangingPassword(false);
                  setCurrentPassword('');
                  setNewPassword('');
                  setConfirmPassword('');
                  setError('');
                }}
                className="btn-secondary"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setIsChangingPassword(true)}
            className="btn-primary"
          >
            Change Password
          </button>
        )}
      </div>

      <div className="profile-section">
        <button onClick={handleLogout} className="btn-danger">
          Logout
        </button>
      </div>
    </div>
  );
}
