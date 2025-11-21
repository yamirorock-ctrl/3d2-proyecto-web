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
  const [previewSrc, setPreviewSrc] = useState<string>(product?.image ?? '');

  useEffect(() => {
    if (product) setForm(product);
  }, [product]);

  useEffect(() => {
    setPreviewSrc(form.image ?? '');
  }, [form.image]);

  const handleChange = (k: keyof Product, v: any) => {
    setForm(prev => ({ ...prev, [k]: v }));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    // Basic validation
    if (!form.name || form.name.trim().length === 0) {
      alert('El nombre es obligatorio');
      return;
    }
    if (!form.price || Number(form.price) <= 0) {
      alert('El precio debe ser mayor a 0');
      return;
    }
    // Ensure id is set
    if (!form.id) form.id = nextId ?? Date.now();
    onSave(form);
  };

  const handleFile = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // set image as data URL
      setForm(prev => ({ ...prev, image: result }));
      setPreviewSrc(result);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <form onSubmit={submit} onMouseDown={(e)=>e.stopPropagation()} onTouchStart={(e)=>e.stopPropagation()} className="relative z-10 bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold">{product ? 'Editar Producto' : 'Nuevo Producto'}</h3>
          <button type="button" onClick={onClose} className="text-slate-500">Cerrar</button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="product-name" className="block text-sm font-medium text-slate-700">Nombre</label>
            <input id="product-name" name="name" autoComplete="off" value={form.name} onChange={e=>handleChange('name', e.target.value)} className="mt-1 block w-full rounded-md border-gray-200" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Precio</label>
            <input id="product-price" name="price" type="number" value={form.price} onChange={e=>handleChange('price', Number(e.target.value))} className="mt-1 block w-full rounded-md border-gray-200" />
          </div>
          <div>
            <label htmlFor="product-category" className="block text-sm font-medium text-slate-700">Categoría</label>
            <input id="product-category" name="category" autoComplete="off" value={form.category} onChange={e=>handleChange('category', e.target.value)} className="mt-1 block w-full rounded-md border-gray-200" />
          </div>
          <div>
            <label htmlFor="product-image" className="block text-sm font-medium text-slate-700">Imagen (URL)</label>
            <input id="product-image" name="image" autoComplete="off" value={form.image} onChange={e=>handleChange('image', e.target.value)} className="mt-1 block w-full rounded-md border-gray-200" />
            <p className="text-xs text-slate-400 mt-2">O sube una imagen desde tu equipo:</p>
            <input type="file" accept="image/*" onChange={e=>{ const f = e.target.files?.[0]; if(f) handleFile(f); }} className="mt-2 block w-full text-sm text-slate-600" />
            {previewSrc && (
              <div className="mt-3">
                <div className="text-xs text-slate-500 mb-1">Previsualización:</div>
                <img src={previewSrc} alt="preview" className="h-28 rounded-md object-cover border" />
              </div>
            )}
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="product-description" className="block text-sm font-medium text-slate-700">Descripción</label>
            <textarea id="product-description" name="description" value={form.description} onChange={e=>handleChange('description', e.target.value)} className="mt-1 block w-full rounded-md border-gray-200" rows={4} />
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
