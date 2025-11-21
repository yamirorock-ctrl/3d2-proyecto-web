import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { hashPassword, getUserFailedAttempts, recordUserFailedAttempt, isUserLocked, resetUserFailedAttempts, setCurrentUser } from '../utils/auth';

const USERS_KEY = 'users';

function loadUsers() {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    return raw ? JSON.parse(raw) as {username:string, hash:string}[] : [];
  } catch (e) { return []; }
}

const UserLogin: React.FC<{ onLogin?: (username:string)=>void }> = ({ onLogin }) => {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setMessage(null);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (!username || !password) return setMessage('Usuario y contraseña requeridos');

    const users = loadUsers();
    const u = users.find(x => x.username === username);
    if (!u) return setMessage('Usuario no encontrado');

    const locked = isUserLocked(username);
    if (locked.locked) return setMessage('Cuenta bloqueada hasta ' + (locked.until ? new Date(locked.until).toLocaleString() : '...'));

    const hash = await hashPassword(password, username);
    if (hash === u.hash) {
      // success
      resetUserFailedAttempts(username);
      setCurrentUser(username, remember);
      if (onLogin) onLogin(username);
      navigate('/');
    } else {
      const res = recordUserFailedAttempt(username, 4, 30);
      if (res.locked) {
        setMessage('Demasiados intentos. Cuenta bloqueada hasta ' + (res.until ? new Date(res.until).toLocaleString() : '...'));
      } else {
        setMessage('Contraseña incorrecta. Intentos restantes: ' + (4 - res.attempts));
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">Ingresar</h2>
        {message && <div className="mb-4 text-sm text-red-600">{message}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-slate-700">Usuario</label>
            <input value={username} onChange={e=>setUsername(e.target.value)} className="mt-1 w-full rounded-md border-gray-200 p-2" />
          </div>
          <div>
            <label className="block text-sm text-slate-700">Contraseña</label>
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)} className="mt-1 w-full rounded-md border-gray-200 p-2" />
          </div>
          <div className="flex items-center gap-3">
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)} />
              <span className="text-sm text-slate-600">Recordarme</span>
            </label>
          </div>
          <div className="flex items-center justify-between">
            <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-md">Entrar</button>
            <button type="button" onClick={()=>navigate('/')} className="text-sm text-slate-500">Volver</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UserLogin;
