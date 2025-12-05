import React, { useState, useEffect, useMemo } from 'react';
import { Product, ProductImage } from '../types';
import SmartImage from './SmartImage';
import { saveFile } from '../services/imageStore';
import { uploadToCloudinary } from '../services/cloudinary';
import { uploadToSupabase, upsertProductToSupabase } from '../services/supabaseService';
import { compressImage } from '../utils/imageCompression';
import { getBlob } from '../services/imageStore';

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
  const [previewSrc, setPreviewSrc] = useState<string>(product?.images?.[0]?.url ?? (product?.images?.[0]?.storageKey ? `lf:${product.images[0].storageKey}` : (product?.image ?? '')));
  const [newImgUrl, setNewImgUrl] = useState('');
  const [newImgColor, setNewImgColor] = useState('');
  const [newCategoryText, setNewCategoryText] = useState('');
  const [uploadTarget, setUploadTarget] = useState<'local' | 'cloudinary' | 'supabase'>(() => {
    const imgs = product?.images || [];
    if (imgs.some(i => i.url && i.url.includes('/storage/v1/object'))) return 'supabase';
    if (imgs.some(i => i.storageKey)) return 'local';
    return 'supabase';
  });
  const [supabaseBucket, setSupabaseBucket] = useState('product-images');
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressionEnabled, setCompressionEnabled] = useState(true);
  const [isMigratingProduct, setIsMigratingProduct] = useState(false);

  // Campos para packs y mayorista
  const [saleType, setSaleType] = useState<'unidad' | 'pack' | 'mayorista'>(form.saleType || 'unidad');
  const [unitsPerPack, setUnitsPerPack] = useState(form.unitsPerPack || 1);
  const [wholesaleUnits, setWholesaleUnits] = useState(form.wholesaleUnits || 20);
  const [wholesaleDiscount, setWholesaleDiscount] = useState(form.wholesaleDiscount || 20);
  const [wholesaleImage, setWholesaleImage] = useState(form.wholesaleImage || '');
  const [wholesaleDescription, setWholesaleDescription] = useState(form.wholesaleDescription || '');

  // Cálculo del precio final según el tipo de venta
  const finalPrice =
    saleType === 'unidad'
      ? form.price
      : saleType === 'pack'
      ? form.price * unitsPerPack
      : saleType === 'mayorista'
      ? Math.round(form.price * wholesaleUnits * (1 - wholesaleDiscount / 100))
      : form.price;

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
    const primary = primaryImg?.url ?? (primaryImg?.storageKey ? `lf:${primaryImg.storageKey}` : form.image);
    setPreviewSrc(primary ?? '');
  }, [form.image, form.images]);

  const handleAddCategory = () => {
    const name = (newCategoryText || form.category || '').trim();
    const clean = name;
    if (!clean) return alert('Nombre inválido');
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
        alert('La imagen aún supera 2MB después de la compresión. Usa una imagen más pequeña o una URL externa.');
        if (!opts?.batch) setIsCompressing(false);
        return;
      }

      // Nombre único: product-{id}-{timestamp}.webp
      let fileName = `product-${form.id}-${Date.now()}.webp`;

      if (uploadTarget === 'local') {
        const key = await saveFile(processedFile);
        setForm(prev => ({
          ...prev,
          images: [...(prev.images || []), { storageKey: key, color: (opts?.color ?? newImgColor) || undefined }]
        }));
      } else if (uploadTarget === 'cloudinary') {
        const url = await uploadToCloudinary(processedFile);
        setForm(prev => ({
          ...prev,
          images: [...(prev.images || []), { url, color: (opts?.color ?? newImgColor) || undefined }]
        }));
      } else {
        const envUrl = (import.meta as any).env?.VITE_SUPABASE_URL;
        const envKey = (import.meta as any).env?.VITE_SUPABASE_ANON;
        if (!envUrl || !envKey) {
          alert('Supabase no está configurado. Define VITE_SUPABASE_URL y VITE_SUPABASE_ANON en tu entorno antes de usar este destino.');
          if (!opts?.batch) setIsCompressing(false);
          return;
        }
        // Subir con nombre único
        const url = await uploadToSupabase(processedFile, supabaseBucket, fileName);
        setForm(prev => ({
          ...prev,
          images: [...(prev.images || []), { url, color: (opts?.color ?? newImgColor) || undefined }]
        }));
      }
      setNewImgUrl('');
      if (!opts?.batch) setNewImgColor('');
    } catch (e) {
      console.error(e);
      alert((e as Error).message || 'No se pudo guardar la imagen.');
    } finally {
      if (!opts?.batch) setIsCompressing(false);
    }
  };

  const handleFiles = async (files?: FileList | File[]) => {
    if (!files || (files as FileList).length === 0) return;
    const arr = Array.from(files as any);
    const savedColor = newImgColor;
    setIsCompressing(true);
    try {
      for (const f of arr) {
        // Procesar secuencialmente para evitar picos de memoria
        // Mantener mismo color para todo el lote
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
      alert('Por favor ingresa una URL de imagen');
      return;
    }
    const allowedExt = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
    const lower = url.toLowerCase();
    const hasExt = allowedExt.some(ext => lower.includes(ext));
    if (!hasExt) {
      const proceed = confirm('La URL no parece terminar en una extensión de imagen (.jpg/.png/.webp). ¿Deseas intentar de todos modos?');
      if (!proceed) return;
    }
    try {
      const res = await fetch(url, { method: 'HEAD' });
      const ct = res.headers.get('content-type') || '';
      if (!ct.includes('image/')) {
        alert('La URL no parece ser una imagen directa (content-type). Usa un enlace directo a .jpg/.png/.webp o sube el archivo.');
        return;
      }
    } catch (e) {
      console.warn('No se pudo verificar la URL (HEAD). Intentando agregar de todos modos.', e);
    }
    // Intento GET ligero opcional con abort para detectar accesibilidad sin bloquear por CORS
    try {
      const ac = new AbortController();
      const t = setTimeout(() => ac.abort(), 2500);
      await fetch(url, { method: 'GET', mode: 'cors', cache: 'no-store', signal: ac.signal });
      clearTimeout(t);
    } catch (e) {
      console.warn('GET de prueba falló (posible CORS/hotlink). Se agregará igual y SmartImage mostrará error si no carga.', e);
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
    // Sincronizar campos de tipo de venta
    // Mapear a snake_case para Supabase
    // Mapear y limpiar campos para Supabase
    const {
      saleType, unitsPerPack, wholesaleUnits, wholesaleDiscount, wholesaleImage, wholesaleDescription,
      ...restForm
    } = form;
    const updatedForm = {
      ...restForm,
      sale_type: saleType,
      units_per_pack: unitsPerPack,
      wholesale_units: wholesaleUnits,
      wholesale_discount: wholesaleDiscount,
      wholesale_image: wholesaleImage,
      wholesale_description: wholesaleDescription
    };
    updatedForm.technology = technology;
    if (updatedForm.images && updatedForm.images.length > 0) {
      updatedForm.image = updatedForm.images[0].url;
    }
    if (typeof updatedForm.featured !== 'boolean') updatedForm.featured = false;
    if (!updatedForm.id) updatedForm.id = nextId ?? Date.now();

    // Guardar en Supabase si el destino es supabase
    if (uploadTarget === 'supabase') {
      import('../services/supabaseService').then(({ upsertProductToSupabase }) => {
        upsertProductToSupabase(updatedForm).then(res => {
          if (res.success) {
            alert('Producto guardado en Supabase correctamente');
            onSave(updatedForm);
          } else {
            alert('Error al guardar en Supabase: ' + (res.error || ''));
          }
        });
      });
    } else {
      onSave(updatedForm);
    }
    // No recargar ni navegar, solo actualizar estado
  };

  // Migrar imágenes del producto actual a Supabase
  const migrateCurrentProductToSupabase = async () => {
    if (!form || !form.images || form.images.length === 0) {
      alert('Este producto no tiene imágenes para migrar.');
      return;
    }
    setIsMigratingProduct(true);
    try {
      const updatedImages: ProductImage[] = [];
      for (const img of form.images) {
        if (img.url && img.url.startsWith('data:image')) {
          try {
            const res = await fetch(img.url);
            const blob = await res.blob();
            const fileName = `product-${form.id}-${Date.now()}.webp`;
            const url = await uploadToSupabase(new File([blob], fileName, { type: blob.type || 'image/webp' }), supabaseBucket || 'product-images', fileName);
            updatedImages.push({ url, color: img.color });
          } catch {
            updatedImages.push(img);
          }
        } else if (img.storageKey) {
          try {
            const blob = await getBlob(img.storageKey);
            if (blob) {
              const fileName = `product-${form.id}-${Date.now()}.webp`;
              const url = await uploadToSupabase(new File([blob], fileName, { type: blob.type || 'image/webp' }), supabaseBucket || 'product-images', fileName);
              updatedImages.push({ url, color: img.color });
            } else {
              updatedImages.push(img);
            }
          } catch {
            updatedImages.push(img);
          }
        } else {
          updatedImages.push(img);
        }
      }
      const updatedProduct: Product = { ...form, images: updatedImages, image: updatedImages[0]?.url || form.image };
      const res = await upsertProductToSupabase(updatedProduct);
      if (!res.success) {
        alert('Imágenes migradas, pero falló guardar el producto en Supabase: ' + (res.error || ''));
      } else {
        alert('Producto migrado a Supabase correctamente');
      }
      setForm(updatedProduct);
    } catch (e) {
      console.error(e);
      alert('Error al migrar el producto a Supabase');
    } finally {
      setIsMigratingProduct(false);
    }
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
          {/* Selector de tipo de venta */}
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de venta *</label>
            <div className="flex gap-4">
              <label className="inline-flex items-center gap-2">
                <input type="radio" name="saleType" value="unidad" checked={saleType === 'unidad'} onChange={() => setSaleType('unidad')} /> Unidad
              </label>
              <label className="inline-flex items-center gap-2">
                <input type="radio" name="saleType" value="pack" checked={saleType === 'pack'} onChange={() => setSaleType('pack')} /> Pack
              </label>
              <label className="inline-flex items-center gap-2">
                <input type="radio" name="saleType" value="mayorista" checked={saleType === 'mayorista'} onChange={() => setSaleType('mayorista')} /> Mayorista
              </label>
            </div>
          </div>
          {/* Campos adicionales según tipo de venta */}
          {saleType === 'pack' && (
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Unidades por pack</label>
              <input type="number" min={1} className="w-full border rounded px-3 py-2" value={unitsPerPack} onChange={e => setUnitsPerPack(Number(e.target.value))} />
            </div>
          )}
          {saleType === 'mayorista' && (
            <div className="sm:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Unidades por venta mayorista</label>
                <input type="number" min={1} className="w-full border rounded px-3 py-2" value={wholesaleUnits} onChange={e => setWholesaleUnits(Number(e.target.value))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Descuento (%)</label>
                <input type="number" min={0} max={100} className="w-full border rounded px-3 py-2" value={wholesaleDiscount} onChange={e => setWholesaleDiscount(Number(e.target.value))} />
              </div>
            </div>
          )}
          {/* Muestra el precio final calculado */}
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">Precio final</label>
            <div className="font-bold text-lg text-indigo-700">${finalPrice.toFixed(2)}</div>
          </div>
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
                <label className="text-xs text-slate-600">Destino:</label>
                <select value={uploadTarget} onChange={(e)=>setUploadTarget(e.target.value as any)} className="text-sm border rounded px-2 py-1">
                  <option value="local">Local (IndexedDB)</option>
                  <option value="cloudinary">Cloudinary</option>
                  <option value="supabase">Supabase</option>
                </select>
                {uploadTarget === 'supabase' && (
                  <input type="text" value={supabaseBucket} onChange={(e)=>setSupabaseBucket(e.target.value)} className="text-sm border rounded px-2 py-1" placeholder="Bucket (ej: product-images)" />
                )}
              </div>
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
              <div className="bg-yellow-50 p-2 rounded text-xs text-yellow-800 mb-2">
                ⚠️ Recomendación: Usa URLs externas siempre que sea posible. Subir archivos llena la memoria del navegador muy rápido y puede borrar tus datos.
              </div>
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
                {uploadTarget === 'supabase' && (
                  <button type="button" onClick={migrateCurrentProductToSupabase} disabled={isMigratingProduct} className="px-3 py-2 rounded-md bg-purple-600 text-white text-xs whitespace-nowrap hover:bg-purple-700">
                    {isMigratingProduct ? 'Migrando…' : 'Migrar este producto a Supabase'}
                  </button>
                )}
              </div>
              {isCompressing && (
                <div className="bg-blue-50 p-2 rounded text-xs text-blue-700 flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Comprimiendo imagen a WebP...
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
            <p className="mt-1 text-xs text-slate-500">Si no se define, se estimará automáticamente según tecnología y dimensiones.</p>
          </div>

          {/* Nuevos campos para tipo de venta */}
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-2">Tipo de venta</label>
            <select className="w-full border rounded px-3 py-2" value={saleType} onChange={e => setSaleType(e.target.value as any)}>
              <option value="unidad">Por unidad</option>
              <option value="pack">Pack</option>
              <option value="mayorista">Mayorista</option>
            </select>
          </div>
          {saleType === 'pack' && (
            <div className="sm:col-span-2 grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Unidades por pack</label>
                <input type="number" min={1} className="w-full border rounded px-3 py-2" value={unitsPerPack} onChange={e => setUnitsPerPack(Number(e.target.value))} />
              </div>
            </div>
          )}
          {saleType === 'mayorista' && (
            <div className="sm:col-span-2 grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Unidades por pack mayorista</label>
                <input type="number" min={1} className="w-full border rounded px-3 py-2" value={wholesaleUnits} onChange={e => setWholesaleUnits(Number(e.target.value))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Descuento mayorista (%)</label>
                <input type="number" min={0} max={100} className="w-full border rounded px-3 py-2" value={wholesaleDiscount} onChange={e => setWholesaleDiscount(Number(e.target.value))} />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-2">Foto para mayorista</label>
                <input type="file" accept="image/*" onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = ev => setWholesaleImage(ev.target?.result as string);
                    reader.readAsDataURL(file);
                  } else {
                    setWholesaleImage('');
                  }
                }} />
                {wholesaleImage && <img src={wholesaleImage} alt="Foto mayorista" className="mt-2 w-24 h-24 object-cover rounded" />}
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-2">Descripción mayorista (opcional)</label>
                <textarea className="w-full border rounded px-3 py-2" rows={2} value={wholesaleDescription} onChange={e => setWholesaleDescription(e.target.value)} />
              </div>
            </div>
          )}
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
