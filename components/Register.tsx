import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { hashPassword } from '../utils/auth';

interface UserRecord {
  username: string;
  hash: string;
}

const USERS_KEY = 'users';

function loadUsers(): UserRecord[] {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as UserRecord[];
  } catch (e) {
    return [];
  }
}

function saveUsers(users: UserRecord[]) {
  try {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  } catch (e) {}
}

const Register: React.FC = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (!username || !password) return setMessage('Usuario y contraseña son requeridos');
    if (password !== password2) return setMessage('Las contraseñas no coinciden');

    const users = loadUsers();
    if (users.find(u => u.username === username)) {
      return setMessage('El usuario ya existe. Por favor elige otro nombre.');
    }

    const hash = await hashPassword(password, username);
    users.push({ username, hash });
    saveUsers(users);
    setMessage('Registro exitoso. Ya puedes iniciar sesión (si la aplicación lo soporta).');
    setTimeout(() => navigate('/'), 1200);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">Registro de usuario</h2>
        {message && <div className="mb-4 text-sm text-slate-700">{message}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-slate-700">Usuario</label>
            <input value={username} onChange={e=>setUsername(e.target.value)} className="mt-1 w-full rounded-md border-gray-200 p-2" />
          </div>
          <div>
            <label className="block text-sm text-slate-700">Contraseña</label>
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)} className="mt-1 w-full rounded-md border-gray-200 p-2" />
          </div>
          <div>
            <label className="block text-sm text-slate-700">Confirmar contraseña</label>
            <input type="password" value={password2} onChange={e=>setPassword2(e.target.value)} className="mt-1 w-full rounded-md border-gray-200 p-2" />
          </div>

          <div className="flex items-center justify-between">
            <button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded-md">Registrarme</button>
            <button type="button" onClick={()=>navigate('/')} className="text-sm text-slate-500">Volver</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Register;
