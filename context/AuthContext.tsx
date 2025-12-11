import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../services/supabaseService';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  login: (email: string) => void; // Deprecated - kept for compatibility types if needed, but should be removed eventually
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  // Read admin email from env
  const ADMIN_EMAIL = (import.meta as any).env.VITE_ADMIN_EMAIL || '';

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      checkAdmin(session?.user);
      setLoading(false);
    });

    // Listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      checkAdmin(session?.user);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkAdmin = (currentUser: User | null | undefined) => {
    if (!currentUser || !currentUser.email) {
      setIsAdmin(false);
      return;
    }
    // Simple check: is the email the admin email?
    // In strict production, this could be a claim in the token, but env check is safe enough for this scale if RLS is also set.
    setIsAdmin(currentUser.email === ADMIN_EMAIL);
  };

  const logout = async () => {
    await supabase.auth.signOut();
  };

  // Deprecated compatibility stub
  const login = (_user: string) => {
    console.warn('AuthContext.login is deprecated. Use supabase.auth.signInWithPassword');
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, isAdmin, login, logout }}>
      {!loading && children}
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
