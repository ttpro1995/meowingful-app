import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Profile from '../pages/Profile';
import { AuthProvider } from '../context/AuthContext';
import { MockedProvider } from '@apollo/client/testing/react';
import { MemoryRouter } from 'react-router-dom';
import { GET_USER } from '../graphql/queries';

const getUserMock = {
  request: {
    query: GET_USER,
    variables: {
      userId: '123',
    },
  },
  result: {
    data: {
      getUser: {
        id: '123',
        username: 'testuser',
        name: 'Test User',
        bio: 'Test bio',
        createdAt: '2026-03-29T00:00:00Z',
        updatedAt: '2026-03-29T00:00:00Z',
      },
    },
  },
};

describe('Profile Page', () => {
  let localStorageMock: {
    getItem: ReturnType<typeof vi.fn>;
    setItem: ReturnType<typeof vi.fn>;
    removeItem: ReturnType<typeof vi.fn>;
    clear: ReturnType<typeof vi.fn>;
    store: Record<string, string>;
  };

  beforeEach(() => {
    localStorageMock = {
      store: { 
        token: 'fake-token', 
        user: JSON.stringify({ id: '123', username: 'testuser', name: 'Test User', bio: 'Test bio' }) 
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
    Object.defineProperty(window, 'localStorage', { value: localStorageMock, writable: true });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders profile information correctly', async () => {
    render(
      <MockedProvider mocks={[getUserMock]}>
        <MemoryRouter>
          <AuthProvider>
            <Profile />
          </AuthProvider>
        </MemoryRouter>
      </MockedProvider>
    );

    expect(await screen.findByRole('heading', { level: 1, name: /Profile/i })).toBeInTheDocument();
    expect(screen.getByText(/testuser/i)).toBeInTheDocument();
    expect(await screen.findByText(/Test User/i)).toBeInTheDocument();
    expect(await screen.findByText(/Test bio/i)).toBeInTheDocument();
  });

  it('should open edit mode when clicking Edit Profile', async () => {
    render(
      <MockedProvider mocks={[getUserMock]}>
        <MemoryRouter>
          <AuthProvider>
            <Profile />
          </AuthProvider>
        </MemoryRouter>
      </MockedProvider>
    );

    const editButton = await screen.findByRole('button', { name: /Edit Profile/i });
    fireEvent.click(editButton);

    // Wait for the form to appear
    await waitFor(() => {
      const nameInput = screen.getByLabelText(/Display Name/i);
      expect(nameInput).toBeInTheDocument();
    });
  });

  it('should cancel edit mode', async () => {
    render(
      <MockedProvider mocks={[getUserMock]}>
        <MemoryRouter>
          <AuthProvider>
            <Profile />
          </AuthProvider>
        </MemoryRouter>
      </MockedProvider>
    );

    const editButton = await screen.findByRole('button', { name: /Edit Profile/i });
    fireEvent.click(editButton);

    // Click cancel
    const cancelButton = screen.getByRole('button', { name: /Cancel/i });
    fireEvent.click(cancelButton);

    // Form should be closed
    await waitFor(() => {
      expect(screen.queryByLabelText(/Display Name/i)).not.toBeInTheDocument();
    });
  });

  it('should open change password form', async () => {
    render(
      <MockedProvider mocks={[getUserMock]}>
        <MemoryRouter>
          <AuthProvider>
            <Profile />
          </AuthProvider>
        </MemoryRouter>
      </MockedProvider>
    );

    const changePasswordButton = await screen.findByRole('button', { name: /Change Password/i });
    fireEvent.click(changePasswordButton);

    expect(screen.getByLabelText(/Current Password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^New Password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Confirm New Password/i)).toBeInTheDocument();
  });

  it('should cancel change password', async () => {
    render(
      <MockedProvider mocks={[getUserMock]}>
        <MemoryRouter>
          <AuthProvider>
            <Profile />
          </AuthProvider>
        </MemoryRouter>
      </MockedProvider>
    );

    const changePasswordButton = await screen.findByRole('button', { name: /Change Password/i });
    fireEvent.click(changePasswordButton);

    // Click cancel
    const cancelButton = screen.getByRole('button', { name: /Cancel/i });
    fireEvent.click(cancelButton);

    // Form should be closed
    await waitFor(() => {
      expect(screen.queryByLabelText(/Current Password/i)).not.toBeInTheDocument();
    });
  });

  it('should logout', async () => {
    render(
      <MockedProvider mocks={[getUserMock]}>
        <MemoryRouter>
          <AuthProvider>
            <Profile />
          </AuthProvider>
        </MemoryRouter>
      </MockedProvider>
    );

    const logoutButton = await screen.findByRole('button', { name: /Logout/i });
    fireEvent.click(logoutButton);

    expect(localStorageMock.removeItem).toHaveBeenCalledWith('token');
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('user');
  });

  it('should show member since date', async () => {
    render(
      <MockedProvider mocks={[getUserMock]}>
        <MemoryRouter>
          <AuthProvider>
            <Profile />
          </AuthProvider>
        </MemoryRouter>
      </MockedProvider>
    );

    expect(await screen.findByText(/Member since:/i)).toBeInTheDocument();
  });

  it('should display username in profile', async () => {
    render(
      <MockedProvider mocks={[getUserMock]}>
        <MemoryRouter>
          <AuthProvider>
            <Profile />
          </AuthProvider>
        </MemoryRouter>
      </MockedProvider>
    );

    expect(await screen.findByText(/Username:/i)).toBeInTheDocument();
    expect(screen.getByText('testuser')).toBeInTheDocument();
  });
});
