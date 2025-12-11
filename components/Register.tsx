import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabaseService';

const Register: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (!email || !password) return setMessage('Email y contraseña son requeridos');
    if (password !== password2) return setMessage('Las contraseñas no coinciden');

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        setLoading(false);
        return setMessage(`Error: ${error.message}`);
      }

      setLoading(false);
      
      // If email confirmation is enabled, Supabase might not return a session immediately.
      // But user said 'Confirm email' is enabled in screenshots, so data.session might be null until confirmed.
      // We should inform the user.
      if (data.user && !data.session) {
         setMessage('Registro exitoso. ¡Por favor verifica tu correo electrónico para confirmar tu cuenta!');
      } else {
         setMessage('Registro exitoso. Redirigiendo...');
         setTimeout(() => navigate('/'), 1200);
      }

    } catch (e) {
      setLoading(false);
      setMessage('Error inesperado al registrar.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">Registro de usuario</h2>
        {message && <div className={`mb-4 text-sm p-3 rounded ${message.includes('Error') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>{message}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-slate-700">Email</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} className="mt-1 w-full rounded-md border-gray-200 p-2 border" placeholder="tu@email.com" />
          </div>
          <div>
            <label className="block text-sm text-slate-700">Contraseña</label>
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)} className="mt-1 w-full rounded-md border-gray-200 p-2 border" placeholder="••••••••" />
          </div>
          <div>
            <label className="block text-sm text-slate-700">Confirmar contraseña</label>
            <input type="password" value={password2} onChange={e=>setPassword2(e.target.value)} className="mt-1 w-full rounded-md border-gray-200 p-2 border" placeholder="••••••••" />
          </div>

          <div className="flex items-center justify-between">
            <button type="submit" disabled={loading} className="px-4 py-2 bg-emerald-600 text-white rounded-md flex gap-2 items-center">
               {loading && <span className="animate-spin h-3 w-3 border-2 border-white border-t-transparent rounded-full"></span>}
               Registrarme
            </button>
            <button type="button" onClick={()=>navigate('/')} className="text-sm text-slate-500">Volver</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Register;
