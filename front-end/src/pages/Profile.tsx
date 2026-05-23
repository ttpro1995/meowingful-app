import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import { useNavigate } from 'react-router-dom';
import { GET_USER, UPDATE_USER, CHANGE_PASSWORD, LOGOUT } from '../graphql/queries';
import { useAuth } from '../context/useAuth';

interface User {
  id: string;
  username: string;
  name: string;
  bio: string | null;
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

export default function Profile() {
  const { user: authUser, token, logout, updateUser: updateAuthUser } = useAuth();
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
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

  const [updateUser] = useMutation<UpdateUserMutation>(UPDATE_USER);
  const [changePassword] = useMutation<ChangePasswordMutation>(CHANGE_PASSWORD);
  const [logoutMutation] = useMutation<LogoutMutation>(LOGOUT);

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
        refetch();
      }
    } catch (err: unknown) {
      if (err instanceof Error && 'graphQLErrors' in err) {
        const graphqlError = err as { graphQLErrors: Array<{ message: string }> };
        setError(graphqlError.graphQLErrors[0]?.message || 'Update failed');
      } else {
        setError('Update failed');
      }
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
      if (err instanceof Error && 'graphQLErrors' in err) {
        const graphqlError = err as { graphQLErrors: Array<{ message: string }> };
        setError(graphqlError.graphQLErrors[0]?.message || 'Password change failed');
      } else {
        setError('Password change failed');
      }
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
          <strong>Member since:</strong>{' '}
          {authUser ? new Date().toLocaleDateString() : ''}
        </div>
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
            <button
              onClick={initializeForm}
              className="btn-primary"
            >
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
