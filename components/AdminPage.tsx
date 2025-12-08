import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Product, Order } from '../types';
import { CustomOrder } from './CustomOrderForm';
import ProductAdmin from './ProductAdmin';
import { Trash2, Edit, Plus, ArrowLeft, Package, Users, Mail, Phone, Calendar, CheckCircle, Clock, ShoppingCart, TrendingUp, DollarSign, ShieldAlert, RefreshCw, ListChecks, ShoppingBag, Settings, LogOut, ChevronDown, Database, Upload, Download, Wrench } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { clearAuthenticated, resetUserFailedAttempts, isUserLocked } from '../utils/auth';
import { saveDataUrl, getBlob } from '../services/imageStore';
import SmartImage from './SmartImage';
import SalesDashboard from './SalesDashboard';
import PriceUpdateTool from './PriceUpdateTool';
import { getAuthUrl } from '../services/mlService';
import { validateSession, renewSession, deleteSession } from '../services/authService';

interface Props {
  products: Product[];
  onAdd: (p: Product) => void;
  onEdit: (p: Product) => void;
  onDelete: (id: number) => void;
}

const AdminPage: React.FC<Props> = ({ products, onAdd, onEdit, onDelete }) => {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [users, setUsers] = useState<{username:string}[]>([]);
  const [userLocks, setUserLocks] = useState<Record<string, {locked:boolean; until?:number}>>({});
  const [activeTab, setActiveTab] = useState<'products' | 'orders' | 'users' | 'sales' | 'security'>('products');
  const [attempts, setAttempts] = useState<{t:number; type:string}[]>([]);
  const [customOrders, setCustomOrders] = useState<CustomOrder[]>([]);
  const [salesOrders, setSalesOrders] = useState<Order[]>([]);
  const [isPriceToolOpen, setIsPriceToolOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const navigate = useNavigate();

  const storedUser = localStorage.getItem('admin_user');

  const handleLogout = async () => {
    // Eliminar sesión de Supabase si existe
    const sessionId = localStorage.getItem('admin_session_id');
    if (sessionId) {
      await deleteSession(sessionId);
      localStorage.removeItem('admin_session_id');
    }
    clearAuthenticated();
    navigate('/admin/login');
  };

  // Guard: validar sesión al montar
  useEffect(() => {
    const sessionId = localStorage.getItem('admin_session_id');
    if (sessionId) {
      validateSession(sessionId).then(({ valid, error }) => {
        if (!valid) {
          console.warn('[AdminPage] Sesión inválida o expirada:', error);
          toast.error('Tu sesión ha expirado o fue cerrada. Inicia sesión nuevamente.');
          clearAuthenticated();
          localStorage.removeItem('admin_session_id');
          navigate('/admin/login');
        }
      });
    }
  }, [navigate]);

  // Heartbeat: renovar sesión cada 60 segundos
  useEffect(() => {
    const sessionId = localStorage.getItem('admin_session_id');
    if (!sessionId) return;

    const interval = setInterval(async () => {
      const { success, error } = await renewSession(sessionId);
      if (!success) {
        console.warn('[AdminPage] Error renovando sesión:', error);
        clearInterval(interval);
        toast.error('Tu sesión ha expirado. Inicia sesión nuevamente.');
        clearAuthenticated();
        localStorage.removeItem('admin_session_id');
        navigate('/admin/login');
      } else {
        console.log('[AdminPage] Sesión renovada');
      }
    }, 60000); // 60 segundos

    return () => clearInterval(interval);
  }, [navigate]);

  useEffect(() => {
    // load registered users
    try {
      const raw = localStorage.getItem('users');
      const arr = raw ? JSON.parse(raw) as {username:string, hash:string}[] : [];
      setUsers(arr.map(u => ({ username: u.username })));
      const lockMap: Record<string, {locked:boolean; until?:number}> = {};
      arr.forEach(u => {
        lockMap[u.username] = isUserLocked(u.username);
      });
      setUserLocks(lockMap);
    } catch (e) {}

    // load custom orders
    try {
      const ordersRaw = localStorage.getItem('customOrders');
      const orders = ordersRaw ? JSON.parse(ordersRaw) as CustomOrder[] : [];
      setCustomOrders(orders);
    } catch (e) {}

    // load sales orders (fallback local)
    try {
      const salesRaw = localStorage.getItem('orders');
      const sales = salesRaw ? JSON.parse(salesRaw) as Order[] : [];
      setSalesOrders(sales);
    } catch (e) {}

    // fetch sales orders from Supabase
    (async () => {
      try {
        const { getAllOrders } = await import('../services/orderService');
        const orders = await getAllOrders();
        if (Array.isArray(orders) && orders.length >= 0) {
          setSalesOrders(orders);
          try { localStorage.setItem('orders', JSON.stringify(orders)); } catch {}
        }
      } catch (err) {
        console.warn('[AdminPage] No se pudieron cargar órdenes desde Supabase:', err);
      }
    })();

    // load security attempts
    try {
      const aRaw = localStorage.getItem('adminAccessAttempts');
      const arr = aRaw ? JSON.parse(aRaw) as {t:number; type:string}[] : [];
      setAttempts(arr.sort((a,b)=>b.t-a.t));
    } catch {}
  }, []);
  const refreshAttempts = () => {
    try {
      const aRaw = localStorage.getItem('adminAccessAttempts');
      const arr = aRaw ? JSON.parse(aRaw) as {t:number; type:string}[] : [];
      setAttempts(arr.sort((a,b)=>b.t-a.t));
    } catch {}
  };

  const clearAttempts = () => {
    if (!confirm('¿Borrar historial local de intentos no autorizados?')) return;
    try { localStorage.removeItem('adminAccessAttempts'); setAttempts([]); } catch {}
  };

  const refreshUsers = () => {
    try {
      const raw = localStorage.getItem('users');
      const arr = raw ? JSON.parse(raw) as {username:string, hash:string}[] : [];
      setUsers(arr.map(u => ({ username: u.username })));
      const lockMap: Record<string, {locked:boolean; until?:number}> = {};
      arr.forEach(u => { lockMap[u.username] = isUserLocked(u.username); });
      setUserLocks(lockMap);
    } catch (e) {}
  };

  const refreshSalesOrders = async () => {
    try {
      const { getAllOrders } = await import('../services/orderService');
      const orders = await getAllOrders();
      if (Array.isArray(orders) && orders.length >= 0) {
        setSalesOrders(orders);
        try { localStorage.setItem('orders', JSON.stringify(orders)); } catch {}
      }
    } catch (err) {
      console.warn('[AdminPage] No se pudieron cargar órdenes desde Supabase:', err);
    }
  };

  const handleDeleteUser = (username: string) => {
    if (!confirm(`Eliminar usuario ${username}? Esta acción no se puede revertir.`)) return;
    try {
      const raw = localStorage.getItem('users');
      const arr = raw ? JSON.parse(raw) as {username:string, hash:string}[] : [];
      const next = arr.filter(u => u.username !== username);
      localStorage.setItem('users', JSON.stringify(next));
      // clear any per-user locks
      resetUserFailedAttempts(username);
      refreshUsers();
    } catch (e) {}
  };

  const handleUnlockUser = (username: string) => {
    if (!confirm(`¿Desbloquear usuario ${username}?`)) return;
    try {
      resetUserFailedAttempts(username);
      refreshUsers();
      refreshUsers();
      toast.success('Usuario desbloqueado.');
    } catch (e) {}
  };

  const handleMigrateProducts = () => {
    if (!confirm('Esto migrará todos los productos existentes para limpiar las categorías y asignar la tecnología correctamente. ¿Continuar?')) return;

    const migratedProducts = products.map(p => {
      let category = p.category || '';
      // Conservar tecnología existente si ya está definida
      let technology: '3D' | 'Láser' = (p.technology as any) || '3D';

      const catLower = category.toLowerCase();
      const has3D = /\b3\s*d\b/i.test(category) || catLower.includes(' 3d') || catLower.startsWith('3d') || catLower.endsWith('3d');
      const hasLaser = /láser|laser/i.test(category);

      if (has3D) {
        technology = '3D';
        category = category.replace(/\s*3\s*d\s*/gi, '').trim();
      } else if (hasLaser) {
        technology = 'Láser';
        category = category.replace(/\s*(láser|laser)\s*/gi, '').trim();
      }

      return { ...p, category, technology };
    });

    // Guardar productos migrados
    localStorage.setItem('products', JSON.stringify(migratedProducts));

    // Actualizar categorías disponibles
    const cleanCategories = Array.from(new Set(migratedProducts.map(p => p.category).filter(Boolean)));
    localStorage.setItem('categories', JSON.stringify(cleanCategories));

    localStorage.setItem('categories', JSON.stringify(cleanCategories));

    toast.success(`Migración completada. ${migratedProducts.length} productos actualizados.`);
    // Actualizar productos en memoria usando onEdit para evitar recarga y 404 en GitHub Pages
    migratedProducts.forEach(mp => {
      try { onEdit(mp); } catch {}
    });
    // Opcional: podrías navegar a 'products' tab si no está
    setActiveTab('products');
    setShowSettings(false);
  };

  const handleUpdateOrderStatus = (orderId: number, newStatus: CustomOrder['status']) => {
    const updated = customOrders.map(o => o.id === orderId ? { ...o, status: newStatus } : o);
    setCustomOrders(updated);
    localStorage.setItem('customOrders', JSON.stringify(updated));
  };

  const handleDeleteOrder = (orderId: number) => {
    if (!confirm('¿Eliminar este pedido personalizado?')) return;
    const filtered = customOrders.filter(o => o.id !== orderId);
    setCustomOrders(filtered);
    localStorage.setItem('customOrders', JSON.stringify(filtered));
  };

  const handleUpdateSaleStatus = async (orderId: string, newStatus: Order['status']) => {
    // Actualizar en Supabase
    try {
      const { updateOrderStatus } = await import('../services/orderService');
      const success = await updateOrderStatus(orderId, newStatus);
      if (!success) {
        toast.error('Error al actualizar el estado en la base de datos');
        return;
      }
    } catch (error) {
      console.error('Error actualizando estado:', error);
      toast.error('Error al actualizar el estado');
      return;
    }

    // Actualizar en localStorage
    const updated = salesOrders.map(o => o.id === orderId ? { ...o, status: newStatus } : o);
    setSalesOrders(updated);
    localStorage.setItem('orders', JSON.stringify(updated));
  };

  const handleDeleteSale = async (orderId: string) => {
    if (!confirm('¿Eliminar esta orden de venta?')) return;
    
    // Eliminar de Supabase
    try {
      const { deleteOrder } = await import('../services/orderService');
      const success = await deleteOrder(orderId);
      if (!success) {
        toast.error('Error al eliminar la orden de la base de datos');
        return;
      }
    } catch (error) {
      console.error('Error eliminando orden:', error);
      toast.error('Error al eliminar la orden');
      return;
    }

    // Eliminar de localStorage
    const filtered = salesOrders.filter(o => o.id !== orderId);
    setSalesOrders(filtered);
    localStorage.setItem('orders', JSON.stringify(filtered));
  };

  const handleExportBackup = () => {
    try {
      const data = {
        products,
        categories: JSON.parse(localStorage.getItem('categories') || '[]'),
        orders: JSON.parse(localStorage.getItem('orders') || '[]'),
        customOrders: JSON.parse(localStorage.getItem('customOrders') || '[]'),
        timestamp: new Date().toISOString()
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup-3d2-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Backup exportado correctamente.');
      setShowSettings(false);
    } catch (e) {
      console.error(e);
      toast.error('No se pudo exportar el backup.');
    }
  };

  const handleImportBackup = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (!data || typeof data !== 'object') throw new Error('Formato inválido');
        
        // Normalizar products antes de guardar
        if (Array.isArray(data.products)) {
          const normalizedProducts = data.products.map((p: any) => {
            if (p.images && Array.isArray(p.images)) {
              p.images = p.images.map((img: any) => {
                if (typeof img === 'string') {
                  try {
                    return JSON.parse(img);
                  } catch {
                    return img;
                  }
                }
                return img;
              });
            }
            return p;
          });
          localStorage.setItem('products', JSON.stringify(normalizedProducts));
        }
        
        if (Array.isArray(data.categories)) localStorage.setItem('categories', JSON.stringify(data.categories));
        if (Array.isArray(data.orders)) localStorage.setItem('orders', JSON.stringify(data.orders));
        if (Array.isArray(data.customOrders)) localStorage.setItem('customOrders', JSON.stringify(data.customOrders));

        toast.success('Backup importado. Actualizando productos...');
        try {
          const importedProducts: Product[] = Array.isArray(data.products) ? data.products : [];
          // Editar existentes / agregar nuevos
          const existingIds = new Set(products.map(p=>p.id));
          importedProducts.forEach(p => {
            if (existingIds.has(p.id)) {
              try { onEdit(p); } catch {}
            } else {
              try { onAdd(p); } catch {}
            }
          });
        } catch (e) { console.warn('No se pudo fusionar productos en memoria', e); }
        setActiveTab('products');
        setShowSettings(false);
      } catch (e) {
        console.error(e);
        toast.error('No se pudo importar el backup.');
      }
    };
    input.click();
  };

  const handleMigrateImagesToIndexedDB = async () => {
    if (!confirm('Esto migrará imágenes embebidas (base64) o IndexedDB a Supabase Storage y actualizará los productos con la URL pública. ¿Continuar?')) return;
    try {
      const { uploadToSupabase, upsertProductToSupabase } = await import('../services/supabaseService');
      const migrated = await Promise.all(products.map(async (p) => {
        if (!p.images || p.images.length === 0) return p;
        
        // Normalizar images: si son strings JSON, parsearlos
        let normalizedImages = p.images.map(img => {
          if (typeof img === 'string') {
            try {
              return JSON.parse(img);
            } catch {
              return img;
            }
          }
          return img;
        });
        
        const nextImages = [] as NonNullable<typeof p.images>;
        for (const img of normalizedImages) {
          if (img.url && img.url.startsWith('data:image')) {
            try {
              // Convertir base64 a Blob
              const res = await fetch(img.url);
              const blob = await res.blob();
              // Subir a Supabase con nombre único
              const fileName = `product-${p.id}-${Date.now()}.webp`;
              const url = await uploadToSupabase(new File([blob], fileName, { type: blob.type }), 'product-images', fileName);
              nextImages.push({ url, color: img.color });
            } catch {
              nextImages.push(img);
            }
          } else if (img.storageKey) {
            try {
              const blob = await getBlob(img.storageKey);
              if (blob) {
                const fileName = `product-${p.id}-${Date.now()}.webp`;
                const url = await uploadToSupabase(new File([blob], fileName, { type: blob.type || 'image/webp' }), 'product-images', fileName);
                nextImages.push({ url, color: img.color });
              } else {
                nextImages.push(img);
              }
            } catch {
              nextImages.push(img);
            }
          } else {
            nextImages.push(img);
          }
        }
        const updated = { ...p, images: nextImages, image: nextImages[0]?.url || p.image };
        // Sincronizar producto en Supabase con UPSERT (actualiza si existe, inserta si no)
        try { 
          const result = await upsertProductToSupabase(updated);
          if (!result.success) {
            console.error(`Error al actualizar producto ${p.id}:`, result.error);
          }
        } catch (err) {
          console.error(`Error al actualizar producto ${p.id}:`, err);
        }
        return updated;
      }));
      localStorage.setItem('products', JSON.stringify(migrated));
      toast.success('Migración completada. Se actualizaron las imágenes a Supabase.');
      setShowSettings(false);
    } catch (e) {
      console.error(e);
      toast.error('Fallo la migración de imágenes a Supabase.');
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-3 sm:p-6" onClick={() => setShowSettings(false)}>
      <div className="flex flex-col sm:flex-row items-center justify-between mb-6 gap-3">
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><ArrowLeft size={20} /></button>
          <div className="flex flex-col">
            <h2 className="text-2xl font-bold bg-linear-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">Panel Admin</h2>
            {storedUser && <span className="text-xs text-slate-400">Logueado como {storedUser}</span>}
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto pb-0" onClick={(e) => e.stopPropagation()}>
          {activeTab === 'products' && (
            <>
              <button onClick={() => setIsCreateOpen(true)} className="whitespace-nowrap px-4 py-2 bg-indigo-600 text-white rounded-lg flex items-center gap-2 text-sm font-medium hover:bg-indigo-700 shadow-md transform hover:-translate-y-0.5 transition-all">
                <Plus size={16} /> Crear Producto
              </button>
            </>
          )}

          <div className="relative">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-slate-600 flex items-center gap-2 transition-colors relative"
            >
              <Settings size={20} />
              <ChevronDown size={14} className={`transition-transform duration-200 ${showSettings ? 'rotate-180' : ''}`} />
            </button>

            {showSettings && (
              <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl shadow-xl border border-gray-100 p-2 z-50 animate-in fade-in zoom-in-95 duration-200">
                <div className="text-xs font-semibold text-slate-400 px-3 py-2 uppercase tracking-wider">Herramientas</div>
                
                <button onClick={() => { setIsPriceToolOpen(true); setShowSettings(false); }} className="w-full text-left px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-gray-50 flex items-center gap-2">
                  <DollarSign size={16} className="text-green-600" /> Precios Masivos
                </button>
                
                <button onClick={handleMigrateProducts} className="w-full text-left px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-gray-50 flex items-center gap-2">
                  <Wrench size={16} className="text-orange-500" /> Corregir Datos (Migrar)
                </button>
                
                <div className="h-px bg-gray-100 my-1" />
                <div className="text-xs font-semibold text-slate-400 px-3 py-2 uppercase tracking-wider">Base de Datos</div>
                
                <button onClick={handleExportBackup} className="w-full text-left px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-gray-50 flex items-center gap-2">
                  <Download size={16} className="text-slate-500" /> Crear Backup Local
                </button>
                
                <button onClick={handleImportBackup} className="w-full text-left px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-gray-50 flex items-center gap-2">
                  <Upload size={16} className="text-slate-500" /> Restaurar Backup
                </button>
                
                <button onClick={async ()=>{ 
                  const bucket = 'product-images'; 
                  const { testSupabase } = await import('../services/supabaseService'); 
                  const res = await testSupabase(bucket); 
                  if(res.ok) toast.success(`Conexión OK: ${res.message}`); else toast.error(`Error conexión: ${res.message}`); 
                }} className="w-full text-left px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-gray-50 flex items-center gap-2">
                  <Database size={16} className="text-purple-600" /> Testear Supabase
                </button>
                
                <div className="h-px bg-gray-100 my-1" />
                <div className="text-xs font-semibold text-slate-400 px-3 py-2 uppercase tracking-wider">Integraciones</div>

                {(() => {
                  const url = getAuthUrl();
                  return (
                    <button
                      onClick={() => { if (url) window.location.href = url; else toast.error('Falta configuración de ML en .env'); }}
                      className="w-full text-left px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-gray-50 flex items-center gap-2"
                    >
                      <ShoppingBag size={16} className="text-yellow-500" /> Conectar MercadoLibre
                    </button>
                  );
                })()}

              </div>
            )}
          </div>

          <button onClick={handleLogout} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Cerrar Sesión">
            <LogOut size={20} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4 sm:mb-6 border-b overflow-x-auto pb-0">
        <button
          onClick={() => setActiveTab('products')}
          className={`px-3 sm:px-4 py-2 sm:py-3 font-medium flex items-center gap-1 sm:gap-2 border-b-2 transition-colors whitespace-nowrap text-sm sm:text-base ${
            activeTab === 'products' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Package size={18} className="sm:w-5 sm:h-5" />
          Productos ({products.length})
          {products.filter(p => p.stock !== undefined && p.stock < 5).length > 0 && (
            <span className="bg-orange-500 text-white text-xs px-2 py-0.5 rounded-full">
              {products.filter(p => p.stock !== undefined && p.stock < 5).length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('orders')}
          className={`px-4 py-3 font-medium flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'orders' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Mail size={20} />
          Pedidos Personalizados ({customOrders.length})
          {customOrders.filter(o => o.status === 'pendiente').length > 0 && (
            <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
              {customOrders.filter(o => o.status === 'pendiente').length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('sales')}
          className={`px-4 py-3 font-medium flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'sales' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <ShoppingCart size={20} />
          Ventas ({salesOrders.length})
          {salesOrders.filter(o => o.status === 'pendiente').length > 0 && (
            <span className="bg-yellow-500 text-white text-xs px-2 py-0.5 rounded-full">
              {salesOrders.filter(o => o.status === 'pendiente').length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`px-4 py-3 font-medium flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'users' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Users size={20} />
          Usuarios ({users.length})
        </button>
        <button
          onClick={() => setActiveTab('security')}
          className={`px-4 py-3 font-medium flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'security' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <ShieldAlert size={20} />
          Seguridad
          {attempts.length > 0 && (
            <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">{attempts.length}</span>
          )}
        </button>
      </div>

      {/* Products Tab */}
      {activeTab === 'products' && (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {products.map(p => (
          <div key={p.id} className="border rounded-lg p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <SmartImage src={p.images?.[0]?.url ?? p.image} storageKey={p.images?.[0]?.storageKey} alt={p.name} className="h-20 w-20 object-cover rounded-md" />
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="font-bold">{p.name}</div>
                  {p.stock !== undefined && (
                    <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                      p.stock === 0 ? 'bg-red-100 text-red-700' :
                      p.stock < 5 ? 'bg-yellow-100 text-yellow-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                      {p.stock === 0 ? 'Sin stock' : `Stock: ${p.stock}`}
                    </span>
                  )}
                </div>
                <div className="text-sm text-slate-500">
                  {p.category}
                  {p.technology ? ` • ${p.technology}` : ''}
                  {` • $${p.price}`}
                </div>
                <div className="text-sm text-slate-400 max-w-sm mt-2">{p.description}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setEditing(p)} className="px-3 py-1 rounded-md bg-indigo-50 text-indigo-700 flex items-center gap-2"><Edit size={14}/>Editar</button>
              <button onClick={() => onDelete(p.id)} className="px-3 py-1 rounded-md bg-red-50 text-red-700 flex items-center gap-2"><Trash2 size={14}/>Eliminar</button>
            </div>
          </div>
        ))}
      </div>
      )}

      {/* Custom Orders Tab */}
      {activeTab === 'orders' && (
        <div className="space-y-4">
          {customOrders.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Mail size={48} className="mx-auto mb-4 opacity-30" />
              <p>No hay pedidos personalizados aún</p>
            </div>
          ) : (
            customOrders.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).map(order => (
              <div key={order.id} className="border rounded-lg p-6 bg-white shadow-sm">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-bold text-lg">{order.name}</h3>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        order.status === 'pendiente' ? 'bg-yellow-100 text-yellow-800' :
                        order.status === 'contactado' ? 'bg-blue-100 text-blue-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {order.status === 'pendiente' ? <><Clock size={12} className="inline mr-1" />Pendiente</> :
                         order.status === 'contactado' ? 'Contactado' :
                         <><CheckCircle size={12} className="inline mr-1" />Completado</>}
                      </span>
                      <span className="px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-xs font-medium">
                        {order.technology}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm text-slate-600 mb-3">
                      <div className="flex items-center gap-2">
                        <Mail size={16} className="text-slate-400" />
                        <a href={`mailto:${order.email}`} className="hover:text-indigo-600">{order.email}</a>
                      </div>
                      {order.phone && (
                        <div className="flex items-center gap-2">
                          <Phone size={16} className="text-slate-400" />
                          <a href={`tel:${order.phone}`} className="hover:text-indigo-600">{order.phone}</a>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <Calendar size={16} className="text-slate-400" />
                        <span>{new Date(order.timestamp).toLocaleString('es-AR')}</span>
                      </div>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-4">
                      <p className="text-sm font-medium text-slate-700 mb-1">Descripción del proyecto:</p>
                      <p className="text-sm text-slate-600 whitespace-pre-wrap">{order.description}</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-4 border-t">
                  {order.status === 'pendiente' && (
                    <button
                      onClick={() => handleUpdateOrderStatus(order.id, 'contactado')}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
                    >
                      Marcar como Contactado
                    </button>
                  )}
                  {order.status === 'contactado' && (
                    <button
                      onClick={() => handleUpdateOrderStatus(order.id, 'completado')}
                      className="px-4 py-2 bg-green-600 text-white rounded-md text-sm hover:bg-green-700"
                    >
                      Marcar como Completado
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteOrder(order.id)}
                    className="px-4 py-2 bg-red-50 text-red-700 rounded-md text-sm hover:bg-red-100"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Sales Tab */}
      {activeTab === 'sales' && (
        <SalesDashboard 
          orders={salesOrders} 
          onUpdateStatus={handleUpdateSaleStatus}
          onDelete={handleDeleteSale}
          onRefresh={refreshSalesOrders}
        />
      )}

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div>
          {users.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Users size={48} className="mx-auto mb-4 opacity-30" />
              <p>No hay usuarios registrados</p>
            </div>
          ) : (
            <div className="space-y-2">
              {users.map(u => (
                <div key={u.username} className="flex items-center justify-between border rounded p-3">
                  <div>
                    <div className="font-medium">{u.username}</div>
                    <div className="text-sm text-slate-500">{userLocks[u.username]?.locked ? `Bloqueado hasta ${userLocks[u.username].until ? new Date(userLocks[u.username].until).toLocaleString() : '...'}` : 'Activo'}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => handleUnlockUser(u.username)} className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-md">Desbloquear</button>
                    <button onClick={() => handleDeleteUser(u.username)} className="px-3 py-1 bg-red-50 text-red-700 rounded-md">Eliminar</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Security Tab */}
      {activeTab === 'security' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold flex items-center gap-2"><ShieldAlert size={18}/>Intentos de Acceso No Autorizado</h3>
            <div className="flex gap-2">
              <button onClick={refreshAttempts} className="px-3 py-1 rounded-md bg-indigo-50 text-indigo-700 text-sm flex items-center gap-1"><RefreshCw size={14}/>Actualizar</button>
              <button onClick={clearAttempts} className="px-3 py-1 rounded-md bg-red-50 text-red-700 text-sm">Limpiar</button>
            </div>
          </div>
          {attempts.length === 0 ? (
            <div className="p-6 text-center border rounded-lg bg-white text-slate-500">
              <ListChecks size={42} className="mx-auto mb-3 opacity-30" />
              <p>Sin intentos registrados.</p>
              <p className="text-xs mt-2 text-slate-400">Se almacenan hasta 50 eventos locales.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {attempts.map((a,i)=>(
                <div key={i} className="flex items-center justify-between border rounded-md p-3 bg-white">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-red-600">{a.type === 'invalid_token' ? 'Token inválido/caducado' : a.type}</span>
                    <span className="text-xs text-slate-500">{new Date(a.t).toLocaleString('es-AR')}</span>
                  </div>
                  <span className="text-xs px-2 py-1 rounded bg-red-100 text-red-700">No autorizado</span>
                </div>
              ))}
            </div>
          )}
          <div className="text-xs text-slate-400 pt-2">
            Los intentos también se registran en Supabase bajo el usuario "UNAUTHORIZED" si el backend está activo.
          </div>
        </div>
      )}

      {(() => {
        try {
          const stored = localStorage.getItem('categories');
          const extra = stored ? JSON.parse(stored) as string[] : [];
          const categories = Array.from(new Set([...products.map(p => p.category).filter(Boolean), ...extra]));
          return (
            <>
              {isCreateOpen && (
                <ProductAdmin categories={categories} onClose={() => setIsCreateOpen(false)} onSave={(prod)=>{ onAdd(prod); setIsCreateOpen(false); }} nextId={products.length+1} />
              )}

              {editing && (
                <ProductAdmin categories={categories} product={editing} onClose={() => setEditing(null)} onSave={(prod)=>{ onEdit(prod); setEditing(null); }} nextId={products.length+1} />
              )}

              {isPriceToolOpen && (
                <PriceUpdateTool
                  products={products}
                  onUpdatePrices={(updated) => {
                    updated.forEach(p => onEdit(p));
                    setIsPriceToolOpen(false);
                  }}
                  onClose={() => setIsPriceToolOpen(false)}
                />
              )}
            </>
          );
        } catch (e) {
          return null;
        }
      })()}
    </div>
  );
};

export default AdminPage;
