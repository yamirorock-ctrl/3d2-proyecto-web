import React, { useState, useEffect, useMemo } from 'react';
import { Product, ProductImage } from '../types';

interface Props {
  onClose: () => void;
  onSave: (p: Product) => void;
  product?: Product | null;
  nextId?: number;
  categories?: string[];
}

const ProductAdmin: React.FC<Props> = ({ onClose, onSave, product, nextId, categories = [] }) => {
  const [form, setForm] = useState<Product>(() => {
    const base: Product = {
      id: nextId ?? 0,
      name: '',
      price: 0,
      category: '',
      image: '',
      images: [],
      description: ''
    };
    if (product) {
      return {
        ...product,
        images: product.images && product.images.length > 0 ? product.images : (product.image ? [{ url: product.image }] : [])
      };
    }
    return base;
  });

  const [categoryMode, setCategoryMode] = useState<'select'|'other'>('select');
  const uniqueCats = useMemo(() => Array.from(new Set((categories || []).filter(Boolean))), [categories]);
  const [localCats, setLocalCats] = useState<string[]>(uniqueCats);
  const [previewSrc, setPreviewSrc] = useState<string>(product?.images?.[0]?.url ?? product?.image ?? '');
  const [newImgUrl, setNewImgUrl] = useState('');
  const [newImgColor, setNewImgColor] = useState('');

  // Sync incoming product
  useEffect(() => {
    if (product) {
      setForm({
        ...product,
        images: product.images && product.images.length > 0 ? product.images : (product.image ? [{ url: product.image }] : [])
      });
    }
  }, [product]);

  // Category mode + localCats sync
  useEffect(() => {
    setLocalCats(Array.from(new Set((categories || []).filter(Boolean))));
  }, [categories]);

  useEffect(() => {
    if (product && product.category) {
      if (uniqueCats.includes(product.category)) {
        setCategoryMode('select');
        setForm(prev => ({ ...prev, category: product.category }));
      } else {
        setCategoryMode('other');
        setForm(prev => ({ ...prev, category: product.category }));
      }
    } else {
      setCategoryMode(uniqueCats.length ? 'select' : 'other');
      setForm(prev => ({ ...prev, category: '' }));
    }
  }, [product, uniqueCats]);

  // Preview principal
  useEffect(() => {
    const primary = form.images && form.images.length > 0 ? form.images[0].url : form.image;
    setPreviewSrc(primary ?? '');
  }, [form.image, form.images]);

  const handleAddCategory = () => {
    const name = prompt('Nombre de la nueva categoría:');
    if (!name) return;
    const clean = name.trim();
    if (!clean) return alert('Nombre inválido');
    try {
      const raw = localStorage.getItem('categories');
      const arr = raw ? JSON.parse(raw) as string[] : [];
      if (!arr.includes(clean)) arr.push(clean);
      localStorage.setItem('categories', JSON.stringify(arr));
      setLocalCats(prev => Array.from(new Set([...prev, clean])));
      setCategoryMode('select');
      setForm(prev => ({ ...prev, category: clean }));
    } catch (e) { console.error(e); }
  };

  const handleRemoveCategory = (catToRemove?: string) => {
    const target = catToRemove ?? form.category;
    if (!target) return alert('No hay categoría seleccionada');
    if (!confirm(`Eliminar categoría "${target}" de la lista? Esto no modificará productos existentes.`)) return;
    try {
      const raw = localStorage.getItem('categories');
      const arr = raw ? JSON.parse(raw) as string[] : [];
      const next = arr.filter(c => c !== target);
      localStorage.setItem('categories', JSON.stringify(next));
      const newLocal = localCats.filter(c => c !== target);
      setLocalCats(newLocal);
      if (form.category === target) {
        setForm(prev => ({ ...prev, category: '' }));
        setCategoryMode(newLocal.length > 0 ? 'select' : 'other');
      }
      alert('Categoría eliminada.');
    } catch (e) { console.error(e); }
  };

  const options = Array.from(new Set([...localCats, form.category].filter(Boolean)));

  const handleChange = (k: keyof Product, v: any) => {
    setForm(prev => ({ ...prev, [k]: v }));
  };

  // Images helpers
  const handleFile = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setForm(prev => ({
        ...prev,
        images: [...(prev.images || []), { url: result, color: newImgColor || undefined }]
      }));
      setNewImgUrl('');
      setNewImgColor('');
    };
    reader.readAsDataURL(file);
  };

  const addImageByUrl = () => {
    const url = newImgUrl.trim();
    if (!url) {
      alert('Por favor ingresa una URL de imagen');
      return;
    }
    console.log('Agregando imagen:', { url, color: newImgColor });
    setForm(prev => ({
      ...prev,
      images: [...(prev.images || []), { url, color: newImgColor || undefined }]
    }));
    setNewImgUrl('');
    setNewImgColor('');
  };

  const removeImageAt = (idx: number) => {
    setForm(prev => ({
      ...prev,
      images: (prev.images || []).filter((_, i) => i !== idx)
    }));
  };

  const setPrimaryImage = (idx: number) => {
    setForm(prev => {
      const imgs = [...(prev.images || [])];
      if (idx < 0 || idx >= imgs.length) return prev;
      const [sel] = imgs.splice(idx, 1);
      imgs.unshift(sel);
      return { ...prev, images: imgs, image: imgs[0]?.url || prev.image };
    });
  };

  const updateImageColor = (idx: number, color: string) => {
    setForm(prev => {
      const imgs = [...(prev.images || [])];
      if (!imgs[idx]) return prev;
      imgs[idx] = { ...imgs[idx], color: color || undefined } as ProductImage;
      return { ...prev, images: imgs };
    });
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || form.name.trim().length === 0) {
      alert('El nombre es obligatorio');
      return;
    }
    if (!form.price || Number(form.price) <= 0) {
      alert('El precio debe ser mayor a 0');
      return;
    }
    const finalCategory = form.category;
    if (!finalCategory || finalCategory.trim().length === 0) {
      alert('La categoría es obligatoria');
      return;
    }
    form.category = finalCategory;
    if (form.images && form.images.length > 0) {
      form.image = form.images[0].url;
    }
    if (!form.id) form.id = nextId ?? Date.now();
    onSave(form);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <form onSubmit={submit} onMouseDown={(e)=>e.stopPropagation()} onTouchStart={(e)=>e.stopPropagation()} className="relative z-10 bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6">
        <div className="flex justify-between items-center mb-4 sticky top-0 bg-white pb-2 border-b">
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
            {localCats.length > 0 ? (
              <>
                <div className="flex gap-2 items-center">
                  <select id="product-category-select" value={form.category || '__none'} onChange={e => {
                    const v = e.target.value;
                    if (v === '__other') {
                      setCategoryMode('other');
                      setForm(prev => ({ ...prev, category: '' }));
                    } else if (v === '__none') {
                      setCategoryMode(localCats.length ? 'select' : 'other');
                      setForm(prev => ({ ...prev, category: '' }));
                    } else {
                      setCategoryMode('select');
                      setForm(prev => ({ ...prev, category: v }));
                    }
                  }} className="mt-1 block w-full rounded-md border-gray-200 p-2">
                    <option value="__none">-- Seleccionar categoría --</option>
                    {options.map(c => <option key={c} value={c}>{c}</option>)}
                    <option value="__other">Otra...</option>
                  </select>
                  <div className="flex gap-2">
                    <button type="button" onClick={handleAddCategory} className="ml-2 px-3 py-1 rounded-md bg-emerald-50 text-emerald-700 text-sm">Agregar</button>
                    <button type="button" onClick={()=>handleRemoveCategory()} className="ml-2 px-3 py-1 rounded-md bg-red-50 text-red-700 text-sm">Quitar</button>
                  </div>
                </div>
                {categoryMode === 'other' && (
                  <input id="product-category" name="category" autoComplete="off" value={form.category} onChange={e=>handleChange('category', e.target.value)} className="mt-2 block w-full rounded-md border-gray-200" placeholder="Nueva categoría" />
                )}
              </>
            ) : (
              <input id="product-category" name="category" autoComplete="off" value={form.category} onChange={e=>handleChange('category', e.target.value)} className="mt-1 block w-full rounded-md border-gray-200" />
            )}
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-2">Imágenes y Colores</label>
            <div className="mt-1 grid gap-2">
              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  placeholder="URL de imagen"
                  value={newImgUrl}
                  onChange={(e)=>setNewImgUrl(e.target.value)}
                  className="block w-full rounded-md border border-gray-300 px-3 py-2"
                />
                <input
                  type="text"
                  placeholder="Color (opcional)"
                  value={newImgColor}
                  onChange={(e)=>setNewImgColor(e.target.value)}
                  className="block w-40 rounded-md border border-gray-300 px-3 py-2"
                />
                <button type="button" onClick={addImageByUrl} className="px-4 py-2 rounded-md bg-indigo-600 text-white text-sm whitespace-nowrap hover:bg-indigo-700">Agregar</button>
              </div>
              <div className="text-xs text-slate-400">O sube una imagen desde tu equipo:</div>
              <input type="file" accept="image/*" onChange={e=>{ const f = e.target.files?.[0]; if(f) handleFile(f); }} className="block w-full text-sm text-slate-600" />

              {(form.images && form.images.length > 0) && (
                <div className="mt-3 space-y-2">
                  <div className="text-xs text-slate-500">Imágenes agregadas (haz clic en "Principal" para elegir la principal):</div>
                  {form.images.map((img, idx) => (
                    <div key={idx} className="flex items-center gap-3 border rounded-md p-2">
                      <img src={img.url} alt={`img-${idx}`} className="h-14 w-14 object-cover rounded" />
                      <div className="flex-1">
                        <div className="text-xs text-slate-500">Color:</div>
                        <input
                          type="text"
                          value={img.color || ''}
                          onChange={(e)=>updateImageColor(idx, e.target.value)}
                          className="mt-1 block w-48 rounded-md border border-gray-300 px-3 py-2"
                          placeholder="Ej: Rojo"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={()=>setPrimaryImage(idx)} className={`px-3 py-1 rounded-md text-sm ${idx===0 ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-slate-700'}`}>{idx===0 ? 'Principal' : 'Hacer principal'}</button>
                        <button type="button" onClick={()=>removeImageAt(idx)} className="px-3 py-1 rounded-md bg-red-50 text-red-700 text-sm">Quitar</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {previewSrc && (
                <div className="mt-3">
                  <div className="text-xs text-slate-500 mb-1">Previsualización (principal):</div>
                  <img src={previewSrc} alt="preview" className="h-28 rounded-md object-cover border" />
                </div>
              )}
            </div>
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
