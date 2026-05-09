import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { AuthContext } from './AuthContextDefinition';
import type { User } from './AuthContextDefinition';

function getInitialState(): { token: string | null; user: User | null } {
  const storedToken = localStorage.getItem('token');
  const storedUser = localStorage.getItem('user');
  if (storedToken && storedUser) {
    return { token: storedToken, user: JSON.parse(storedUser) as User };
  }
  return { token: null, user: null };
}

interface OAuthCallbackParams {
  accessToken?: string;
  provider?: string;
  error?: string;
}

function parseOAuthCallback(): OAuthCallbackParams | null {
  const urlParams = new URLSearchParams(window.location.search);
  const accessToken = urlParams.get('accessToken');
  const provider = urlParams.get('provider');
  const error = urlParams.get('error');

  if (accessToken || error) {
    // Clean URL params
    window.history.replaceState({}, document.title, window.location.pathname);
    return {
      accessToken: accessToken || undefined,
      provider: provider || undefined,
      error: error || undefined,
    };
  }
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => getInitialState().user);
  const [token, setToken] = useState<string | null>(() => getInitialState().token);

  // Handle OAuth callback on initial load
  useEffect(() => {
    const oauthParams = parseOAuthCallback();
    if (oauthParams?.accessToken) {
      setToken(oauthParams.accessToken);
      localStorage.setItem('token', oauthParams.accessToken);
    }
  }, []);

  const login = (newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  const updateUser = (updatedUser: Partial<User>) => {
    if (user) {
      const newUser = { ...user, ...updatedUser };
      setUser(newUser);
      localStorage.setItem('user', JSON.stringify(newUser));
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}