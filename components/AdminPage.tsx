import React, { useState, useEffect } from 'react';
import { Product } from '../types';
import ProductAdmin from './ProductAdmin';
import { Trash2, Edit, Plus, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { clearAuthenticated, resetUserFailedAttempts, isUserLocked } from '../utils/auth';

interface Props {
  products: Product[];
  onAdd: (p: Product) => void;
  onEdit: (p: Product) => void;
  onDelete: (id: number) => void;
}

const AdminPage: React.FC<Props> = ({ products, onAdd, onEdit, onDelete }) => {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [users, setUsers] = useState<{username:string}[]>([]);
  const [userLocks, setUserLocks] = useState<Record<string, {locked:boolean; until?:number}>>({});
  const navigate = useNavigate();

  const storedUser = localStorage.getItem('admin_user');

  const handleLogout = () => {
    clearAuthenticated();
    navigate('/admin/login');
  };

  useEffect(() => {
    // load registered users
    try {
      const raw = localStorage.getItem('users');
      const arr = raw ? JSON.parse(raw) as {username:string, hash:string}[] : [];
      setUsers(arr.map(u => ({ username: u.username })));
      const lockMap: Record<string, {locked:boolean; until?:number}> = {};
      arr.forEach(u => {
        lockMap[u.username] = isUserLocked(u.username);
      });
      setUserLocks(lockMap);
    } catch (e) {}
  }, []);

  const refreshUsers = () => {
    try {
      const raw = localStorage.getItem('users');
      const arr = raw ? JSON.parse(raw) as {username:string, hash:string}[] : [];
      setUsers(arr.map(u => ({ username: u.username })));
      const lockMap: Record<string, {locked:boolean; until?:number}> = {};
      arr.forEach(u => { lockMap[u.username] = isUserLocked(u.username); });
      setUserLocks(lockMap);
    } catch (e) {}
  };

  const handleDeleteUser = (username: string) => {
    if (!confirm(`Eliminar usuario ${username}? Esta acción no se puede revertir.`)) return;
    try {
      const raw = localStorage.getItem('users');
      const arr = raw ? JSON.parse(raw) as {username:string, hash:string}[] : [];
      const next = arr.filter(u => u.username !== username);
      localStorage.setItem('users', JSON.stringify(next));
      // clear any per-user locks
      resetUserFailedAttempts(username);
      refreshUsers();
    } catch (e) {}
  };

  const handleUnlockUser = (username: string) => {
    if (!confirm(`¿Desbloquear usuario ${username}?`)) return;
    try {
      resetUserFailedAttempts(username);
      refreshUsers();
      alert('Usuario desbloqueado.');
    } catch (e) {}
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 bg-gray-100 rounded-md"><ArrowLeft /></button>
          <h2 className="text-2xl font-bold">Panel Admin - Productos</h2>
          {storedUser && (
            <div className="ml-4 text-sm text-slate-500">Usuario: <span className="font-medium text-slate-700">{storedUser}</span></div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setIsCreateOpen(true)} className="px-4 py-2 bg-teal-600 text-white rounded-md flex items-center gap-2"><Plus />Nuevo</button>
          <button onClick={handleLogout} className="px-3 py-2 bg-white border border-gray-200 rounded-md text-sm text-slate-700">Cerrar sesión</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {products.map(p => (
          <div key={p.id} className="border rounded-lg p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <img src={p.image} alt={p.name} className="h-20 w-20 object-cover rounded-md" />
              <div>
                <div className="font-bold">{p.name}</div>
                <div className="text-sm text-slate-500">{p.category} • ${p.price}</div>
                <div className="text-sm text-slate-400 max-w-sm mt-2">{p.description}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setEditing(p)} className="px-3 py-1 rounded-md bg-indigo-50 text-indigo-700 flex items-center gap-2"><Edit size={14}/>Editar</button>
              <button onClick={() => onDelete(p.id)} className="px-3 py-1 rounded-md bg-red-50 text-red-700 flex items-center gap-2"><Trash2 size={14}/>Eliminar</button>
            </div>
          </div>
        ))}
      </div>

      {/* Users panel */}
      <div className="mt-8">
        <h3 className="text-xl font-bold mb-4">Usuarios Registrados</h3>
        {users.length === 0 ? (
          <div className="text-sm text-slate-500">No hay usuarios registrados.</div>
        ) : (
          <div className="space-y-2">
            {users.map(u => (
              <div key={u.username} className="flex items-center justify-between border rounded p-3">
                <div>
                  <div className="font-medium">{u.username}</div>
                  <div className="text-sm text-slate-500">{userLocks[u.username]?.locked ? `Bloqueado hasta ${userLocks[u.username].until ? new Date(userLocks[u.username].until).toLocaleString() : '...'}` : 'Activo'}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleUnlockUser(u.username)} className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-md">Desbloquear</button>
                  <button onClick={() => handleDeleteUser(u.username)} className="px-3 py-1 bg-red-50 text-red-700 rounded-md">Eliminar</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {(() => {
        try {
          const stored = localStorage.getItem('categories');
          const extra = stored ? JSON.parse(stored) as string[] : [];
          const categories = Array.from(new Set([...products.map(p => p.category).filter(Boolean), ...extra]));
          return (
            <>
              {isCreateOpen && (
                <ProductAdmin categories={categories} onClose={() => setIsCreateOpen(false)} onSave={(prod)=>{ onAdd(prod); setIsCreateOpen(false); }} nextId={products.length+1} />
              )}

              {editing && (
                <ProductAdmin categories={categories} product={editing} onClose={() => setEditing(null)} onSave={(prod)=>{ onEdit(prod); setEditing(null); }} nextId={products.length+1} />
              )}
            </>
          );
        } catch (e) {
          return null;
        }
      })()}
    </div>
  );
};

export default AdminPage;
