import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { Product, ProductImage } from '../types';
import SmartImage from './SmartImage';
import { uploadToSupabase } from '../services/supabaseService';
import { syncProductToML } from '../services/mlService';
import { suggestMLTitle } from '../services/geminiService';
import { useAuth } from '../context/AuthContext';
import { Sparkles, Wand2 } from 'lucide-react';
// import { upsertProduct } from '../services/productService'; // Removed to avoid double save
import { compressImage } from '../utils/imageCompression';

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
      description: '',
      featured: false
    };
    if (product) {
      // Normalizar images: convertir strings JSON a objetos
      let normalizedImages = product.images && product.images.length > 0 
        ? product.images.map(img => {
            if (typeof img === 'string') {
              try {
                return JSON.parse(img);
              } catch {
                return img;
              }
            }
            return img;
          })
        : (product.image ? [{ url: product.image }] : []);
      
      return {
        ...product,
        images: normalizedImages
      };
    }
    return base;
  });

  const [categoryMode, setCategoryMode] = useState<'select'|'other'>('select');
  const [technology, setTechnology] = useState<'3D'|'Láser'>(() => (product?.technology ?? '3D'));
  const uniqueCats = useMemo(() => Array.from(new Set((categories || []).filter(Boolean))), [categories]);
  const [localCats, setLocalCats] = useState<string[]>(uniqueCats);
  const [previewSrc, setPreviewSrc] = useState<string>(product?.images?.[0]?.url ?? (product?.image ?? ''));
  const [newImgUrl, setNewImgUrl] = useState('');
  const [newImgColor, setNewImgColor] = useState('');
  const [newCategoryText, setNewCategoryText] = useState('');
  const [isCompressing, setIsCompressing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [mlMarkup, setMlMarkup] = useState<string>('25'); // Default 25%
  const [isGeneratingTitle, setIsGeneratingTitle] = useState(false);
  const { user } = useAuth();

  const [compressionEnabled, setCompressionEnabled] = useState(true);

  // Customization State
  const [availModels, setAvailModels] = useState<string[]>(() => product?.customizationOptions?.models || []);
  const [availColors, setAvailColors] = useState<string[]>(() => product?.customizationOptions?.colors || []);
  const [newModelInput, setNewModelInput] = useState('');
  const [newColorInput, setNewColorInput] = useState('');

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
    const primaryImg = form.images && form.images.length > 0 ? form.images[0] : undefined;
    const primary = primaryImg?.url ?? form.image;
    setPreviewSrc(primary ?? '');
  }, [form.image, form.images]);

  const handleAddCategory = () => {
    const name = (newCategoryText || form.category || '').trim();
    const clean = name;
    if (!clean) return toast.error('Nombre inválido');
    try {
      const raw = localStorage.getItem('categories');
      const arr = raw ? JSON.parse(raw) as string[] : [];
      if (!arr.includes(clean)) arr.push(clean);
      localStorage.setItem('categories', JSON.stringify(arr));
      setLocalCats(prev => Array.from(new Set([...prev, clean])));
      setCategoryMode('select');
      setForm(prev => ({ ...prev, category: clean }));
      setNewCategoryText('');
    } catch (e) { console.error(e); }
  };

  const handleRemoveCategory = (catToRemove?: string) => {
    const target = catToRemove ?? form.category;
    if (!target) return toast.error('No hay categoría seleccionada');
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
      toast.success('Categoría eliminada.');
    } catch (e) { console.error(e); }
  };

  const options = Array.from(new Set([...localCats, form.category].filter(Boolean)));

  const handleChange = (k: keyof Product, v: any) => {
    setForm(prev => ({ ...prev, [k]: v }));
  };

  // Images helpers
  const handleFile = async (file?: File, opts?: { color?: string; batch?: boolean }) => {
    if (!file) return;

    if (!opts?.batch) setIsCompressing(true);

    try {
      // Siempre comprimir a WebP
      let processedFile = file;
      if (compressionEnabled) {
        try {
          processedFile = await compressImage(file, {
            maxSizeMB: 0.5,
            maxWidthOrHeight: 1920,
            useWebWorker: true,
            fileType: 'image/webp',
            initialQuality: 0.8
          });
        } catch (compressionError) {
          console.warn('Error al comprimir imagen, usando original:', compressionError);
          processedFile = file;
        }
      }

      // Validar tamaño después de compresión
      if (processedFile.size > 2 * 1024 * 1024) {
        toast.error('La imagen aún supera 2MB después de la compresión. Usa una imagen más pequeña o una URL externa.');
        if (!opts?.batch) setIsCompressing(false);
        return;
      }

      // Nombre único: product-{id}-{timestamp}.webp
      let fileName = `product-${form.id}-${Date.now()}.webp`;

      // Subida forzada a SUPABASE
      const envUrl = (import.meta as any).env?.VITE_SUPABASE_URL;
      const envKey = (import.meta as any).env?.VITE_SUPABASE_ANON_TOKEN;
      if (!envUrl || !envKey) {
          toast.error('Supabase no está configurado. Define VITE_SUPABASE_URL y VITE_SUPABASE_ANON_TOKEN en tu entorno.');
          if (!opts?.batch) setIsCompressing(false);
          return;
      }
      
      const bucket = 'product-images';
      // Subir con nombre único
      const url = await uploadToSupabase(processedFile, bucket, fileName);
      setForm(prev => ({
          ...prev,
          images: [...(prev.images || []), { url, color: (opts?.color ?? newImgColor) || undefined }]
      }));
      
      setNewImgUrl('');
      if (!opts?.batch) setNewImgColor('');
    } catch (e) {
      console.error(e);
      toast.error((e as Error).message || 'No se pudo guardar la imagen en Supabase.');
    } finally {
      if (!opts?.batch) setIsCompressing(false);
    }
  };

  const handleFiles = async (files?: FileList | File[]) => {
    if (!files || (files as FileList).length === 0) return;
    const arr = Array.from(files) as File[];
    const savedColor = newImgColor;
    setIsCompressing(true);
    try {
      for (const f of arr) {
        // Procesar secuencialmente
        await handleFile(f, { color: savedColor, batch: true });
      }
    } finally {
      setIsCompressing(false);
      setNewImgColor('');
    }
  };

  const addImageByUrl = async () => {
    const url = newImgUrl.trim();
    if (!url) {
      toast.error('Por favor ingresa una URL de imagen');
      return;
    }
    const allowedExt = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
    const lower = url.toLowerCase();
    const hasExt = allowedExt.some(ext => lower.includes(ext));
    if (!hasExt) {
      const proceed = confirm('La URL no parece terminar en una extensión de imagen (.jpg/.png/.webp). ¿Deseas intentar de todos modos?');
      if (!proceed) return;
    }
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
      toast.error('El nombre es obligatorio');
      return;
    }
    if (!form.price || Number(form.price) <= 0) {
      toast.error('El precio debe ser mayor a 0');
      return;
    }
    const finalCategory = form.category;
    if (!finalCategory || finalCategory.trim().length === 0) {
      toast.error('La categoría es obligatoria');
      return;
    }
    form.technology = technology;
    if (form.images && form.images.length > 0) {
      form.image = form.images[0].url;
    }
    
    // Attach customization options
    form.customizationOptions = {
        models: availModels.length > 0 ? availModels : undefined,
        colors: availColors.length > 0 ? availColors : undefined
    };

    if (typeof form.featured !== 'boolean') form.featured = false;
    if (!form.id) form.id = nextId ?? Date.now();

    // Guardar SIEMPRE en Supabase (base de datos)
    // Validar ID (si es nuevo, el Context asignará uno definitivo, pero necesitamos uno temporal para la key si fuera local)
    // Sin embargo, para edición, el ID ya existe.
    if (!form.id) form.id = nextId ?? Date.now();

    // Solo llamar a onSave. La persistencia en Supabase la maneja el ProductContext (addProduct/editProduct)
    // para evitar duplicados y desincronización de IDs.
    onSave(form);
    toast.success('Producto guardado (o actualizado) correctamente');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <form onSubmit={submit} onMouseDown={(e)=>e.stopPropagation()} onTouchStart={(e)=>e.stopPropagation()} className="relative z-10 bg-white rounded-2xl shadow-xl w-full max-w-[95vw] sm:max-w-2xl lg:max-w-4xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <div className="flex justify-between items-center mb-4 sticky top-0 bg-white pb-2 border-b">
          <h3 className="text-base sm:text-lg font-bold">{product ? 'Editar Producto' : 'Nuevo Producto'}</h3>
          <button type="button" onClick={onClose} className="text-slate-500 text-sm sm:text-base">Cerrar</button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-2">Tecnología</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="technology" value="3D" checked={technology==='3D'} onChange={()=>{setTechnology('3D'); console.log('Tecnología cambiada a: 3D');}} className="text-indigo-600" />
                <span className="text-sm font-medium text-slate-700">Impresión 3D</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="technology" value="Láser" checked={technology==='Láser'} onChange={()=>{setTechnology('Láser'); console.log('Tecnología cambiada a: Láser');}} className="text-indigo-600" />
                <span className="text-sm font-medium text-slate-700">Corte Láser</span>
              </label>
            </div>
          </div>
          <div>
            <label htmlFor="product-name" className="block text-sm font-medium text-slate-700">Nombre</label>
            <input id="product-name" name="name" autoComplete="off" value={form.name} onChange={e=>handleChange('name', e.target.value)} className="mt-1 block w-full rounded-md border-gray-200" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Precio</label>
            <input id="product-price" name="price" type="number" value={form.price} onChange={e=>handleChange('price', Number(e.target.value))} className="mt-1 block w-full rounded-md border-gray-200" />
          </div>
          <div className="flex items-center gap-2">
            <input id="product-featured" type="checkbox" checked={!!form.featured} onChange={(e)=>handleChange('featured', e.target.checked)} />
            <label htmlFor="product-featured" className="text-sm font-medium text-slate-700">Marcar como Destacado</label>
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
                    <input type="text" placeholder="Nueva categoría" value={newCategoryText} onChange={(e)=>setNewCategoryText(e.target.value)} className="px-2 py-1 border rounded-md text-sm" />
                    <button type="button" onClick={handleAddCategory} className="px-3 py-1 rounded-md bg-emerald-50 text-emerald-700 text-sm">Agregar</button>
                    <button type="button" onClick={()=>handleRemoveCategory()} className="ml-2 px-3 py-1 rounded-md bg-red-50 text-red-700 text-sm">Quitar</button>
                  </div>
                </div>
                {categoryMode === 'other' && (
                  <input id="product-category" name="category" autoComplete="off" value={form.category} onChange={e=>handleChange('category', e.target.value)} className="mt-2 block w-full rounded-md border-gray-200" placeholder="Nueva categoría" />
                )}
              </>
            ) : (
              <div className="flex gap-2 items-center">
                <input id="product-category" name="category" autoComplete="off" value={form.category} onChange={e=>handleChange('category', e.target.value)} className="mt-1 block w-full rounded-md border-gray-200" placeholder="Ej: Hogar" />
                <input type="text" placeholder="Nueva categoría" value={newCategoryText} onChange={(e)=>setNewCategoryText(e.target.value)} className="px-2 py-1 border rounded-md text-sm" />
                <button type="button" onClick={handleAddCategory} className="px-3 py-1 rounded-md bg-emerald-50 text-emerald-700 text-sm">Agregar</button>
              </div>
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
              <div className="text-xs text-slate-400">O sube una imagen desde tu equipo (se guardará en Supabase):</div>
              
              <div className="flex gap-2 items-center">
                <input 
                  type="file" 
                  accept="image/*" 
                  multiple
                  onChange={e=>{ const files = e.target.files; if(files && files.length) handleFiles(files); }} 
                  className="block w-full text-sm text-slate-600"
                  disabled={isCompressing}
                />
                <label className="flex items-center gap-2 text-xs text-slate-600 whitespace-nowrap">
                  <input 
                    type="checkbox" 
                    checked={compressionEnabled} 
                    onChange={(e) => setCompressionEnabled(e.target.checked)}
                    className="rounded"
                  />
                  Comprimir WebP
                </label>
              </div>
              {isCompressing && (
                <div className="bg-blue-50 p-2 rounded text-xs text-blue-700 flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Comprimiendo imagen a WebP y subiendo a Supabase...
                </div>
              )}

              {(form.images && form.images.length > 0) && (
                <div className="mt-3 space-y-2">
                  <div className="text-xs text-slate-500">Imágenes agregadas (haz clic en "Principal" para elegir la principal):</div>
                  {form.images.map((img, idx) => (
                    <div key={idx} className="flex items-center gap-3 border rounded-md p-2">
                      <SmartImage src={img.url} storageKey={img.storageKey} alt={`img-${idx}`} className="h-14 w-14 object-cover rounded" showError />
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
                  <SmartImage src={previewSrc} alt="preview" className="h-28 rounded-md object-cover border" showError />
                </div>
              )}
            </div>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="product-description" className="block text-sm font-medium text-slate-700">Descripción</label>
            <textarea id="product-description" name="description" value={form.description} onChange={e=>handleChange('description', e.target.value)} className="mt-1 block w-full rounded-md border-gray-200" rows={4} />
          </div>

          <div>
            <label htmlFor="product-stock" className="block text-sm font-medium text-slate-700">
              Stock Disponible
            </label>
            <input 
              id="product-stock" 
              type="number" 
              min="0"
              value={form.stock ?? ''} 
              onChange={e => handleChange('stock', e.target.value ? parseInt(e.target.value) : undefined)}
              className="mt-1 block w-full rounded-md border-gray-200" 
              placeholder="Ej: 10"
            />
            <p className="mt-1 text-xs text-slate-500">
              Dejar vacío si no deseas controlar stock
            </p>
          </div>

          {/* Dimensiones y peso (debajo de stock) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">Ancho (cm) *</label>
              <input
                type="number"
                min={1}
                value={form.dimensions?.width ?? ''}
                onChange={e => handleChange('dimensions', { ...form.dimensions, width: e.target.value ? Number(e.target.value) : undefined })}
                className="mt-1 block w-full rounded-md border-gray-200"
                placeholder="Ej: 12"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Alto (cm) *</label>
              <input
                type="number"
                min={0.1}
                step={0.1}
                value={form.dimensions?.height ?? ''}
                onChange={e => handleChange('dimensions', { ...form.dimensions, height: e.target.value ? Number(e.target.value) : undefined })}
                className="mt-1 block w-full rounded-md border-gray-200"
                placeholder="Ej: 10"
              />
              {form.technology === 'Láser' && (
                <div className="mt-2">
                  <label className="block text-xs font-medium text-slate-600">Grosor (mm)</label>
                  <select
                    className="mt-1 block w-full rounded-md border-gray-200"
                    value={form.dimensions?.height ? Math.round((form.dimensions.height || 0) * 10) : ''}
                    onChange={e => {
                      const mm = Number(e.target.value) || 3;
                      const cm = mm / 10;
                      handleChange('dimensions', { ...form.dimensions, height: cm });
                    }}
                  >
                    <option value="">Seleccioná grosor</option>
                    <option value="3">3 mm</option>
                    <option value="5">5 mm</option>
                    <option value="6">6 mm</option>
                    <option value="9">9 mm</option>
                    <option value="15">15 mm (máximo)</option>
                  </select>
                  <p className="mt-1 text-xs text-slate-500">Para corte láser, el alto se toma como grosor.</p>
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Largo (cm) *</label>
              <input
                type="number"
                min={1}
                value={form.dimensions?.length ?? ''}
                onChange={e => handleChange('dimensions', { ...form.dimensions, length: e.target.value ? Number(e.target.value) : undefined })}
                className="mt-1 block w-full rounded-md border-gray-200"
                placeholder="Ej: 15"
              />
            </div>
          </div>

          <div className="mt-3">
            <label className="block text-sm font-medium text-slate-700">Peso (g)</label>
            <input
              type="number"
              min={0}
              value={form.weight ?? ''}
              onChange={e => handleChange('weight', e.target.value ? Number(e.target.value) : undefined)}
              className="mt-1 block w-full rounded-md border-gray-200"
              placeholder="Opcional. 3D: usar valor del slicer; Láser: se estima si falta"
            />
          </div>

          {/* Sección de Configuración de Venta Unitaria */}
          <div className="sm:col-span-2 border-t pt-4 mt-2">
             <h4 className="font-semibold text-slate-800 mb-2 flex items-center gap-2">
                <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-xs">Unidad</span>
                Configuración de Venta Unitaria
             </h4>
             <div className="flex flex-col sm:flex-row gap-4 items-start bg-slate-50 p-3 rounded-md">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={form.unitEnabled !== false} // Default to true if undefined
                    onChange={e => handleChange('unitEnabled', e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-sm font-medium text-slate-700">Habilitar Venta por Unidad</span>
                </label>
             </div>
          </div>

          {/* Sección de Configuración de Packs */}
          <div className="sm:col-span-2 border-t pt-4 mt-2">
            <h4 className="font-semibold text-slate-800 mb-2 flex items-center gap-2">
              <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded text-xs">Packs</span>
              Configuración de Venta por Pack
            </h4>
            <div className="flex flex-col sm:flex-row gap-4 items-start bg-slate-50 p-3 rounded-md">
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={!!form.packEnabled} 
                  onChange={e => handleChange('packEnabled', e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm font-medium text-slate-700">Habilitar Pack</span>
              </label>
              
              {form.packEnabled && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-slate-600">Unidades por Pack</label>
                    <input 
                      type="number" 
                      min={2}
                      value={form.unitsPerPack ?? ''}
                      onChange={e => handleChange('unitsPerPack', Number(e.target.value))}
                      className="mt-1 block w-24 rounded-md border-gray-200 text-sm"
                      placeholder="Ej: 3"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600">% Descuento Pack</label>
                    <input 
                      type="number" 
                      min={0} 
                      max={100}
                      value={form.packDiscount ?? ''}
                      onChange={e => handleChange('packDiscount', Number(e.target.value))}
                      className="mt-1 block w-24 rounded-md border-gray-200 text-sm"
                      placeholder="%"
                    />
                  </div>
                  <div className="text-xs text-slate-500 flex items-center mt-6">
                    {form.price && form.unitsPerPack && form.packDiscount ? (
                      <span>
                        Precio Pack: <b className="text-indigo-600">${Math.round((form.price * form.unitsPerPack) * (1 - (form.packDiscount/100)))}</b> 
                        <span className="ml-1 text-slate-400 line-through">${form.price * form.unitsPerPack}</span>
                      </span>
                    ) : ''}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Sección de Configuración Mayorista */}
          <div className="sm:col-span-2 border-t pt-4 mt-2">
            <h4 className="font-semibold text-slate-800 mb-2 flex items-center gap-2">
              <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-xs">Mayorista (Crudo)</span>
              Configuración de Venta Mayorista
            </h4>
            <div className="bg-amber-50/50 p-3 rounded-md border border-amber-100">
              <div className="flex flex-col sm:flex-row gap-4 items-start mb-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={!!form.mayoristaEnabled} 
                    onChange={e => handleChange('mayoristaEnabled', e.target.checked)}
                    className="rounded text-amber-600 focus:ring-amber-500"
                  />
                  <span className="text-sm font-medium text-slate-700">Habilitar Mayorista</span>
                </label>

                {form.mayoristaEnabled && (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-slate-600">% Descuento Crudo</label>
                      <input 
                        type="number" 
                        min={0} 
                        max={100}
                        value={form.wholesaleDiscount ?? ''}
                        onChange={e => handleChange('wholesaleDiscount', Number(e.target.value))}
                        className="mt-1 block w-24 rounded-md border-gray-200 text-sm"
                        placeholder="%"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600">Cant. Mínima</label>
                      <input 
                        type="number" 
                        min={1}
                        value={form.wholesaleUnits ?? ''}
                        onChange={e => handleChange('wholesaleUnits', Number(e.target.value))}
                        className="mt-1 block w-24 rounded-md border-gray-200 text-sm"
                        placeholder="Unidades"
                      />
                    </div>
                    <div className="text-xs text-slate-500 flex items-center mt-6">
                      {form.price && form.wholesaleDiscount ? (
                        <span>
                          {technology === '3D' ? 'Precio Final x Unidad:' : 'Precio Unidad Cruda:'} <b className="text-amber-600">${Math.round(form.price * (1 - (form.wholesaleDiscount/100)))}</b> 
                          <span className="ml-1 text-slate-400 line-through">${form.price}</span>
                        </span>
                      ) : ''}
                    </div>
                  </>
                )}
              </div>
              
              {form.mayoristaEnabled && (
                <div className="mt-2 text-sm">
                  <label className="block text-xs font-medium text-slate-600 mb-1">Imagen del Producto Crudo (Opcional)</label>
                  <div className="flex gap-3 items-center">
                    {form.wholesaleImage ? (
                      <div className="relative group">
                        <SmartImage src={form.wholesaleImage} className="h-16 w-16 object-cover rounded border" />
                        <button 
                          type="button" 
                          onClick={() => setForm(prev => ({ ...prev, wholesaleImage: undefined }))}
                          className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                    ) : (
                      <div className="h-16 w-16 border-2 border-dashed border-gray-300 rounded flex items-center justify-center text-gray-400 text-xs">
                        Sin foto
                      </div>
                    )}
                    <div className="flex-1">
                      <input
                        type="text"
                        placeholder="URL de imagen cruda..."
                        value={form.wholesaleImage || ''}
                        onChange={(e) => handleChange('wholesaleImage', e.target.value)}
                        className="block w-full rounded-md border-gray-200 text-sm mb-1"
                      />
                      <p className="text-xs text-slate-500">
                        O usa el cargador principal arriba y copia la URL generada aquí. 
                        (Pronto: cargador dedicado)
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
            </div>
          </div>

          {/* Sección de Personalización (Modelos y Colores) */}
          <div className="sm:col-span-2 border-t pt-4 mt-2">
             <h4 className="font-semibold text-slate-800 mb-2 flex items-center gap-2">
                <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-xs">Personalización</span>
                Opciones Disponibles
             </h4>
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-purple-50 p-3 rounded-md border border-purple-100">
                {/* Modelos */}
                <div>
                   <label className="block text-xs font-medium text-purple-800 mb-1">Modelos / Variantes</label>
                   <div className="flex gap-2 mb-2">
                      <input 
                        type="text" 
                        value={newModelInput}
                        onChange={e => setNewModelInput(e.target.value)}
                        className="flex-1 rounded-md border-purple-200 text-sm focus:border-purple-400 focus:ring-purple-400"
                        placeholder="Ej: Base redonda"
                        onKeyDown={e => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                if (newModelInput.trim()) {
                                    setAvailModels(p => [...p, newModelInput.trim()]);
                                    setNewModelInput('');
                                }
                            }
                        }}
                      />
                      <button 
                        type="button"
                        onClick={() => {
                            if (newModelInput.trim()) {
                                setAvailModels(p => [...p, newModelInput.trim()]);
                                setNewModelInput('');
                            }
                        }}
                        className="bg-purple-600 text-white px-3 text-sm rounded-md"
                      >
                        +
                      </button>
                   </div>
                   <div className="flex flex-wrap gap-1">
                      {availModels.map((m, i) => (
                          <span key={i} className="inline-flex items-center gap-1 bg-white border border-purple-200 text-purple-700 text-xs px-2 py-1 rounded-full">
                             {m}
                             <button type="button" onClick={() => setAvailModels(p => p.filter((_, idx) => idx !== i))} className="hover:text-red-500 font-bold">×</button>
                          </span>
                      ))}
                      {availModels.length === 0 && <span className="text-xs text-purple-400 italic">Sin modelos definidos</span>}
                   </div>
                </div>

                {/* Colores */}
                <div>
                   <label className="block text-xs font-medium text-purple-800 mb-1">Colores Disponibles</label>
                   <div className="flex gap-2 mb-2">
                      <input 
                        type="text" 
                        value={newColorInput}
                        onChange={e => setNewColorInput(e.target.value)}
                        className="flex-1 rounded-md border-purple-200 text-sm focus:border-purple-400 focus:ring-purple-400"
                        placeholder="Ej: Rojo Oscuro"
                        onKeyDown={e => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                if (newColorInput.trim()) {
                                    setAvailColors(p => [...p, newColorInput.trim()]);
                                    setNewColorInput('');
                                }
                            }
                        }}
                      />
                      <button 
                        type="button"
                        onClick={() => {
                            if (newColorInput.trim()) {
                                setAvailColors(p => [...p, newColorInput.trim()]);
                                setNewColorInput('');
                            }
                        }}
                        className="bg-purple-600 text-white px-3 text-sm rounded-md"
                      >
                        +
                      </button>
                   </div>
                   <div className="flex flex-wrap gap-1">
                      {availColors.map((c, i) => (
                          <span key={i} className="inline-flex items-center gap-1 bg-white border border-purple-200 text-purple-700 text-xs px-2 py-1 rounded-full">
                             {c}
                             <button type="button" onClick={() => setAvailColors(p => p.filter((_, idx) => idx !== i))} className="hover:text-red-500 font-bold">×</button>
                          </span>
                      ))}
                      {availColors.length === 0 && <span className="text-xs text-purple-400 italic">Sin colores definidos</span>}
                   </div>
                </div>
             </div>
          </div>



          {/* Sección MercadoLibre */}
          <div className="sm:col-span-2 border-t pt-4 mt-2">
            <h4 className="font-semibold text-slate-800 mb-2 flex items-center gap-2">
                <span className="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded text-xs">MercadoLibre</span>
                Optimización para Venta
            </h4>
            <div className="bg-yellow-50/50 p-3 rounded-md border border-yellow-100">
                <label className="block text-xs font-medium text-yellow-800 mb-1">Título para Publicación (SEO)</label>
                <div className="flex gap-2">
                    <div className="flex-1">
                        <input 
                            type="text" 
                            maxLength={60}
                            value={form.ml_title || ''}
                            onChange={e => handleChange('ml_title', e.target.value)}
                            className="block w-full rounded-md border-yellow-200 text-sm focus:border-yellow-400 focus:ring-yellow-400"
                            placeholder={form.name || "Ej: Cuadro Decorativo Gato 3D..."}
                        />
                        <div className="flex justify-between mt-1">
                            <p className="text-[10px] text-slate-500">
                                Si se deja vacío, se usará el nombre interno.
                            </p>
                            <p className={`text-[10px] ${(form.ml_title?.length || 0) > 60 ? 'text-red-500 font-bold' : 'text-slate-400'}`}>
                                {(form.ml_title?.length || 0)}/60
                            </p>
                        </div>
                    </div>
                    <button 
                        type="button"
                        onClick={async () => {
                            if (!form.name && !form.description) return toast.error('Ingresa al menos nombre o descripción');
                            setIsGeneratingTitle(true);
                            const imgUrl = form.images?.[0]?.url || form.image;
                            const suggestion = await suggestMLTitle(form.name, form.description, imgUrl);
                            setIsGeneratingTitle(false);
                            if (suggestion) {
                                handleChange('ml_title', suggestion);
                                toast.success('¡Título generado con IA!');
                            } else {
                                toast.error('No se pudo generar el título.');
                            }
                        }}
                        disabled={isGeneratingTitle}
                        className="px-3 py-1 bg-linear-to-r from-purple-600 to-indigo-600 text-white rounded-md text-xs font-bold shadow-sm hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 flex items-center gap-2 whitespace-nowrap h-fit self-start mt-0.5"
                    >
                        {isGeneratingTitle ? (
                            <Wand2 size={14} className="animate-spin" />
                        ) : (
                            <Sparkles size={14} />
                        )}
                        {isGeneratingTitle ? 'Generando...' : 'Sugerir con IA'}
                    </button>
                </div>
            </div>
          </div>
       <div className="mt-6 flex justify-end gap-3 items-center">
          {product && form.id && (
             <div className="flex items-center">
                 <button 
                    type="button" 
                    onClick={async () => {
                        if(!user?.id) return toast.error('No estás autenticado para esta acción');
                        if(!confirm(`¿Sincronizar este producto con MercadoLibre con un aumento del ${mlMarkup}%?`)) return;
                        setIsSyncing(true);
                        const markupValue = Number(mlMarkup) || 0;
                        const res = await syncProductToML(form.id, user.id, markupValue);
                        setIsSyncing(false);
                        if(res.ok) {
                            toast.success('¡Sincronización enviada con éxito!');
                            if (res.data.permalink) {
                                console.log('ML Link:', res.data.permalink);
                            }
                        } else {
                            console.error(res.data);
                            const errorMsg = res.data.mlError || res.data.error || 'Error desconocido';
                            const causeMsg = res.data.causes && res.data.causes.length > 0 ? `: ${res.data.causes[0].message}` : '';
                            const suggestion = res.data.suggestion ? `\nSugerencia: ${res.data.suggestion}` : '';
                            
                            // Si hay restricciones, mostrarlas
                            if (res.data.restrictions && res.data.restrictions.length > 0) {
                                const restText = res.data.restrictions.map((r: any) => `- ${r.message}`).join('\n');
                                toast.error(`Error ML: ${errorMsg}${causeMsg}${suggestion}\nRestricciones:\n${restText}`, { duration: 10000 });
                            } else {
                                toast.error(`Error ML: ${errorMsg}${causeMsg}${suggestion}`);
                            }
                        }
                    }}
                    disabled={isSyncing}
                    className="px-4 py-2 rounded-md bg-yellow-400 text-yellow-900 font-bold mr-auto flex items-center gap-2 hover:bg-yellow-300 transition-colors"
                 >
                    {isSyncing ? (
                        <>
                          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" className="opacity-25"></circle><path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" className="opacity-75"></path></svg>
                          Enviando...
                        </>
                    ) : (
                        <>
                           <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3.5 12C3.5 7.30558 7.30558 3.5 12 3.5C16.6944 3.5 20.5 7.30558 20.5 12C20.5 16.6944 16.6944 20.5 12 20.5C7.30558 20.5 3.5 16.6944 3.5 12Z" stroke="#713f12" strokeWidth="1.5"/><path d="M14.5 9L11 15L9 12" stroke="#713f12" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                           Publicar en MercadoLibre
                        </>
                    )}
                 </button>
                 <div className="flex flex-col ml-2">
                    <label className="text-[10px] text-slate-500 font-bold uppercase">Margen ML (%)</label>
                    <input 
                      type="number" 
                      value={mlMarkup} 
                      onChange={(e) => setMlMarkup(e.target.value)}
                      className="w-16 h-8 text-sm px-1 border border-yellow-400 rounded-md text-center focus:ring-yellow-500"
                    />
                 </div>
             </div>
          )}
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-md bg-gray-100 hover:bg-gray-200">Cancelar</button>
          <button type="submit" className="px-4 py-2 rounded-md bg-teal-600 text-white hover:bg-teal-700 shadow-md">Guardar</button>
       </div>
      </form>
    </div>
  );
};

export default ProductAdmin;
