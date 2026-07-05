import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '../services/api';

interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: 'admin' | 'dispatcher' | 'master' | 'installer' | 'engineer' | 'chief_engineer' | 'supervisor' | 'tech_director' | 'executive_director' | 'general_director';
  master_profile?: {
    id: number;
    phone: string;
    region: number;
  };
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if user is logged in on mount
    const token = localStorage.getItem('token');
    if (token) {
      api.get('/users/me/').then((response) => {
        setUser(response.data);
        setIsLoading(false);
      }).catch(() => {
        localStorage.removeItem('token');
        setIsLoading(false);
      });
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = async (username: string, password: string) => {
    try {
      const response = await api.post('/auth/login/', {
        username,
        password,
      });
      
      const { token, user: userData } = response.data;
      
      localStorage.setItem('token', token);
      api.defaults.headers.Authorization = `Token ${token}`;
      setUser(userData);
    } catch (error) {
      throw new Error('Неверные учетные данные');
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    delete api.defaults.headers.Authorization;
    setUser(null);
  };

  const refreshToken = async () => {
    try {
      const response = await api.post('/auth/refresh/', {
        token: localStorage.getItem('token'),
      });
      
      const { token } = response.data;
      localStorage.setItem('token', token);
      api.defaults.headers.Authorization = `Token ${token}`;
    } catch (error) {
      logout();
    }
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, login, logout, refreshToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
