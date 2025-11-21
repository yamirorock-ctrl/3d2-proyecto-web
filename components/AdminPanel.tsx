import React, { useState } from 'react';
import { Product } from '../types';
import ProductAdmin from './ProductAdmin';
import { Trash2, Edit, Plus, X } from 'lucide-react';

interface AdminPanelProps {
  products: Product[];
  onClose: () => void;
  onAdd: (p: Product) => void;
  onEdit: (p: Product) => void;
  onDelete: (id: number) => void;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ products, onClose, onAdd, onEdit, onDelete }) => {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-slate-900/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-4xl p-6 z-10">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold">Panel Admin - Productos</h3>
          <div className="flex items-center gap-2">
            <button onClick={() => setIsCreateOpen(true)} className="px-3 py-2 bg-teal-600 text-white rounded-lg flex items-center gap-2"><Plus size={14}/> Nuevo</button>
            <button onClick={onClose} className="p-2 text-slate-600 hover:bg-gray-100 rounded-full"><X size={16} /></button>
          </div>
        </div>

        <div className="space-y-4">
          {products.length === 0 && (
            <p className="text-slate-500">No hay productos aún.</p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {products.map(p => (
              <div key={p.id} className="border rounded-lg p-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <img src={p.image} alt={p.name} className="h-16 w-16 object-cover rounded-md" />
                  <div>
                    <div className="font-bold">{p.name}</div>
                    <div className="text-sm text-slate-500">{p.category} • ${p.price}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setEditing(p)} className="px-3 py-1 rounded-md bg-indigo-50 hover:bg-indigo-100 text-indigo-700 flex items-center gap-2"><Edit size={14}/>Editar</button>
                  <button onClick={() => onDelete(p.id)} className="px-3 py-1 rounded-md bg-red-50 hover:bg-red-100 text-red-700 flex items-center gap-2"><Trash2 size={14}/>Eliminar</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Create modal */}
        {isCreateOpen && (
          <ProductAdmin onClose={() => setIsCreateOpen(false)} onSave={(prod)=>{ onAdd(prod); setIsCreateOpen(false); }} nextId={products.length+1} />
        )}

        {/* Edit modal */}
        {editing && (
          <ProductAdmin product={editing} onClose={() => setEditing(null)} onSave={(prod)=>{ onEdit(prod); setEditing(null); }} nextId={products.length+1} />
        )}
      </div>
    </div>
  );
};

export default AdminPanel;
