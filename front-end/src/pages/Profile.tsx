import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import { useNavigate } from 'react-router-dom';
import {
  CHANGE_PASSWORD,
  GET_USER,
  LOGOUT,
  MY_TENANTS,
  SWITCH_TENANT,
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
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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

  const [updateUser] = useMutation<UpdateUserMutation>(UPDATE_USER);
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
