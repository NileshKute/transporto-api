'use client';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { login as authLogin, logout as authLogout, getUser, getToken } from '@/lib/auth';

interface User { id: string; name: string; email: string; role: string; phone?: string; }
interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const u = getUser();
    const t = getToken();
    setUser(u);
    setToken(t);
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    const data = await authLogin(email, password);
    setUser(data.user);
    setToken(data.token);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    authLogout();
  };

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated: !!token, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
