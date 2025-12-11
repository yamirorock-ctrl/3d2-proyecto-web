import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabaseService';
import { useAuth } from '../context/AuthContext';

const AdminLogin: React.FC = () => {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMSG, setErrorMSG] = useState<string|null>(null);

  // Read admin secret for basic protection
  const ADMIN_SECRET = ((import.meta as any).env?.VITE_ADMIN_SECRET || 'modozen').trim();

  useEffect(() => {
    // If already admin, go to panel
    if (isAdmin) {
      navigate('/admin');
    }
  }, [isAdmin, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return alert('Email y contraseña requeridos');
    
    setLoading(true);
    setErrorMSG(null);

    try {
      // 1. Sign in with Supabase
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        setLoading(false);
        setErrorMSG(error.message);
        return;
      }

      if (data.user) {
         // 2. Check if user is actually the admin (by email or metadata could be checked here too, but AuthContext does it)
         // AuthContext will update state and redirect via AdminGuard if accessing protected route,
         // but here we can check explicitly to give UI feedback if a non-admin user tries to log in here.
         const adminEmail = (import.meta as any).env.VITE_ADMIN_EMAIL;
         if (adminEmail && data.user.email !== adminEmail) {
             await supabase.auth.signOut();
             setLoading(false);
             setErrorMSG('Este usuario no tiene permisos de administrador.');
             return;
         }

          navigate('/admin');
      }

    } catch (error) {
       setLoading(false);
       setErrorMSG('Error inesperado al iniciar sesión.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">Acceso Administrador</h2>
        
        {errorMSG && (
             <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">
                 {errorMSG}
             </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm text-slate-700">Email</label>
            <input 
                type="email" 
                value={email} 
                onChange={e=>setEmail(e.target.value)} 
                className="mt-1 w-full rounded-md border-gray-200 p-2 border" 
                placeholder="admin@ejemplo.com"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-700">Contraseña</label>
            <input 
                type="password" 
                value={password} 
                onChange={e=>setPassword(e.target.value)} 
                className="mt-1 w-full rounded-md border-gray-200 p-2 border" 
                placeholder="••••••••"
            />
          </div>

          <button 
            type="submit" 
            disabled={loading} 
            className="w-full px-4 py-2 bg-slate-900 text-white rounded-md disabled:opacity-50 flex justify-center items-center gap-2"
          >
            {loading && <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>}
            {loading ? 'Verificando...' : 'Entrar al Panel'}
          </button>
        </form>
         <div className="mt-4 text-center text-xs text-gray-400">
             Protegido por Supabase Auth
         </div>
      </div>
    </div>
  );
};

export default AdminLogin;
