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

  const checkAdmin = (u: User | null | undefined) => {
    if (!u) {
      setIsAdmin(false);
      return;
    }
    // Verificamos si el usuario tiene el rol de admin en sus metadatos de Supabase
    // Esto es mucho más seguro que comparar emails en el código cliente.
    const isUserAdmin = u.app_metadata?.role === 'admin' || u.user_metadata?.role === 'admin';
    setIsAdmin(isUserAdmin);
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
