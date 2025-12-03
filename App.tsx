import React, { useState, useEffect } from 'react';
import { Product, CartItem, ViewState, Order } from './types';
import Navbar from './components/Navbar';
import ProductCard from './components/ProductCard';
import CartDrawer from './components/CartDrawer';
import ChatAssistant from './components/ChatAssistant';
import MLCallback from './components/MLCallback';
import CheckoutModal from './components/CheckoutModal';
import Checkout from './components/Checkout';
import OrderSuccess from './components/OrderSuccess';
import OrderFailure from './components/OrderFailure';
import OrderTracking from './components/OrderTracking';
import OrdersManagement from './components/OrdersManagement';
import AdminPage from './components/AdminPage';
import AdminLogin from './components/AdminLogin';
import ResetAdmin from './components/ResetAdmin';
import Register from './components/Register';
import UserLogin from './components/UserLogin';
import CustomOrderForm, { CustomOrder } from './components/CustomOrderForm';
import { getCurrentUser, clearCurrentUser } from './utils/auth';
import AdminGuard from './components/AdminGuard';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { CheckCircle2, ArrowLeft, Mail, Phone } from 'lucide-react';
import { getAllProductsFromSupabase } from './services/supabaseService';

// 🔧 MODO MANTENIMIENTO - Cambiar a true para activar mantenimiento
const MAINTENANCE_MODE = false;

// Updated Product Data for 3D Printing and Laser Cutting
const DEFAULT_PRODUCTS: Product[] = [
  {
    id: 1,
    name: "Dinosaurio Articulado T-Rex",
    price: 15.00,
    category: "Juguetes 3D",
    image: "https://images.unsplash.com/photo-1603665230139-143054c5e8b9?auto=format&fit=crop&q=80&w=800", // Toy placeholder
    description: "Figura de acción articulada flexible, impresa en PLA biodegradable de alta calidad. Varios colores."
  },
  {
    id: 2,
    name: "Caja de Té Mandala",
    price: 28.50,
    category: "Corte Láser",
    image: "https://images.unsplash.com/photo-1516916759473-600c07bc99d7?auto=format&fit=crop&q=80&w=800", // Box placeholder
    description: "Caja organizadora de madera MDF con diseño calado de mandala. 4 divisiones."
  },
  {
    id: 3,
    name: "Lámpara Luna Litofanía",
    price: 35.00,
    category: "Hogar 3D",
    image: "https://images.unsplash.com/photo-1540932296217-27953f393c72?auto=format&fit=crop&q=80&w=800", // Moon lamp placeholder
    description: "Esfera iluminada con textura realista de la luna. Incluye base de madera y luz LED."
  },
  {
    id: 4,
    name: "Llavero Personalizado Nombre",
    price: 5.99,
    category: "Personalizados",
    image: "https://images.unsplash.com/photo-1632167421267-43003e508546?auto=format&fit=crop&q=80&w=800", // Keychain placeholder
    description: "Llavero impreso en 3D en dos colores a elección. Ideal para souvenirs y regalos."
  },
  {
    id: 5,
    name: "Soporte Celular Geométrico",
    price: 12.00,
    category: "Accesorios",
    image: "https://images.unsplash.com/photo-1586775490184-b79136e26399?auto=format&fit=crop&q=80&w=800", // Phone stand placeholder
    description: "Diseño low-poly moderno, resistente y estilizado para tu escritorio."
  },
  {
    id: 6,
    name: "Topper para Torta 'Feliz Cumple'",
    price: 8.50,
    category: "Eventos",
    image: "https://images.unsplash.com/photo-1535141192574-5d4897c12636?auto=format&fit=crop&q=80&w=800", // Cake decoration placeholder
    description: "Adorno de torta en acrílico dorado o madera, corte láser de precisión."
  },
    {
    id: 7,
    name: "Maceta Baby Groot",
    price: 18.99,
    category: "Hogar 3D",
    image: "https://images.unsplash.com/photo-1520412092553-02dd1792080c?auto=format&fit=crop&q=80&w=800", // Pot placeholder
    description: "La maceta más tierna para tus suculentas. Impresión 3D detallada y pintada a mano."
  },
  {
    id: 8,
    name: "Rompecabezas 3D Madera",
    price: 32.00,
    category: "Juguetes Láser",
    image: "https://images.unsplash.com/photo-1603354350317-6f7aaa5911c5?auto=format&fit=crop&q=80&w=800", // Puzzle placeholder
    description: "Kit para armar vehículos o animales en madera. Diversión educativa sin pegamento."
  }
];

