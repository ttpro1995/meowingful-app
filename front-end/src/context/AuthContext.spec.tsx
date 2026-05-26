import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AuthProvider } from '../context/AuthContext';
import { useAuth } from '../context/useAuth';
import { MemoryRouter } from 'react-router-dom';

// Test component that uses useAuth hook
function TestComponent() {
  const auth = useAuth();
  return (
    <div>
      <div data-testid="token">{auth.token ?? 'no-token'}</div>
      <div data-testid="username">{auth.user?.username ?? 'no-user'}</div>
      <button onClick={() => auth.login('new-token', { id: '1', username: 'testuser', name: 'Test User', bio: null })}>
        Login
      </button>
      <button onClick={() => auth.logout()}>Logout</button>
      <button onClick={() => auth.updateUser({ name: 'Updated Name' })}>Update</button>
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
      store: {},
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
    Object.defineProperty(window, 'localStorage', { value: localStorageMock });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should provide auth context with initial null values', () => {
    render(
      <MemoryRouter>
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      </MemoryRouter>
    );

    expect(screen.getByTestId('token').textContent).toBe('no-token');
    expect(screen.getByTestId('username').textContent).toBe('no-user');
  });

  it('should login and update context', () => {
    render(
      <MemoryRouter>
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByText('Login'));

    expect(screen.getByTestId('token').textContent).toBe('new-token');
    expect(screen.getByTestId('username').textContent).toBe('testuser');
    expect(localStorageMock.setItem).toHaveBeenCalledWith('token', 'new-token');
    expect(localStorageMock.setItem).toHaveBeenCalledWith('user', JSON.stringify({ id: '1', username: 'testuser', name: 'Test User', bio: null }));
  });

  it('should logout and clear context', () => {
    localStorageMock.store = { token: 'existing-token', user: JSON.stringify({ id: '1', username: 'testuser', name: 'Test User', bio: null }) };

    const TestLogoutComponent = () => {
      const auth = useAuth();
      return (
        <div>
          <div data-testid="token">{auth.token ?? 'no-token'}</div>
          <button onClick={() => auth.logout()}>Logout</button>
        </div>
      );
    };

    render(
      <MemoryRouter>
        <AuthProvider>
          <TestLogoutComponent />
        </AuthProvider>
      </MemoryRouter>
    );

    expect(screen.getByTestId('token').textContent).toBe('existing-token');

    fireEvent.click(screen.getByText('Logout'));

    expect(screen.getByTestId('token').textContent).toBe('no-token');
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('token');
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('user');
  });

  it('should update user', () => {
    localStorageMock.store = { token: 'token', user: JSON.stringify({ id: '1', username: 'testuser', name: 'Test User', bio: null }) };

    render(
      <MemoryRouter>
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByText('Update'));

    expect(screen.getByTestId('username').textContent).toBe('testuser');
    expect(localStorageMock.setItem).toHaveBeenCalledWith('user', JSON.stringify({ id: '1', username: 'testuser', name: 'Updated Name', bio: null }));
  });

  it('should not persist user updates when no user is authenticated', () => {
    render(
      <MemoryRouter>
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByText('Update'));

    expect(localStorageMock.setItem).not.toHaveBeenCalledWith(
      'user',
      expect.stringContaining('Updated Name'),
    );
  });
});