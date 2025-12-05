import React, { useState } from 'react';
import { Product } from '../types';
import ProductAdmin from './ProductAdmin';
import { Trash2, Edit, Plus, X } from 'lucide-react';
import SmartImage from './SmartImage';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="absolute inset-0 bg-slate-900/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-[95vw] sm:max-w-2xl lg:max-w-4xl max-h-[90vh] overflow-y-auto p-4 sm:p-6 z-10">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
          <h3 className="text-base sm:text-lg font-bold">Panel Admin - Productos</h3>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button onClick={() => setIsCreateOpen(true)} className="flex-1 sm:flex-none px-3 py-2 bg-teal-600 text-white rounded-lg flex items-center justify-center gap-2 text-sm"><Plus size={14}/> Nuevo</button>
            <button onClick={onClose} className="p-2 text-slate-600 hover:bg-gray-100 rounded-full"><X size={16} /></button>
          </div>
        </div>

        <div className="space-y-4">
          {products.length === 0 && (
            <p className="text-slate-500 text-sm">No hay productos aún.</p>
          )}

          <div className="grid grid-cols-1 gap-3 sm:gap-4">
            {products.map(p => (
              <div key={p.id} className="border rounded-lg p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <SmartImage src={p.images?.[0]?.url ?? p.image} storageKey={p.images?.[0]?.storageKey} alt={p.name} className="h-16 w-16 flex-shrink-0 object-cover rounded-md" showError />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="font-bold text-sm sm:text-base truncate">{p.name}</div>
                      {p.featured && (
                        <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs font-medium rounded whitespace-nowrap">Destacado</span>
                      )}
                    </div>
                    <div className="text-xs sm:text-sm text-slate-500">{p.category} • ${p.price}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button onClick={() => setEditing(p)} className="flex-1 sm:flex-none px-3 py-1.5 rounded-md bg-indigo-50 hover:bg-indigo-100 text-indigo-700 flex items-center justify-center gap-1 text-xs sm:text-sm"><Edit size={14}/>Editar</button>
                  <button onClick={() => onDelete(p.id)} className="flex-1 sm:flex-none px-3 py-1.5 rounded-md bg-red-50 hover:bg-red-100 text-red-700 flex items-center justify-center gap-1 text-xs sm:text-sm"><Trash2 size={14}/>Eliminar</button>
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
