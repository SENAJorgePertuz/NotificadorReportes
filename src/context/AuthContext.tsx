import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { api, setAuthToken, removeAuthToken, getAuthToken } from '../services/api';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  switchRoleQuick: (role: UserRole) => Promise<void>;
  hasRole: (allowed: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchCurrentUser = async () => {
    try {
      const token = getAuthToken();
      if (!token) {
        // Auto-login with default superadmin credentials if no token exists
        await autoLoginDefault();
        return;
      }
      const data = await api.getCurrentUser();
      setUser(data.user);
    } catch {
      // If token expired or invalid, auto-login with default
      await autoLoginDefault();
    } finally {
      setLoading(false);
    }
  };

  const autoLoginDefault = async () => {
    try {
      const res = await api.login('superadmin', 'Admin2026*');
      setAuthToken(res.token);
      setUser(res.user);
    } catch (e) {
      console.warn('Auto-login fallback error:', e);
      removeAuthToken();
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  const login = async (username: string, password: string) => {
    setLoading(true);
    try {
      const res = await api.login(username, password);
      setAuthToken(res.token);
      setUser(res.user);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    removeAuthToken();
    setUser(null);
  };

  const switchRoleQuick = async (role: UserRole) => {
    let targetUser = 'superadmin';
    let targetPass = 'Admin2026*';

    if (role === 'Admin') {
      targetUser = 'admin';
      targetPass = 'Admin2026*';
    } else if (role === 'Operador') {
      targetUser = 'operador';
      targetPass = 'Operador2026*';
    }

    await login(targetUser, targetPass);
  };

  const hasRole = (allowed: UserRole[]) => {
    if (!user) return false;
    return allowed.includes(user.role);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, switchRoleQuick, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
