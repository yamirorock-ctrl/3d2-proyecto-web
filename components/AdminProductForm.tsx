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

  // Estados para Recetas y Colores
  const [consumables, setConsumables] = useState<{material: string, quantity: number}[]>(initial.consumables || []);
  const [itemMaterial, setItemMaterial] = useState('');
  const [itemQuantity, setItemQuantity] = useState(1);

  const [colors, setColors] = useState<{color: string, percentage: number}[]>(initial.colorPercentage || []);
  const [newColorName, setNewColorName] = useState('');
  const [newColorPercent, setNewColorPercent] = useState(10);

  const [error, setError] = useState('');

  const addConsumable = () => {
    if (!itemMaterial) return;
    setConsumables([...consumables, { material: itemMaterial, quantity: itemQuantity }]);
    setItemMaterial('');
    setItemQuantity(1);
  };

  const removeConsumable = (idx: number) => {
    setConsumables(consumables.filter((_, i) => i !== idx));
  };

  const addColor = () => {
    if (!newColorName) return;
    setColors([...colors, { color: newColorName, percentage: newColorPercent }]);
    setNewColorName('');
    setNewColorPercent(10);
  };

  const removeColor = (idx: number) => {
    setColors(colors.filter((_, i) => i !== idx));
  };

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
      consumables,
      colorPercentage: colors,
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

      {/* SECCIÓN DE CONSUMIBLES (RECETA) */}
      <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
        <h4 className="text-sm font-bold text-slate-700 mb-2">Insumos / Consumibles (Receta)</h4>
        <p className="text-xs text-slate-500 mb-3">Define qué se gasta del inventario al vender este producto (ej: 1 Polímero, 1 Bombilla).</p>
        
        <div className="space-y-2 mb-3">
          {(consumables || []).map((c, idx) => (
             <div key={idx} className="flex justify-between items-center bg-white p-2 border rounded shadow-xs">
                <span className="text-sm font-medium text-slate-800">{c.quantity} x {c.material}</span>
                <button type="button" onClick={() => removeConsumable(idx)} className="text-red-500 hover:text-red-700 text-xs">Eliminar</button>
             </div>
          ))}
        </div>

        <div className="flex gap-2 items-end">
           <div className="flex-1">
             <label className="text-xs text-slate-500">Material</label>
             <select 
               className="w-full text-sm border rounded px-2 py-1.5"
               value={itemMaterial}
               onChange={e => setItemMaterial(e.target.value)}
             >
                <option value="">Seleccionar...</option>
                <option value="Polímero Mate">Polímero Mate</option>
                <option value="Bombillas">Bombillas</option>
                <option value="Vaso Aluminio 500cc">Vaso Aluminio 500cc</option>
                <option value="Vaso Aluminio 600cc">Vaso Aluminio 600cc</option>
                <option value="Vaso Aluminio 750cc">Vaso Aluminio 750cc</option>
                <option value="Vaso Aluminio 1L">Vaso Aluminio 1L</option>
                <option value="Caja">Caja</option>
                {/* Se podrían cargar dinámicamente, pero empezamos con los clave */}
             </select>
           </div>
           <div className="w-20">
             <label className="text-xs text-slate-500">Cant.</label>
             <input type="number" min="1" className="w-full text-sm border rounded px-2 py-1.5" value={itemQuantity} onChange={e => setItemQuantity(Number(e.target.value))} />
           </div>
           <button type="button" onClick={addConsumable} className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-sm rounded transition-colors">Agregar</button>
        </div>
      </div>

      {/* SECCIÓN DE COLORES Y PESO ESTIMADO */}
      <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
        <h4 className="text-sm font-bold text-slate-700 mb-2">Distribución de Colores (Estimación)</h4>
        <p className="text-xs text-slate-500 mb-3">Si el peso total es {weight > 0 ? `${weight}g` : 'X'}, ¿cómo se distribuye?</p>
        
        <div className="space-y-2 mb-3">
          {(colors || []).map((c, idx) => (
             <div key={idx} className="flex justify-between items-center bg-white p-2 border rounded shadow-xs">
                <span className="text-sm font-medium text-slate-800">{c.color} ({c.percentage}%)</span>
                <span className="text-xs text-slate-400">~{weight > 0 ? ((weight * c.percentage) / 100).toFixed(1) : '?'}g</span>
                <button type="button" onClick={() => removeColor(idx)} className="text-red-500 hover:text-red-700 text-xs">Eliminar</button>
             </div>
          ))}
        </div>

        <div className="flex gap-2 items-end">
           <div className="flex-1">
             <label className="text-xs text-slate-500">Color</label>
             <input type="text" placeholder="Ej: Blanco" className="w-full text-sm border rounded px-2 py-1.5" value={newColorName} onChange={e => setNewColorName(e.target.value)} />
           </div>
           <div className="w-20">
             <label className="text-xs text-slate-500">%</label>
             <input type="number" min="0" max="100" className="w-full text-sm border rounded px-2 py-1.5" value={newColorPercent} onChange={e => setNewColorPercent(Number(e.target.value))} />
           </div>
           <button type="button" onClick={addColor} className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-sm rounded transition-colors">Agregar</button>
        </div>
      </div>

      <div>
        <button type="submit" className="mt-2 bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700">Guardar Producto</button>
      </div>
    </form>
  );
};

export default AdminProductForm;
