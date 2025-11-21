import React, { useState, useEffect } from 'react';
import { hashPassword, setAuthenticated, isAuthenticated } from '../utils/auth';
import { useNavigate } from 'react-router-dom';

const ADMIN_USER_KEY = 'admin_user';
const ADMIN_HASH_KEY = 'admin_pass_hash';

const AdminLogin: React.FC = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login'|'setup'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [remember, setRemember] = useState(true);
  const [expiryDays, setExpiryDays] = useState<number>(7);

  useEffect(() => {
    const existing = localStorage.getItem(ADMIN_USER_KEY);
    setMode(existing ? 'login' : 'setup');
    if (isAuthenticated()) {
      navigate('/admin');
    }
  }, [navigate]);

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return alert('Usuario y contraseña requeridos');
    if (password !== password2) return alert('Las contraseñas no coinciden');
    const hash = await hashPassword(password, username);
    localStorage.setItem(ADMIN_USER_KEY, username);
    localStorage.setItem(ADMIN_HASH_KEY, hash);
    setAuthenticated(remember, remember ? expiryDays : undefined);
    navigate('/admin');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const storedUser = localStorage.getItem(ADMIN_USER_KEY);
    const storedHash = localStorage.getItem(ADMIN_HASH_KEY);
    if (!storedUser || !storedHash) return alert('No hay cuenta configurada.');
    if (username !== storedUser) return alert('Usuario incorrecto');
    const hash = await hashPassword(password, username);
    if (hash === storedHash) {
      setAuthenticated(remember, remember ? expiryDays : undefined);
      navigate('/admin');
    } else {
      alert('Contraseña incorrecta');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">{mode === 'setup' ? 'Configurar cuenta Admin' : 'Ingresar Admin'}</h2>
        <form onSubmit={mode === 'setup' ? handleSetup : handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm text-slate-700">Usuario</label>
            <input value={username} onChange={e=>setUsername(e.target.value)} className="mt-1 w-full rounded-md border-gray-200 p-2" />
          </div>
          <div>
            <label className="block text-sm text-slate-700">Contraseña</label>
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)} className="mt-1 w-full rounded-md border-gray-200 p-2" />
          </div>
          {mode === 'setup' && (
            <div>
              <label className="block text-sm text-slate-700">Confirmar contraseña</label>
              <input type="password" value={password2} onChange={e=>setPassword2(e.target.value)} className="mt-1 w-full rounded-md border-gray-200 p-2" />
            </div>
          )}
          <div className="flex items-center gap-3">
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)} />
              <span className="text-sm text-slate-600">Recordarme</span>
            </label>
            {remember && (
              <label className="text-sm text-slate-600">Expira en
                <input type="number" min={1} value={expiryDays} onChange={e=>setExpiryDays(Number(e.target.value))} className="ml-2 w-16 rounded-md border-gray-200 p-1" />
                días
              </label>
            )}
          </div>

          <div className="flex items-center justify-between">
            <button type="submit" className="px-4 py-2 bg-teal-600 text-white rounded-md">{mode === 'setup' ? 'Crear cuenta' : 'Entrar'}</button>
            {mode === 'login' && (
              <button type="button" onClick={()=>{ localStorage.removeItem(ADMIN_USER_KEY); localStorage.removeItem(ADMIN_HASH_KEY); setMode('setup'); alert('Cuenta borrada, configura una nueva.'); }} className="text-sm text-slate-500">Borrar cuenta</button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdminLogin;
