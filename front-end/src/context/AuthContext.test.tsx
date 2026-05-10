import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AuthProvider } from './AuthContext';
import { AuthContext } from './AuthContextDefinition';
import { useContext } from 'react';
import { useAuth } from './useAuth';

// Test component to access context
function TestComponent() {
  const context = useContext(AuthContext);
  if (!context) {
    return <div>No context</div>;
  }
  return (
    <div>
      <div data-testid="user">{context.user?.name || 'No user'}</div>
      <div data-testid="token">{context.token || 'No token'}</div>
      <button
        onClick={() =>
          context.login('test-token', { id: '1', username: 'test', name: 'Test User' })
        }
      >
        Login
      </button>
      <button onClick={context.logout}>Logout</button>
      <button onClick={() => context.updateUser({ name: 'Updated Name' })}>
        Update User
      </button>
    </div>
  );
}

describe('AuthContext', () => {
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
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true,
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should provide initial state with no user', () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>,
    );

    expect(screen.getByTestId('user').textContent).toBe('No user');
    expect(screen.getByTestId('token').textContent).toBe('No token');
  });

  it('should login and update context', async () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>,
    );

    fireEvent.click(screen.getByText('Login'));

    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('Test User');
    });

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'token',
      'test-token',
    );
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'user',
      JSON.stringify({ id: '1', username: 'test', name: 'Test User' }),
    );
  });

  it('should logout and clear context', async () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>,
    );

    // First login
    fireEvent.click(screen.getByText('Login'));

    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('Test User');
    });

    // Then logout
    fireEvent.click(screen.getByText('Logout'));

    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('No user');
    });

    expect(localStorageMock.removeItem).toHaveBeenCalledWith('token');
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('user');
  });

  it('should update user', async () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>,
    );

    // First login
    fireEvent.click(screen.getByText('Login'));

    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('Test User');
    });

    // Update user
    fireEvent.click(screen.getByText('Update User'));

    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('Updated Name');
    });
  });

  it('should restore state from localStorage on initialization', () => {
    // Pre-populate localStorage
    const user = { id: '1', username: 'stored', name: 'Stored User' };
    localStorageMock.store['token'] = 'stored-token';
    localStorageMock.store['user'] = JSON.stringify(user);

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>,
    );

    expect(screen.getByTestId('user').textContent).toBe('Stored User');
    expect(screen.getByTestId('token').textContent).toBe('stored-token');
  });
});

describe('useAuth hook', () => {
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
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true,
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should throw error when used outside AuthProvider', () => {
    function TestUseAuthHook() {
      useAuth();
      return null;
    }

    expect(() => {
      render(<TestUseAuthHook />);
    }).toThrow('useAuth must be used within an AuthProvider');
  });

  it('should return context when used within AuthProvider', () => {
    function TestUseAuthHook() {
      const context = useAuth();
      return <div data-testid="auth-context">{context.user ? 'has user' : 'no user'}</div>;
    }

    render(
      <AuthProvider>
        <TestUseAuthHook />
      </AuthProvider>,
    );

    expect(screen.getByTestId('auth-context').textContent).toBe('no user');
  });
});