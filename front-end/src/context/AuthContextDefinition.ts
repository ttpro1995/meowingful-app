import { createContext } from 'react';

interface User {
  id: string;
  tenantId?: string;
  username: string;
  name: string;
  bio?: string | null;
  role?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  updateUser: (user: Partial<User>) => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
export type { User, AuthContextType };