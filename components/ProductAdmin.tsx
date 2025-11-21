import React, { useState, useEffect } from 'react';
import { Product } from '../types';

interface Props {
  onClose: () => void;
  onSave: (p: Product) => void;
  product?: Product | null;
  nextId?: number;
}

const ProductAdmin: React.FC<Props> = ({ onClose, onSave, product, nextId }) => {
  const [form, setForm] = useState<Product>(product ?? {
    id: nextId ?? 0,
    name: '',
    price: 0,
    category: '',
    image: '',
    description: ''
  });

  useEffect(() => {
    if (product) setForm(product);
  }, [product]);

  const handleChange = (k: keyof Product, v: any) => {
    setForm(prev => ({ ...prev, [k]: v }));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    // Ensure id is set
    if (!form.id) form.id = nextId ?? Date.now();
    onSave(form);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <form onSubmit={submit} className="relative z-10 bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold">{product ? 'Editar Producto' : 'Nuevo Producto'}</h3>
          <button type="button" onClick={onClose} className="text-slate-500">Cerrar</button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">Nombre</label>
            <input value={form.name} onChange={e=>handleChange('name', e.target.value)} className="mt-1 block w-full rounded-md border-gray-200" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Precio</label>
            <input type="number" value={form.price} onChange={e=>handleChange('price', Number(e.target.value))} className="mt-1 block w-full rounded-md border-gray-200" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Categoría</label>
            <input value={form.category} onChange={e=>handleChange('category', e.target.value)} className="mt-1 block w-full rounded-md border-gray-200" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Imagen (URL)</label>
            <input value={form.image} onChange={e=>handleChange('image', e.target.value)} className="mt-1 block w-full rounded-md border-gray-200" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-slate-700">Descripción</label>
            <textarea value={form.description} onChange={e=>handleChange('description', e.target.value)} className="mt-1 block w-full rounded-md border-gray-200" rows={4} />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-md bg-gray-100">Cancelar</button>
          <button type="submit" className="px-4 py-2 rounded-md bg-teal-600 text-white">Guardar</button>
        </div>
      </form>
    </div>
  );
};

export default ProductAdmin;
