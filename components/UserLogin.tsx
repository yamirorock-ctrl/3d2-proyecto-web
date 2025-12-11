import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabaseService';
import { useAuth } from '../context/AuthContext';

const UserLogin: React.FC<{ onLogin?: (username:string)=>void }> = ({ onLogin }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    // If already logged in, redirect home
    if (user) {
        navigate('/');
    }
    setMessage(null);
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (!email || !password) return setMessage('Email y contraseña requeridos');

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        setLoading(false);
        setMessage(error.message === 'Invalid login credentials' ? 'Credenciales incorrectas' : error.message);
        return;
      }
      
      // Success - AuthContext will pick it up automatically due to onAuthStateChange
      // We can manually call onLogin if needed, but it was deprecated.
      // onLogin prop was expecting a username string. We can pass email.
      if (onLogin && data.user && data.user.email) {
          onLogin(data.user.email);
      }
      
      navigate('/');
    } catch (e) {
      setLoading(false);
      setMessage('Error inesperado al iniciar sesión');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">Ingresar</h2>
        {message && <div className="mb-4 text-sm text-red-600 bg-red-50 p-3 rounded">{message}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-slate-700">Email</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} className="mt-1 w-full rounded-md border-gray-200 p-2 border" placeholder="tu@email.com" />
          </div>
          <div>
            <label className="block text-sm text-slate-700">Contraseña</label>
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)} className="mt-1 w-full rounded-md border-gray-200 p-2 border" placeholder="••••••••" />
          </div>
          <div className="flex items-center justify-between">
            <button type="submit" disabled={loading} className="px-4 py-2 bg-indigo-600 text-white rounded-md flex items-center gap-2">
                {loading && <span className="animate-spin h-3 w-3 border-2 border-white border-t-transparent rounded-full"></span>}
                Entrar
            </button>
            <button type="button" onClick={()=>navigate('/')} className="text-sm text-slate-500">Volver</button>
          </div>
          <div className="mt-4 text-center">
             <button type="button" onClick={()=>navigate('/register')} className="text-sm text-indigo-600 hover:text-indigo-800">
               ¿No tienes cuenta? Regístrate
             </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UserLogin;
