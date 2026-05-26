import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Login from '../pages/Login';
import { AuthProvider } from '../context/AuthContext';
import { MockedProvider } from '@apollo/client/testing/react';
import { MemoryRouter } from 'react-router-dom';
import { LOGIN } from '../graphql/queries';

describe('Login Page', () => {
  let localStorageMock: {
    getItem: ReturnType<typeof vi.fn>;
    setItem: ReturnType<typeof vi.fn>;
    removeItem: ReturnType<typeof vi.fn>;
    clear: ReturnType<typeof vi.fn>;
    store: Record<string, string>;
  };

  beforeEach(() => {
    localStorageMock = {
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
      store: {},
    };
    Object.defineProperty(window, 'localStorage', { value: localStorageMock, writable: true });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders login form correctly', () => {
    render(
      <MockedProvider>
        <MemoryRouter>
          <AuthProvider>
            <Login />
          </AuthProvider>
        </MemoryRouter>
      </MockedProvider>
    );

    expect(screen.getByRole('heading', { name: /Login/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Login/i })).toBeInTheDocument();
  });

  it('should submit login form', async () => {
    const mocks = [
      {
        request: {
          query: LOGIN,
          variables: {
            input: {
              username: 'testuser',
              password: 'password123',
            },
          },
        },
        result: {
          data: {
            login: {
              accessToken: 'new-token',
              user: {
                id: '123',
                tenantId: 'tenant-1',
                username: 'testuser',
                name: 'Test User',
                bio: null,
                role: 'USER',
                createdAt: '2026-03-29T00:00:00Z',
                updatedAt: '2026-03-29T00:00:00Z',
              },
            },
          },
        },
      },
    ];

    render(
      <MockedProvider mocks={mocks}>
        <MemoryRouter>
          <AuthProvider>
            <Login />
          </AuthProvider>
        </MemoryRouter>
      </MockedProvider>
    );

    fireEvent.change(screen.getByLabelText(/Username/i), { target: { value: 'testuser' } });
    fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'password123' } });

    fireEvent.click(screen.getByRole('button', { name: /Login/i }));

    await waitFor(() => {
      expect(localStorageMock.setItem).toHaveBeenCalledWith('token', 'new-token');
    });
  });

  it('should show error on login failure', async () => {
    const mocks = [
      {
        request: {
          query: LOGIN,
          variables: {
            input: {
              username: 'testuser',
              password: 'wrongpassword',
            },
          },
        },
        error: new Error('Invalid credentials'),
      },
    ];

    render(
      <MockedProvider mocks={mocks}>
        <MemoryRouter>
          <AuthProvider>
            <Login />
          </AuthProvider>
        </MemoryRouter>
      </MockedProvider>
    );

    fireEvent.change(screen.getByLabelText(/Username/i), { target: { value: 'testuser' } });
    fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'wrongpassword' } });

    fireEvent.click(screen.getByRole('button', { name: /Login/i }));

    await waitFor(() => {
      expect(screen.getByText(/error|failed/i)).toBeInTheDocument();
    });
  });

  it('should show GraphQL error message when available', async () => {
    const gqlLikeError = Object.assign(new Error('GraphQL validation error'), {
      graphQLErrors: [{ message: 'Invalid credentials from GraphQL' }],
    });

    const mocks = [
      {
        request: {
          query: LOGIN,
          variables: {
            input: {
              username: 'testuser',
              password: 'wrongpassword',
            },
          },
        },
        error: gqlLikeError,
      },
    ];

    render(
      <MockedProvider mocks={mocks}>
        <MemoryRouter>
          <AuthProvider>
            <Login />
          </AuthProvider>
        </MemoryRouter>
      </MockedProvider>
    );

    fireEvent.change(screen.getByLabelText(/Username/i), { target: { value: 'testuser' } });
    fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'wrongpassword' } });
    fireEvent.click(screen.getByRole('button', { name: /Login/i }));

    await waitFor(() => {
      expect(screen.getByText(/Invalid credentials from GraphQL/i)).toBeInTheDocument();
    });
  });
});
