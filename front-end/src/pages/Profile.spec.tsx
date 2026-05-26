import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Profile from '../pages/Profile';
import { AuthProvider } from '../context/AuthContext';
import { MockedProvider } from '@apollo/client/testing/react';
import { MemoryRouter } from 'react-router-dom';
import {
  GET_USER,
  UPDATE_USER,
  CHANGE_PASSWORD,
  LOGOUT,
} from '../graphql/queries';

const baseUser = {
  id: '123',
  username: 'testuser',
  name: 'Test User',
  bio: 'Test bio',
};

const makeGetUserMock = (overrides: Partial<typeof baseUser> = {}) => ({
  request: {
    query: GET_USER,
    variables: {
      userId: '123',
    },
  },
  result: {
    data: {
      getUser: {
        ...baseUser,
        createdAt: '2026-03-29T00:00:00Z',
        updatedAt: '2026-03-29T00:00:00Z',
        ...overrides,
      },
    },
  },
});

const makeUpdateUserMock = (name: string, bio: string) => ({
  request: {
    query: UPDATE_USER,
    variables: {
      userId: '123',
      input: { name, bio },
    },
  },
  result: {
    data: {
      updateUser: {
        ...baseUser,
        name,
        bio,
        createdAt: '2026-03-29T00:00:00Z',
        updatedAt: '2026-03-29T00:00:00Z',
      },
    },
  },
});

const makeChangePasswordMock = (currentPassword: string, newPassword: string) => ({
  request: {
    query: CHANGE_PASSWORD,
    variables: {
      userId: '123',
      input: { currentPassword, newPassword },
    },
  },
  result: {
    data: {
      changePassword: true,
    },
  },
});

const logoutSuccessMock = {
  request: {
    query: LOGOUT,
    variables: {},
  },
  result: {
    data: {
      logout: true,
    },
  },
};

const logoutFailureMock = {
  request: {
    query: LOGOUT,
    variables: {},
  },
  error: new Error('Logout API failed'),
};

