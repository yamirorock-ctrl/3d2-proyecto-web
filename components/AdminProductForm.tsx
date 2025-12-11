import React, { useState } from 'react';
import { Product } from '../types';

interface AdminProductFormProps {
  initial?: Partial<Product>;
  onSave: (product: Product) => void;
}

const AdminProductForm: React.FC<AdminProductFormProps> = ({ initial = {} as Partial<Product>, onSave }) => {
  const [name, setName] = useState(initial.name || '');
  const [price, setPrice] = useState(initial.price || 0);
  const [category, setCategory] = useState(initial.category || '');
  // Explicitly cast or handle undefined for technology
  const [technology, setTechnology] = useState<Product['technology']>(initial.technology); 
  const [description, setDescription] = useState(initial.description || '');
  const [width, setWidth] = useState(initial.dimensions?.width || 0);
  const [height, setHeight] = useState(initial.dimensions?.height || 0);
  const [length, setLength] = useState(initial.dimensions?.length || 0);
  const [weight, setWeight] = useState(initial.weight || 0);

  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name || !price || !category || !technology || !description) {
      setError('Completá los campos básicos (nombre, precio, categoría, tecnología, descripción)');
      return;
    }
    if (width <= 0 || height <= 0 || length <= 0) {
      setError('Dimensiones obligatorias: ancho, alto y largo deben ser mayores a 0');
      return;
    }
    
    if (technology === 'Láser' && weight <= 0) {
      console.warn('Peso no definido para Láser; se estimará en checkout');
    }

    const product: Product = {
      id: initial.id || Date.now(),
      name,
      price,
      category,
      image: initial.image || '',
      images: initial.images,
      description,
      technology,
      dimensions: { width, height, length },
      weight: weight > 0 ? weight : undefined,
    } as Product;

    onSave(product);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="p-2 bg-red-50 text-red-700 rounded">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
          <input className="w-full border rounded px-3 py-2" value={name} onChange={e=>setName(e.target.value)} required />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Precio *</label>
          <input type="number" className="w-full border rounded px-3 py-2" value={price} onChange={e=>setPrice(Number(e.target.value))} required />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Categoría *</label>
          <input className="w-full border rounded px-3 py-2" value={category} onChange={e=>setCategory(e.target.value)} required />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tecnología *</label>
          <select className="w-full border rounded px-3 py-2" value={technology || ''} onChange={e=>setTechnology(e.target.value as Product['technology'])} required>
            <option value="">Seleccioná</option>
            <option value="3D">3D</option>
            <option value="Láser">Láser</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Descripción *</label>
        <textarea className="w-full border rounded px-3 py-2" rows={3} value={description} onChange={e=>setDescription(e.target.value)} required />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Dimensiones (cm) *</label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <span className="block text-xs text-gray-500 mb-1">Ancho</span>
            <input type="number" min={1} className="w-full border rounded px-3 py-2" value={width} onChange={e=>setWidth(Number(e.target.value))} required />
          </div>
          <div>
            <span className="block text-xs text-gray-500 mb-1">Alto</span>
            <input type="number" min={0.1} step={0.1} className="w-full border rounded px-3 py-2" value={height} onChange={e=>setHeight(Number(e.target.value))} required />
          </div>
          <div>
            <span className="block text-xs text-gray-500 mb-1">Largo</span>
            <input type="number" min={1} className="w-full border rounded px-3 py-2" value={length} onChange={e=>setLength(Number(e.target.value))} required />
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Peso (g)</label>
        <input type="number" min={0} className="w-full border rounded px-3 py-2" value={weight} onChange={e=>setWeight(Number(e.target.value))} placeholder="Opcional" />
      </div>

      <div>
        <button type="submit" className="mt-2 bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700">Guardar Producto</button>
      </div>
    </form>
  );
};

export default AdminProductForm;
