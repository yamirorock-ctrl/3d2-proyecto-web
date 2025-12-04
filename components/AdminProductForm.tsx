import React, { useState } from 'react';
import { Product } from '../types';

interface AdminProductFormProps {
  initial?: Partial<Product>;
  onSave: (product: Product) => void;
}

const AdminProductForm: React.FC<AdminProductFormProps> = ({ initial = {}, onSave }) => {
  const [name, setName] = useState(initial.name || '');
  const [price, setPrice] = useState(initial.price || 0);
  const [category, setCategory] = useState(initial.category || '');
  const [technology, setTechnology] = useState<Product['technology']>(initial.technology || undefined);
  const [description, setDescription] = useState(initial.description || '');
  const [width, setWidth] = useState(initial.dimensions?.width || 0);
  const [height, setHeight] = useState(initial.dimensions?.height || 0);
  const [length, setLength] = useState(initial.dimensions?.length || 0);
  const [weight, setWeight] = useState(initial.weight || 0);
  const [unitsPerPack, setUnitsPerPack] = useState(1);
  const [saleType, setSaleType] = useState<'unidad' | 'pack' | 'mayorista'>('unidad');
  const [wholesaleUnits, setWholesaleUnits] = useState(20);
  const [wholesaleDiscount, setWholesaleDiscount] = useState(20); // porcentaje
  const [wholesaleImage, setWholesaleImage] = useState<string | null>(null);
  const [wholesaleDescription, setWholesaleDescription] = useState('');
  const minWeight = 100;
  const totalPackWeight = weight * unitsPerPack;
  const minUnitsSuggested = weight > 0 ? Math.ceil(minWeight / weight) : 1;

  // Precio automático para pack y mayorista
  const packPrice = price * unitsPerPack;
  const wholesalePrice = Math.round(price * wholesaleUnits * (1 - wholesaleDiscount / 100));

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
    // No bloquear por peso, solo sugerir
    const product: Product = {
      id: (initial as Partial<Product>).id || Date.now(),
      name,
      price,
      category,
      image: (initial as Partial<Product>).image || '',
      description,
      technology,
      dimensions: { width, height, length },
      weight: weight > 0 ? weight : undefined,
      unitsPerPack,
      // ...otros campos de venta según tipo
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
        <input type="number" min={0} className="w-full border rounded px-3 py-2" value={weight} onChange={e=>setWeight(Number(e.target.value))} placeholder="Opcional (3D: usar el slicer; Láser: estimado si falta)" />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de venta *</label>
        <select className="w-full border rounded px-3 py-2" value={saleType} onChange={e => setSaleType(e.target.value as any)}>
          <option value="unidad">Por unidad</option>
          <option value="pack">Pack</option>
          <option value="mayorista">Mayorista</option>
        </select>
      </div>
      {saleType === 'pack' && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Unidades por pack *</label>
            <input type="number" min={1} className="w-full border rounded px-3 py-2" value={unitsPerPack} onChange={e=>setUnitsPerPack(Number(e.target.value))} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Precio del pack</label>
            <input type="number" className="w-full border rounded px-3 py-2 bg-gray-100" value={packPrice} readOnly />
          </div>
        </div>
      )}
      {saleType === 'mayorista' && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Unidades por pack mayorista *</label>
            <input type="number" min={1} className="w-full border rounded px-3 py-2" value={wholesaleUnits} onChange={e=>setWholesaleUnits(Number(e.target.value))} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Descuento mayorista (%)</label>
            <input type="number" min={0} max={100} className="w-full border rounded px-3 py-2" value={wholesaleDiscount} onChange={e=>setWholesaleDiscount(Number(e.target.value))} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Precio final mayorista</label>
            <input type="number" className="w-full border rounded px-3 py-2 bg-gray-100" value={wholesalePrice} readOnly />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Foto para mayorista</label>
            <input type="file" accept="image/*" onChange={e => {
              const file = e.target.files?.[0];
              if (file) {
                const reader = new FileReader();
                reader.onload = ev => setWholesaleImage(ev.target?.result as string);
                reader.readAsDataURL(file);
              } else {
                setWholesaleImage(null);
              }
            }} />
            {wholesaleImage && <img src={wholesaleImage} alt="Foto mayorista" className="mt-2 w-24 h-24 object-cover rounded" />}
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">Descripción mayorista (opcional)</label>
            <textarea className="w-full border rounded px-3 py-2" rows={2} value={wholesaleDescription} onChange={e=>setWholesaleDescription(e.target.value)} />
          </div>
        </div>
      )}

      <div>
        <button type="submit" className="mt-2 bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700">Guardar Producto</button>
      </div>
    </form>
  );
};

export default AdminProductForm;