describe('Profile Page', () => {
  let localStorageMock: {
    getItem: ReturnType<typeof vi.fn>;
    setItem: ReturnType<typeof vi.fn>;
    removeItem: ReturnType<typeof vi.fn>;
    clear: ReturnType<typeof vi.fn>;
    store: Record<string, string>;
  };

  const renderProfile = (mocks: unknown[] = [makeGetUserMock()]) => {
    return render(
      <MockedProvider mocks={mocks}>
        <MemoryRouter>
          <AuthProvider>
            <Profile />
          </AuthProvider>
        </MemoryRouter>
      </MockedProvider>,
    );
  };

  beforeEach(() => {
    localStorageMock = {
      store: {
        token: 'fake-token',
        user: JSON.stringify(baseUser),
      },
      getItem: vi.fn((key: string) => localStorageMock.store[key] || null),
      setItem: vi.fn((key: string, value: string) => {
        localStorageMock.store[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete localStorageMock.store[key];
      }),
      clear: vi.fn(() => {
        localStorageMock.store = {};
      }),
    };

    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true,
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders profile information correctly', async () => {
    renderProfile([makeGetUserMock()]);

    expect(await screen.findByRole('heading', { level: 1, name: /Profile/i })).toBeInTheDocument();
    expect(screen.getByText(/testuser/i)).toBeInTheDocument();
    expect(await screen.findByText(/Test User/i)).toBeInTheDocument();
    expect(await screen.findByText(/Test bio/i)).toBeInTheDocument();
  });

  it('shows fallback bio text when bio is empty', async () => {
    localStorageMock.store.user = JSON.stringify({ ...baseUser, bio: null });
    renderProfile([makeGetUserMock({ bio: null })]);

    expect(await screen.findByText(/No bio set/i)).toBeInTheDocument();
  });

  it('opens and cancels edit mode', async () => {
    renderProfile([makeGetUserMock()]);

    fireEvent.click(await screen.findByRole('button', { name: /Edit Profile/i }));
    expect(screen.getByLabelText(/Display Name/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));

    await waitFor(() => {
      expect(screen.queryByLabelText(/Display Name/i)).not.toBeInTheDocument();
    });
  });

  it('updates profile successfully and persists auth user', async () => {
    renderProfile([
      makeGetUserMock(),
      makeUpdateUserMock('Updated User', 'Updated bio'),
      makeGetUserMock({ name: 'Updated User', bio: 'Updated bio' }),
    ]);

    fireEvent.click(await screen.findByRole('button', { name: /Edit Profile/i }));

    fireEvent.change(screen.getByLabelText(/Display Name/i), {
      target: { value: 'Updated User' },
    });
    fireEvent.change(screen.getByLabelText(/Bio/i), {
      target: { value: 'Updated bio' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));

    await waitFor(() => {
      expect(screen.getByText(/Profile updated successfully!/i)).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /Edit Profile/i })).toBeInTheDocument();
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'user',
      JSON.stringify({ ...baseUser, name: 'Updated User', bio: 'Updated bio' }),
    );
  });

  it('keeps edit mode open when update mutation returns no user payload', async () => {
    renderProfile([
      makeGetUserMock(),
      {
        request: {
          query: UPDATE_USER,
          variables: {
            userId: '123',
            input: { name: 'Same Name', bio: 'Same Bio' },
          },
        },
        result: {
          data: {
            updateUser: null,
          },
        },
      },
    ]);

    fireEvent.click(await screen.findByRole('button', { name: /Edit Profile/i }));
    fireEvent.change(screen.getByLabelText(/Display Name/i), {
      target: { value: 'Same Name' },
    });
    fireEvent.change(screen.getByLabelText(/Bio/i), {
      target: { value: 'Same Bio' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Save Changes/i })).toBeInTheDocument();
    });
    expect(screen.queryByText(/Profile updated successfully!/i)).not.toBeInTheDocument();
  });

  it('shows update fallback error when profile update fails', async () => {
    renderProfile([
      makeGetUserMock(),
      {
        request: {
          query: UPDATE_USER,
          variables: {
            userId: '123',
            input: { name: 'Broken Update', bio: 'Broken Bio' },
          },
        },
        error: new Error('Network broke'),
      },
    ]);

    fireEvent.click(await screen.findByRole('button', { name: /Edit Profile/i }));
    fireEvent.change(screen.getByLabelText(/Display Name/i), {
      target: { value: 'Broken Update' },
    });
    fireEvent.change(screen.getByLabelText(/Bio/i), {
      target: { value: 'Broken Bio' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));

    await waitFor(() => {
      expect(screen.getByText(/Update failed/i)).toBeInTheDocument();
    });
  });

  it('opens and cancels change password form while clearing entered state', async () => {
    renderProfile([makeGetUserMock()]);

    fireEvent.click(await screen.findByRole('button', { name: /Change Password/i }));
    fireEvent.change(screen.getByLabelText(/Current Password/i), {
      target: { value: 'secret-current' },
    });
    fireEvent.change(screen.getByLabelText(/^New Password/i), {
      target: { value: 'newpass123' },
    });
    fireEvent.change(screen.getByLabelText(/Confirm New Password/i), {
      target: { value: 'different' },
    });

    fireEvent.click(screen.getByRole('button', { name: /^Change Password$/i }));
    expect(screen.getByText(/New passwords do not match/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));

    await waitFor(() => {
      expect(screen.queryByLabelText(/Current Password/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/New passwords do not match/i)).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Change Password/i }));
    expect((screen.getByLabelText(/Current Password/i) as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText(/^New Password/i) as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText(/Confirm New Password/i) as HTMLInputElement).value).toBe('');
  });

  it('shows min length validation when new password is too short', async () => {
    renderProfile([makeGetUserMock()]);

    fireEvent.click(await screen.findByRole('button', { name: /Change Password/i }));
    fireEvent.change(screen.getByLabelText(/Current Password/i), {
      target: { value: 'secret-current' },
    });
    fireEvent.change(screen.getByLabelText(/^New Password/i), {
      target: { value: '12345' },
    });
    fireEvent.change(screen.getByLabelText(/Confirm New Password/i), {
      target: { value: '12345' },
    });

    fireEvent.click(screen.getByRole('button', { name: /^Change Password$/i }));

    await waitFor(() => {
      expect(screen.getByText(/Password must be at least 6 characters/i)).toBeInTheDocument();
    });
  });

  it('changes password successfully', async () => {
    renderProfile([
      makeGetUserMock(),
      makeChangePasswordMock('old-password', 'new-password-123'),
    ]);

    fireEvent.click(await screen.findByRole('button', { name: /Change Password/i }));

    fireEvent.change(screen.getByLabelText(/Current Password/i), {
      target: { value: 'old-password' },
    });
    fireEvent.change(screen.getByLabelText(/^New Password/i), {
      target: { value: 'new-password-123' },
    });
    fireEvent.change(screen.getByLabelText(/Confirm New Password/i), {
      target: { value: 'new-password-123' },
    });

    fireEvent.click(screen.getByRole('button', { name: /^Change Password$/i }));

    await waitFor(() => {
      expect(screen.getByText(/Password changed successfully!/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Change Password/i })).toBeInTheDocument();
    });
  });

  it('shows password update fallback error when mutation fails', async () => {
    renderProfile([
      makeGetUserMock(),
      {
        request: {
          query: CHANGE_PASSWORD,
          variables: {
            userId: '123',
            input: {
              currentPassword: 'old-password',
              newPassword: 'new-password-123',
            },
          },
        },
        error: new Error('Password mutation failed'),
      },
    ]);

    fireEvent.click(await screen.findByRole('button', { name: /Change Password/i }));
    fireEvent.change(screen.getByLabelText(/Current Password/i), {
      target: { value: 'old-password' },
    });
    fireEvent.change(screen.getByLabelText(/^New Password/i), {
      target: { value: 'new-password-123' },
    });
    fireEvent.change(screen.getByLabelText(/Confirm New Password/i), {
      target: { value: 'new-password-123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^Change Password$/i }));

    await waitFor(() => {
      expect(screen.getByText(/Password change failed/i)).toBeInTheDocument();
    });
  });

  it('logs out and clears local auth state on successful logout mutation', async () => {
    renderProfile([makeGetUserMock(), logoutSuccessMock]);

    fireEvent.click(await screen.findByRole('button', { name: /Logout/i }));

    await waitFor(() => {
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('token');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('user');
    });
  });

  it('logs out and clears local auth state even when logout mutation fails', async () => {
    renderProfile([makeGetUserMock(), logoutFailureMock]);

    fireEvent.click(await screen.findByRole('button', { name: /Logout/i }));

    await waitFor(() => {
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('token');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('user');
    });
  });

  it('renders nothing when token is missing', () => {
    localStorageMock.store = {};
    renderProfile();

    expect(screen.queryByRole('heading', { name: /Profile/i })).not.toBeInTheDocument();
  });
});
