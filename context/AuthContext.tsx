import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getCurrentUser, clearCurrentUser } from '../utils/auth';

interface AuthContextType {
  currentUser: string | null;
  login: (user: string) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<string | null>(() => getCurrentUser());

  const login = (user: string) => {
    setCurrentUser(user);
  };

  const logout = () => {
    clearCurrentUser();
    setCurrentUser(null);
  };

  return (
    <AuthContext.Provider value={{ currentUser, login, logout, isAuthenticated: !!currentUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
