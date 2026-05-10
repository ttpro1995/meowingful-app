import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Register from '../pages/Register';
import { AuthProvider } from '../context/AuthContext';
import { MockedProvider } from '@apollo/client/testing/react';
import { MemoryRouter } from 'react-router-dom';
import { REGISTER } from '../graphql/queries';

describe('Register Page', () => {
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

  it('renders register form correctly', () => {
    render(
      <MockedProvider>
        <MemoryRouter>
          <AuthProvider>
            <Register />
          </AuthProvider>
        </MemoryRouter>
      </MockedProvider>
    );

    expect(screen.getByRole('heading', { name: /Register/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Display Name/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Register/i })).toBeInTheDocument();
  });

  it('should submit registration form', async () => {
    const mocks = [
      {
        request: {
          query: REGISTER,
          variables: {
            input: {
              username: 'newuser',
              password: 'password123',
              name: 'New User',
            },
          },
        },
        result: {
          data: {
            register: {
              token: 'new-token',
              user: {
                id: '123',
                username: 'newuser',
                name: 'New User',
                bio: null,
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
            <Register />
          </AuthProvider>
        </MemoryRouter>
      </MockedProvider>
    );

    fireEvent.change(screen.getByLabelText(/Username/i), { target: { value: 'newuser' } });
    fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText(/Display Name/i), { target: { value: 'New User' } });

    fireEvent.click(screen.getByRole('button', { name: /Register/i }));

    await waitFor(() => {
      expect(localStorageMock.setItem).toHaveBeenCalledWith('token', 'new-token');
    });
  });

  it('should show error on registration failure', async () => {
    const mocks = [
      {
        request: {
          query: REGISTER,
          variables: {
            input: {
              username: 'existinguser',
              password: 'password123',
              name: 'Test User',
            },
          },
        },
        error: new Error('Username already exists'),
      },
    ];

    render(
      <MockedProvider mocks={mocks}>
        <MemoryRouter>
          <AuthProvider>
            <Register />
          </AuthProvider>
        </MemoryRouter>
      </MockedProvider>
    );

    fireEvent.change(screen.getByLabelText(/Username/i), { target: { value: 'existinguser' } });
    fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText(/Display Name/i), { target: { value: 'Test User' } });

    fireEvent.click(screen.getByRole('button', { name: /Register/i }));

    await waitFor(() => {
      expect(screen.getByText(/error|failed/i)).toBeInTheDocument();
    });
  });
});
