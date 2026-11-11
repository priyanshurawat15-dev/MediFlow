import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, ApiError } from '../services/api';
import { User } from '../types';

interface DemoUser {
  username: string;
  role: string;
  label: string;
  name: string;
  department: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  quickLogin: (username: string) => Promise<void>;
  logout: () => void;
  demoUsers: DemoUser[];
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEMO_PASSWORDS: Record<string, string> = {
  admin: 'admin123',
  'dr.ananya': 'doctor123',
  'nurse.sarah': 'nurse123',
  'recep.rohit': 'recep123',
  'driver.arun': 'amb123',
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('mediflow_token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [demoUsers, setDemoUsers] = useState<DemoUser[]>([
    { username: 'admin', role: 'admin', label: 'Hospital Admin', name: 'Dr. Rajiv Sharma', department: 'Hospital Administration' },
    { username: 'dr.ananya', role: 'doctor', label: 'Emergency Doctor', name: 'Dr. Ananya Sen', department: 'Emergency Medicine' },
    { username: 'nurse.sarah', role: 'nurse', label: 'Triage Nurse', name: 'Sarah Thomas, RN', department: 'Emergency Triage' },
    { username: 'recep.rohit', role: 'receptionist', label: 'Reception & Billing', name: 'Rohit Verma', department: 'Central Reception' },
    { username: 'driver.arun', role: 'ambulance', label: 'EMS Dispatch Driver', name: 'Arun Kumar', department: 'Rapid EMS Dispatch' },
  ]);

  const fetchCurrentUser = useCallback(async () => {
    const savedToken = localStorage.getItem('mediflow_token');
    if (!savedToken) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      const res = await api.get<{ user: User }>('/auth/me');
      setUser(res.user);
    } catch (err) {
      console.warn('Session expired or invalid, logging out:', err);
      localStorage.removeItem('mediflow_token');
      setToken(null);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCurrentUser();
    // Fetch demo users from backend if available
    api.get<{ demoUsers: DemoUser[] }>('/auth/demo-accounts')
      .then((data) => {
        if (data?.demoUsers) setDemoUsers(data.demoUsers);
      })
      .catch(() => {});
  }, [fetchCurrentUser]);

  const login = async (username: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await api.post<{ token: string; user: User }>('/auth/login', { username, password });
      localStorage.setItem('mediflow_token', res.token);
      setToken(res.token);
      setUser(res.user);
    } catch (err) {
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const quickLogin = async (username: string) => {
    const password = DEMO_PASSWORDS[username] || 'password123';
    await login(username, password);
  };

  const logout = () => {
    localStorage.removeItem('mediflow_token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, quickLogin, logout, demoUsers }}>
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

