import React, { useState, useEffect } from 'react';
import { Product } from '../types';

interface AdminProductFormProps {
  initial?: Partial<Product>;
  onSave: (product: Product) => void;
}

const AdminProductForm: React.FC<AdminProductFormProps> = ({ initial = {}, onSave }) => {
  const safeInitial: Partial<Product> = initial || {};
  const [name, setName] = useState(safeInitial.name || '');
  const [price, setPrice] = useState(safeInitial.price || 0);
  const [category, setCategory] = useState(safeInitial.category || '');
  const [technology, setTechnology] = useState<Product['technology']>(safeInitial.technology || undefined);
  const [description, setDescription] = useState(safeInitial.description || '');
  const [width, setWidth] = useState(safeInitial.dimensions?.width || 0);
  const [height, setHeight] = useState(safeInitial.dimensions?.height || 0);
  const [length, setLength] = useState(safeInitial.dimensions?.length || 0);
  const [weight, setWeight] = useState(safeInitial.weight || 0);
  const [error, setError] = useState('');
  // Estado para tipo de venta y lógica de precio
  const [saleType, setSaleType] = useState<'unidad' | 'pack' | 'mayorista'>(safeInitial.saleType || 'unidad');
  const [unitsPerPack, setUnitsPerPack] = useState(safeInitial.packUnits || 1);
  const [wholesaleUnits, setWholesaleUnits] = useState(safeInitial.wholesaleUnits || 20);
  const [wholesaleDiscount, setWholesaleDiscount] = useState(safeInitial.wholesaleDiscount || 0);
  const [wholesaleImage, setWholesaleImage] = useState<string | null>(null);
  const [wholesaleDescription, setWholesaleDescription] = useState('');

  // Precios automáticos
  const [finalPrice, setFinalPrice] = useState(safeInitial.price || 0);
  const packPrice = price * unitsPerPack;
  const wholesalePrice = Math.round(price * wholesaleUnits * (1 - wholesaleDiscount / 100));

  useEffect(() => {
    if (saleType === 'unidad') {
      setFinalPrice(price);
    } else if (saleType === 'pack') {
      setFinalPrice(packPrice);
    } else if (saleType === 'mayorista') {
      setFinalPrice(wholesalePrice);
    }
  }, [saleType, price, unitsPerPack, wholesaleUnits, wholesaleDiscount]);

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
    // Peso puede ser opcional para 3D si lo provee el slicer; si es Láser, recomendamos definir peso si se conoce
    if (technology === 'Láser' && weight <= 0) {
      // No bloquear, pero advertir
      console.warn('Peso no definido para Láser; se estimará en checkout');
    }

    const product: Product = {
      id: safeInitial.id || Date.now(),
      name,
      price: finalPrice,
      category,
      image: safeInitial.image || '',
      description,
      technology,
      dimensions: { width, height, length },
      weight: weight > 0 ? weight : undefined,
      saleType,
      packUnits: saleType === 'pack' ? unitsPerPack : undefined,
      wholesaleUnits: saleType === 'mayorista' ? wholesaleUnits : undefined,
      wholesaleDiscount: saleType === 'mayorista' ? wholesaleDiscount : undefined,
      wholesaleImage: saleType === 'mayorista' ? wholesaleImage : undefined,
      wholesaleDescription: saleType === 'mayorista' ? wholesaleDescription : undefined,
    } as Product;
    onSave(product);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="p-2 bg-red-50 text-red-700 rounded">{error}</div>}
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
        <label className="block text-sm font-medium text-gray-700 mb-1">Precio final</label>
        <div className="font-bold text-lg text-indigo-700">${finalPrice.toFixed(2)}</div>
      </div>
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
        <button type="submit" className="mt-2 bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700">Guardar Producto</button>
      </div>
    </form>
  );
};

export default AdminProductForm;