const App: React.FC = () => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [orders, setOrders] = useState<Order[]>(() => {
    try {
      const saved = localStorage.getItem('orders');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });
  const [products, setProducts] = useState<Product[]>(() => {
    try {
      const raw = localStorage.getItem('products');
      if (raw) return JSON.parse(raw) as Product[];
    } catch (e) {
      // ignore
    }
    return DEFAULT_PRODUCTS;
  });
  const navigate = useNavigate();
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [view, setView] = useState<ViewState>(ViewState.HOME);
  const [selectedCategory, setSelectedCategory] = useState<string>('Destacados');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [availableCategories, setAvailableCategories] = useState<string[]>(() => {
    try {
      const fromStorage = localStorage.getItem('categories');
      const extra = fromStorage ? JSON.parse(fromStorage) as string[] : [];
      const fromProducts = Array.from(new Set((JSON.parse(localStorage.getItem('products')||'[]') as Product[]).map(p=>p.category).filter(Boolean)));
      return Array.from(new Set([...fromProducts, ...extra]));
    } catch (e) {
      return [];
    }
  });
  const [currentUser, setCurrentUser] = useState<string | null>(() => getCurrentUser());
  const [customOrders, setCustomOrders] = useState<CustomOrder[]>(() => {
    try {
      const saved = localStorage.getItem('customOrders');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });
  const [cartNotice, setCartNotice] = useState<string | null>(null);

  // Load cart from local storage with sanitization to avoid phantom items
  useEffect(() => {
    const savedCart = localStorage.getItem('cart');
    if (savedCart) {
      try {
        const parsed: CartItem[] = JSON.parse(savedCart);
        // Remove invalid entries, zero/negative quantities, and deduplicate by id
        const seen = new Set<number>();
        const sanitized = parsed
          .filter(i => i && typeof i.id === 'number' && typeof i.quantity === 'number' && i.quantity > 0)
          .map(i => ({ ...i, quantity: Math.max(1, i.quantity) }))
          .filter(i => {
            if (seen.has(i.id)) return false;
            seen.add(i.id);
            return true;
          });
        setCart(sanitized);
        if (sanitized.length !== parsed.length) {
          // Persist sanitized cart to avoid reappearing items
          localStorage.setItem('cart', JSON.stringify(sanitized));
          setCartNotice('Ajustamos tu carrito para corregir items inválidos o duplicados.');
          setTimeout(() => setCartNotice(null), 5000);
        }
      } catch {
        // Corrupted cart; reset
        localStorage.removeItem('cart');
        setCart([]);
        setCartNotice('Se reinició el carrito por datos corruptos en el navegador.');
        setTimeout(() => setCartNotice(null), 5000);
      }
    }
  }, []);

  // When products load/update, enforce stock constraints on cart items to avoid stale phantom entries
  useEffect(() => {
    if (!products || products.length === 0) return;
    setCart(prev => {
      const productById = new Map(products.map(p => [p.id, p] as const));
      const next = prev.filter(item => productById.has(item.id)).map(item => {
        const p = productById.get(item.id)!;
        const maxQty = typeof p.stock === 'number' ? Math.max(1, p.stock) : item.quantity;
        return { ...item, quantity: Math.min(item.quantity, maxQty) };
      });
      if (next.length !== prev.length || next.some((n, i) => n.quantity !== prev[i]?.quantity)) {
        setCartNotice('Actualizamos tu carrito según disponibilidad y catálogo.');
        setTimeout(() => setCartNotice(null), 5000);
      }
      try { localStorage.setItem('cart', JSON.stringify(next)); } catch {}
      return next;
    });
  }, [products]);

  // Escuchar evento global para limpiar carrito (por ejemplo, desde OrderSuccess)
  useEffect(() => {
    const handler = () => {
      setCart([]);
      try { localStorage.removeItem('cart'); } catch {}
    };
    window.addEventListener('cart:clear', handler);
    return () => window.removeEventListener('cart:clear', handler);
  }, []);

  // Sincronizar productos desde Supabase (multi navegador) + Realtime
  useEffect(() => {
    const syncFromSupabase = async () => {
      try {
        const url = (import.meta as any).env?.VITE_SUPABASE_URL;
        const key = (import.meta as any).env?.VITE_SUPABASE_ANON;
        if (!url || !key) return; // Supabase no configurado
        
        const res = await getAllProductsFromSupabase();
        if (res.success && res.products) {
          if (res.products.length > 0) {
            // Normalizar images antes de usar
            const normalizedProducts = res.products.map(p => {
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
            
            console.log('[STATE] incoming normalizedProducts length=', normalizedProducts.length);
            // Evitar re-render si no cambian
            try {
              const current = JSON.stringify(products);
              const incoming = JSON.stringify(normalizedProducts);
              if (current !== incoming) {
                console.log('[STATE] setProducts triggered');
                setProducts(normalizedProducts);
              }
            } catch {
              console.log('[STATE] setProducts fallback triggered');
              setProducts(normalizedProducts);
            }
            // Recalcular categorías sólo desde remotos + existentes locales
            try {
              const remoteCats = Array.from(new Set(normalizedProducts.map(p => p.category).filter(Boolean)));
              const prevCatsRaw = localStorage.getItem('categories');
              const prevCats = prevCatsRaw ? JSON.parse(prevCatsRaw) as string[] : [];
              const merged = Array.from(new Set([...prevCats, ...remoteCats]));
              console.log('[STATE] incoming categories count=', merged.length);
              // Evitar re-render si no cambian
              try {
                const currentCats = JSON.stringify(availableCategories);
                const incomingCats = JSON.stringify(merged);
                if (currentCats !== incomingCats) {
                  console.log('[STATE] setAvailableCategories triggered');
                  setAvailableCategories(merged);
                }
              } catch {
                console.log('[STATE] setAvailableCategories fallback triggered');
                setAvailableCategories(merged);
              }
            } catch {}
          } else {
            // Tabla vacía: conservar locales (fallback)
            console.warn('Supabase sin productos, usando localStorage como fallback');
          }
        } else {
          console.warn('Fallo al obtener productos de Supabase, usando localStorage');
        }
      } catch (e) {
        console.warn('No se pudo sincronizar productos desde Supabase:', (e as Error).message);
      }
    };
    syncFromSupabase();

    // Realtime deshabilitado temporalmente para aislar error 301
  }, []); // FIX: Agregar dependencias vacías para ejecutar solo una vez

  // Exponer función manual de sincronización (puede ser llamada desde AdminPage vía evento global simple)
  (window as any).__forceSyncProducts = async () => {
    try {
      const url = (import.meta as any).env?.VITE_SUPABASE_URL;
      const key = (import.meta as any).env?.VITE_SUPABASE_ANON;
      if (!url || !key) { alert('Supabase no configurado'); return; }
      const res = await getAllProductsFromSupabase();
      if (res.success && res.products && res.products.length) {
        // Normalizar images antes de usar
        const normalizedProducts = res.products.map(p => {
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
        
        setProducts(normalizedProducts);
        try {
          const cats = Array.from(new Set(normalizedProducts.map(p => p.category).filter(Boolean)));
          setAvailableCategories(cats);
        } catch {}
        alert('Sincronización desde Supabase completada');
      } else {
        alert('No se obtuvieron productos remotos');
      }
    } catch (e) {
      alert('Error al sincronizar: ' + (e as Error).message);
    }
  };

  // Save cart to local storage
  useEffect(() => {
    try {
      localStorage.setItem('cart', JSON.stringify(cart));
    } catch (e) {
      if (e instanceof Error && e.name === 'QuotaExceededError') {
        console.warn('LocalStorage lleno, limpiando datos antiguos...');
        // Mantener solo los datos esenciales
        localStorage.removeItem('session');
        localStorage.removeItem('failedAttempts');
        try {
          localStorage.setItem('cart', JSON.stringify(cart));
        } catch (e2) {
          console.error('No se pudo guardar el carrito');
        }
      }
    }
  }, [cart]);

  // Save products to local storage
  useEffect(() => {
    try {
      localStorage.setItem('products', JSON.stringify(products));
    } catch (e) {
      if (e instanceof Error && e.name === 'QuotaExceededError') {
        console.warn('LocalStorage lleno al guardar productos');
        alert('¡Atención! La memoria del navegador está llena. No se pueden guardar más productos. Intenta borrar algunos o usar URLs para las imágenes.');
      }
    }
  }, [products]);
  // Save categories to local storage
  useEffect(() => {
    try {
      localStorage.setItem('categories', JSON.stringify(availableCategories));
    } catch (e) {
      console.warn('Error al guardar categorías:', e);
    }
  }, [availableCategories]);


  // Save custom orders to local storage
  useEffect(() => {
    try {
      localStorage.setItem('customOrders', JSON.stringify(customOrders));
    } catch (e) {
      if (e instanceof Error && e.name === 'QuotaExceededError') {
        console.warn('LocalStorage lleno al guardar pedidos personalizados');
      }
    }
  }, [customOrders]);

  // Save orders to local storage
  useEffect(() => {
    try {
      localStorage.setItem('orders', JSON.stringify(orders));
    } catch (e) {
      if (e instanceof Error && e.name === 'QuotaExceededError') {
        console.warn('LocalStorage lleno al guardar órdenes');
      }
    }
  }, [orders]);

  const handleAddToCart = (product: Product) => {
    // Validar stock antes de agregar
    if (product.stock === 0) {
      alert('Este producto está agotado');
      return;
    }

    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      
      if (existing) {
        // Verificar si hay stock suficiente para agregar más
        if (product.stock !== undefined && existing.quantity >= product.stock) {
          alert(`Solo hay ${product.stock} unidades disponibles de este producto`);
          return prev;
        }
        return prev.map(item => 
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      
      return [...prev, { ...product, quantity: 1 }];
    });
    setIsCartOpen(true);
  };

  const handleRemoveItem = (id: number) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const handleUpdateQuantity = (id: number, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQuantity = item.quantity + delta;
        
        // Validar stock si está definido
        if (item.stock !== undefined && newQuantity > item.stock) {
          alert(`Solo hay ${item.stock} unidades disponibles`);
          return item;
        }
        
        return { ...item, quantity: Math.max(1, newQuantity) };
      }
      return item;
    }));
  };

  const handleCheckout = () => {
    setIsCartOpen(false);
    setIsCheckoutOpen(true);
  };

  const handleConfirmOrder = (order: Order) => {
    // Descontar stock de los productos
    setProducts(prev => prev.map(product => {
      const orderItem = order.items.find(item => item.id === product.id);
      if (orderItem && product.stock !== undefined) {
        return {
          ...product,
          stock: Math.max(0, product.stock - orderItem.quantity)
        };
      }
      return product;
    }));

    setOrders(prev => [...prev, order]);
    setCart([]); // Clear cart after order
    console.log('Nueva orden confirmada:', order);
    console.log('Stock actualizado');
    // TODO: Enviar notificación por email al admin
  };

  // Product admin handlers
  const handleAddProduct = async (prod: Product) => {
    const nextId = products.length ? Math.max(...products.map(p => p.id)) + 1 : 1;
    const newProduct = { ...prod, id: nextId };
    setProducts(prev => [...prev, newProduct]);
    
    // Sincronizar con Supabase automáticamente
    try {
      const { upsertProductToSupabase } = await import('./services/supabaseService');
      await upsertProductToSupabase(newProduct);
      console.log('[Realtime] Producto agregado a Supabase');
    } catch (e) {
      console.warn('[Realtime] Error al agregar a Supabase:', (e as Error).message);
    }
  };

  const handleEditProduct = async (prod: Product) => {
    setProducts(prev => prev.map(p => p.id === prod.id ? prod : p));
    
    // Sincronizar con Supabase automáticamente
    try {
      const { upsertProductToSupabase } = await import('./services/supabaseService');
      await upsertProductToSupabase(prod);
      console.log('[Realtime] Producto editado en Supabase');
    } catch (e) {
      console.warn('[Realtime] Error al editar en Supabase:', (e as Error).message);
    }
  };

  const handleDeleteProduct = async (id: number) => {
    setProducts(prev => prev.filter(p => p.id !== id));
    
    // Sincronizar con Supabase automáticamente
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const url = (import.meta as any).env?.VITE_SUPABASE_URL;
      const key = (import.meta as any).env?.VITE_SUPABASE_ANON;
      if (url && key) {
        const supabase = createClient(url, key);
        await supabase.from('products').delete().eq('id', id);
        console.log('[Realtime] Producto eliminado de Supabase');
      }
    } catch (e) {
      console.warn('[Realtime] Error al eliminar de Supabase:', (e as Error).message);
    }
  };

  const handleCustomOrder = (order: CustomOrder) => {
    setCustomOrders(prev => [...prev, order]);
    console.log('Nuevo pedido personalizado:', order);
    // Aquí puedes agregar lógica adicional como enviar email
  };

  const renderContent = () => {
    if (view === ViewState.SUCCESS) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center animate-fade-in">
          <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6">
            <CheckCircle2 size={40} />
          </div>
          <h2 className="text-3xl font-bold text-slate-900 mb-2">¡Gracias por tu compra!</h2>
          <p className="text-slate-500 mb-8 max-w-md">
            Tu pedido ha sido procesado. Si compraste personalizados, te contactaremos pronto para los detalles.
          </p>
          <button 
            onClick={() => setView(ViewState.HOME)}
            className="px-8 py-3 bg-slate-900 text-white font-medium rounded-xl hover:bg-slate-800 transition-all shadow-lg"
          >
            Volver a la Tienda
          </button>
        </div>
      );
    }

    if (view === ViewState.CHECKOUT) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
          <div className="w-16 h-16 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin mb-6"></div>
          <h2 className="text-2xl font-bold text-slate-900">Preparando tu pedido...</h2>
          <p className="text-slate-500">Calibrando impresoras y ajustando láser.</p>
        </div>
      );
    }

    // HOME VIEW
    return (
      <>
        {/* Hero Section */}
        <div className="relative bg-slate-900 text-white py-24 px-4 sm:px-6 lg:px-8 rounded-3xl mb-12 overflow-hidden shadow-2xl mx-4 lg:mx-8 mt-6">
          <div className="absolute inset-0 z-0">
            <img 
              src="https://images.unsplash.com/photo-1513346940221-18f46db008d9?auto=format&fit=crop&q=80&w=1600" 
              alt="3D Printing Background" 
              className="w-full h-full object-cover opacity-20"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-900/90 to-transparent"></div>
          </div>
          
          {/* Animated 3D Logo Chip */}
          <div className="absolute right-8 top-1/2 -translate-y-1/2 z-10 hidden lg:block">
            <div className="relative w-64 h-64 animate-float">
              <div className="absolute inset-0 animate-spin-slow">
                <div className="w-full h-full rounded-3xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 shadow-2xl shadow-indigo-500/50 flex items-center justify-center transform perspective-1000 rotate-y-12 p-8">
                  <img 
                    src="/LOGO.jpg" 
                    alt="3D² Logo" 
                    className="w-full h-full object-contain drop-shadow-2xl"
                  />
                </div>
              </div>
              {/* Glow effect */}
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 blur-xl opacity-50 animate-pulse"></div>
            </div>
          </div>
          
          <div className="relative z-10 max-w-3xl">
            <span className="inline-block px-3 py-1 bg-indigo-600/30 border border-indigo-400/30 rounded-full text-indigo-200 text-sm font-bold mb-4 backdrop-blur-sm tracking-wide uppercase">
              Impresión 3D & Corte Láser
            </span>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-black leading-tight mb-6">
              Tus ideas,<br/>
              <span className="text-indigo-400">hechas realidad.</span>
            </h1>
            <p className="text-lg text-slate-300 mb-8 max-w-lg leading-relaxed">
              Desde juguetes articulados hasta decoración personalizada. 
              Creamos objetos únicos con tecnología 3D y precisión láser para ti.
            </p>
            <div className="flex flex-wrap gap-4">
              <button 
                onClick={() => setSelectedCategory('__all__')}
                className="px-8 py-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-900/20"
              >
                Ver Catálogo
              </button>
              <button 
                onClick={() => setSelectedCategory('Personalizados')}
                className="px-8 py-4 bg-white/5 backdrop-blur-md text-white border border-white/10 rounded-xl font-bold hover:bg-white/10 transition-all"
              >
                Pedido Personalizado
              </button>
            </div>
          </div>
        </div>

        {/* Product Grid */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
          <div className="flex flex-col sm:flex-row justify-between items-end mb-10 gap-4">
            <div>
              <h2 className="text-3xl font-bold text-slate-900">Regalería & Deco</h2>
              <p className="text-slate-500 mt-2 text-lg">Objetos únicos creados capa por capa.</p>
            </div>
            
            {/* Category Filter */}
            <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0 w-full sm:w-auto no-scrollbar">
              <button onClick={()=>setSelectedCategory('Destacados')} className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${selectedCategory==='Destacados'? 'bg-slate-900 text-white' : 'bg-white border border-gray-200 text-slate-600 hover:bg-gray-50'}`}>Destacados</button>
              <button onClick={()=>setSelectedCategory('__all__')} className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${selectedCategory==='__all__'? 'bg-slate-900 text-white' : 'bg-white border border-gray-200 text-slate-600 hover:bg-gray-50'}`}>Todo</button>
              {availableCategories.map(cat => (
                <button key={cat} onClick={()=>setSelectedCategory(cat)} className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${selectedCategory===cat? 'bg-slate-900 text-white' : 'bg-white border border-gray-200 text-slate-600 hover:bg-gray-50'}`}>{cat}</button>
              ))}
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {selectedCategory === 'Personalizados' ? (
              <div className="col-span-full">
                <CustomOrderForm onSubmit={handleCustomOrder} />
              </div>
            ) : (
              selectedCategory 
                ? products
                  .filter(p => {
                    // Si es filtro de tecnología (3D o Láser), usar campo technology
                    // Fallback: inferir desde la categoría para productos antiguos
                    if (selectedCategory === '3D') {
                      const inferred3D = (p.category || '').toUpperCase().includes('3D');
                      const match = p.technology === '3D' || (!p.technology && inferred3D);
                      console.log(`Producto: ${p.name} | Tecnología: ${p.technology} | Inferred3D: ${inferred3D} | Match 3D: ${match}`);
                      return match;
                    }
                    if (selectedCategory === 'Láser') {
                      const inferredLaser = (p.category || '').toLowerCase().includes('láser') || (p.category || '').toLowerCase().includes('laser');
                      const match = p.technology === 'Láser' || (!p.technology && inferredLaser);
                      console.log(`Producto: ${p.name} | Tecnología: ${p.technology} | InferredLaser: ${inferredLaser} | Match Láser: ${match}`);
                      return match;
                    }
                    if (selectedCategory === 'Destacados') {
                      return !!p.featured;
                    }
                    if (selectedCategory === '__all__') {
                      return true;
                    }
                    // Para categorías normales, filtro exacto por categoría
                    return p.category === selectedCategory;
                  })
                  .filter(p => {
                    if (!searchQuery.trim()) return true;
                    const q = searchQuery.toLowerCase();
                    return (
                      p.name.toLowerCase().includes(q) ||
                      (p.description || '').toLowerCase().includes(q) ||
                      (p.category || '').toLowerCase().includes(q)
                    );
                  })
                : products
                  .filter(p => !!p.featured)
                  .filter(p => {
                    if (!searchQuery.trim()) return true;
                    const q = searchQuery.toLowerCase();
                    return (
                      p.name.toLowerCase().includes(q) ||
                      (p.description || '').toLowerCase().includes(q) ||
                      (p.category || '').toLowerCase().includes(q)
                    );
                  })
            ).map(product => (
              <ProductCard 
                key={product.id} 
                product={product} 
                onAddToCart={handleAddToCart} 
              />
            ))}
          </div>
        </div>
      </>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      {/* MODO MANTENIMIENTO */}
      {MAINTENANCE_MODE && window.location.pathname !== '/admin/login' && window.location.pathname !== '/admin' ? (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
            <div className="mb-6">
              <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-4xl">🔧</span>
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">En Mantenimiento</h1>
              <p className="text-gray-600">
                Estamos mejorando nuestra tienda para ofrecerte una mejor experiencia.
              </p>
            </div>
            <div className="space-y-4 text-sm text-gray-700">
              <p>✨ Integrando nuevas funcionalidades</p>
              <p>📦 Mejorando sistema de envíos</p>
              <p>🔄 Volvemos pronto</p>
            </div>
            <div className="mt-8 pt-6 border-t border-gray-200">
              <p className="text-xs text-gray-500">
                ¿Eres administrador? 
                <a href="/admin/login" className="text-indigo-600 hover:text-indigo-700 ml-1 font-medium">
                  Acceder al panel
                </a>
              </p>
            </div>
          </div>
        </div>
      ) : (
        <>
      {cartNotice && (
        <div className="bg-yellow-100 text-yellow-800 text-xs sm:text-sm p-2 text-center">
          {cartNotice}
        </div>
      )}
      {(!(import.meta as any).env?.VITE_SUPABASE_URL || !(import.meta as any).env?.VITE_SUPABASE_ANON) && (
        <div className="bg-yellow-100 text-yellow-800 text-xs sm:text-sm p-2 text-center">
          Aviso: Supabase no está configurado en este build. Se usarán datos locales. Pulsa "Forzar Sync Supabase" en Admin si ya configuraste las variables y redeployaste.
        </div>
      )}
      <Navbar 
        cartCount={cart.reduce((acc, item) => acc + item.quantity, 0)} 
        onOpenCart={() => setIsCartOpen(true)}
        onGoHome={() => { setView(ViewState.HOME); navigate('/'); }}
        onOpenAdmin={() => navigate('/admin')}
        currentUser={currentUser}
        onLogoutUser={() => { clearCurrentUser(); setCurrentUser(null); }}
        onCategorySelect={(cat) => { setView(ViewState.HOME); navigate('/'); setSelectedCategory(cat); }}
        onSearch={(q) => { setSearchQuery(q); setView(ViewState.HOME); navigate('/'); }}
      />

      <main className="pt-4">
        <Routes>
          <Route index element={renderContent()} />
          <Route path="register" element={<Register />} />
          <Route path="login" element={<UserLogin onLogin={(u)=>setCurrentUser(u)} />} />
          <Route path="admin/login" element={<AdminLogin />} />
          <Route path="checkout" element={
            <Checkout 
              cart={cart} 
              onClearCart={() => setCart([])} 
            />
          } />
          <Route path="order-success" element={<OrderSuccess />} />
          <Route path="order-failure" element={<OrderFailure />} />
          <Route path="order-tracking" element={<OrderTracking />} />
          <Route path="ml-callback" element={<MLCallback />} />
          <Route path="reset-admin" element={<ResetAdmin onDone={() => navigate('/')} />} />
          <Route path="admin" element={
            <AdminGuard>
              <AdminPage 
                products={products}
                onAdd={handleAddProduct}
                onEdit={handleEditProduct}
                onDelete={handleDeleteProduct}
              />
            </AdminGuard>
          } />
          <Route path="admin/orders" element={
            <AdminGuard>
              <OrdersManagement />
            </AdminGuard>
          } />
        </Routes>
      </main>

      <CartDrawer 
        isOpen={isCartOpen} 
        onClose={() => setIsCartOpen(false)} 
        items={cart}
        onRemoveItem={handleRemoveItem}
        onUpdateQuantity={handleUpdateQuantity}
        onCheckout={handleCheckout}
      />

      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        items={cart}
        total={cart.reduce((sum, item) => sum + (item.price * item.quantity), 0)}
        onConfirmOrder={handleConfirmOrder}
      />

      <ChatAssistant products={products} />
      <MLCallback />
      
      
      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-12 mt-12">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            <div className="text-center md:text-left">
              <h3 className="font-black text-xl text-slate-900 mb-4">3D2</h3>
              <p className="text-slate-500 text-sm max-w-xs mx-auto md:mx-0 mb-6">
                Transformamos filamento y madera en tus ideas favoritas. Calidad y detalle en cada impresión.
              </p>
            </div>
            
            <div className="text-center">
              <h4 className="font-bold text-slate-900 mb-4">Enlaces Rápidos</h4>
              <ul className="space-y-2 text-sm text-slate-500">
                <li><a href="#" className="hover:text-indigo-600 transition-colors">Catálogo</a></li>
                <li>
                  <a 
                    href="https://www.instagram.com/3d2_creart/" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="hover:text-indigo-600 transition-colors"
                  >
                    Instagram
                  </a>
                </li>
                <li>
                  {(() => {
                    const num = (import.meta as any).env?.VITE_WHATSAPP_NUMBER || '1234567890';
                    const href = `https://wa.me/${num}`;
                    return (
                      <a href={href} target="_blank" rel="noopener noreferrer" className="hover:text-indigo-600 transition-colors">Trabajos a Pedido</a>
                    );
                  })()}
                </li>
                <li><a href="#" className="hover:text-indigo-600 transition-colors">Preguntas Frecuentes</a></li>
              </ul>
            </div>
            
            <div className="text-center md:text-right">
               <h4 className="font-bold text-slate-900 mb-4">Contacto & Redes</h4>
               <div className="flex flex-col items-center md:items-end space-y-2 mb-6 text-sm text-slate-500">
                 <p className="flex items-center gap-2 hover:text-indigo-600 transition-colors cursor-pointer">
                   <Mail size={14} /> info@3d2store.com
                 </p>
                 <p className="flex items-center gap-2 hover:text-indigo-600 transition-colors cursor-pointer">
                   <Phone size={14} /> +54 9 11 1234-5678
                 </p>
               </div>
               
               {/* Social Icons */}
               <div className="flex items-center justify-center md:justify-end gap-3">
                  <a 
                    href="https://www.instagram.com/3d2_creart/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="p-2 bg-gray-100 rounded-full text-slate-600 hover:bg-gradient-to-br hover:from-purple-500 hover:via-pink-500 hover:to-red-500 hover:text-white transition-all duration-300 transform hover:-translate-y-1 shadow-sm"
                    aria-label="Instagram"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
                    </svg>
                  </a>
                  
                  <a 
                    href="https://facebook.com" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="p-2 bg-gray-100 rounded-full text-slate-600 hover:bg-blue-600 hover:text-white transition-all duration-300 transform hover:-translate-y-1 shadow-sm"
                    aria-label="Facebook"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path>
                    </svg>
                  </a>

                  <a 
                    href={(import.meta as any).env?.VITE_WHATSAPP_NUMBER ? `https://wa.me/${(import.meta as any).env.VITE_WHATSAPP_NUMBER}` : 'https://wa.me/1234567890'} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="p-2 bg-gray-100 rounded-full text-slate-600 hover:bg-green-500 hover:text-white transition-all duration-300 transform hover:-translate-y-1 shadow-sm"
                    aria-label="WhatsApp"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
                    </svg>
                  </a>
               </div>
            </div>
          </div>
          <div className="border-t border-gray-100 pt-8 flex flex-col md:flex-row justify-between items-center text-slate-400 text-sm">
            <p>&copy; 2025 3D2 Store. Todos los derechos reservados.</p>
            <span className="mt-2 md:mt-0 text-xs text-slate-400">Build: {(import.meta as any).env?.APP_VERSION}</span>
            <div className="flex gap-4 mt-2 md:mt-0">
               <a href="#" className="hover:text-indigo-600">Privacidad</a>
               <a href="#" className="hover:text-indigo-600">Términos</a>
            </div>
          </div>
        </div>
      </footer>
        </>
      )}
    </div>
  );
};

export default App;