import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MockedProvider } from '@apollo/client/testing/react';
import type { MockedResponse } from '@apollo/client/testing';
import { MemoryRouter } from 'react-router-dom';
import InviteResponse from './InviteResponse';
import { AuthProvider } from '../context/AuthContext';
import { ACCEPT_INVITATION, DECLINE_INVITATION } from '../graphql/queries';

describe('InviteResponse Page', () => {
  let localStorageMock: {
    getItem: ReturnType<typeof vi.fn>;
    setItem: ReturnType<typeof vi.fn>;
    removeItem: ReturnType<typeof vi.fn>;
    clear: ReturnType<typeof vi.fn>;
    store: Record<string, string>;
  };

  function renderInvitePage(options?: {
    mocks?: ReadonlyArray<MockedResponse>;
    route?: string;
  }) {
    return render(
      <MockedProvider mocks={options?.mocks ?? []}>
        <MemoryRouter initialEntries={[options?.route ?? '/invite?token=test-token']}>
          <AuthProvider>
            <InviteResponse />
          </AuthProvider>
        </MemoryRouter>
      </MockedProvider>,
    );
  }

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

    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true,
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows an invalid message when invite token is missing', () => {
    renderInvitePage({ route: '/invite' });

    expect(screen.getByText(/Invitation token is missing or invalid/i)).toBeInTheDocument();
  });

  it('asks unauthenticated users to login before responding', async () => {
    renderInvitePage({ route: '/invite?token=abc123' });

    expect(
      screen.getByText(/Please log in first to respond to this invitation/i),
    ).toBeInTheDocument();

    const loginLink = screen.getByRole('link', { name: /Login/i });
    expect(loginLink).toHaveAttribute('href', '/login?inviteToken=abc123');
  });

  it('accepts invitation for authenticated users', async () => {
    localStorageMock.store = {
      token: 'active-token',
      user: JSON.stringify({
        id: 'user-1',
        tenantId: 'tenant-1',
        username: 'test-user',
        name: 'Test User',
        bio: null,
        role: 'USER',
      }),
    };

    const mocks = [
      {
        request: {
          query: ACCEPT_INVITATION,
          variables: {
            input: {
              token: 'abc123',
            },
          },
        },
        result: {
          data: {
            acceptInvitation: true,
          },
        },
      },
    ];

    renderInvitePage({
      route: '/invite?token=abc123',
      mocks,
    });

    fireEvent.click(screen.getByRole('button', { name: /Accept Invitation/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/Invitation accepted. You can now switch to this tenant from your profile./i),
      ).toBeInTheDocument();
    });
  });

  it('declines invitation for authenticated users', async () => {
    localStorageMock.store = {
      token: 'active-token',
      user: JSON.stringify({
        id: 'user-1',
        tenantId: 'tenant-1',
        username: 'test-user',
        name: 'Test User',
        bio: null,
        role: 'USER',
      }),
    };

    const mocks = [
      {
        request: {
          query: DECLINE_INVITATION,
          variables: {
            input: {
              token: 'abc123',
            },
          },
        },
        result: {
          data: {
            declineInvitation: true,
          },
        },
      },
    ];

    renderInvitePage({
      route: '/invite?token=abc123',
      mocks,
    });

    fireEvent.click(screen.getByRole('button', { name: /Decline Invitation/i }));

    await waitFor(() => {
      expect(screen.getByText(/Invitation declined./i)).toBeInTheDocument();
    });
  });
});
