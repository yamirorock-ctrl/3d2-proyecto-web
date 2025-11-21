import React, { useState, useEffect } from 'react';
import { Product, CartItem, ViewState } from './types';
import Navbar from './components/Navbar';
import ProductCard from './components/ProductCard';
import CartDrawer from './components/CartDrawer';
import ChatAssistant from './components/ChatAssistant';
import AdminPage from './components/AdminPage';
import AdminLogin from './components/AdminLogin';
import AdminGuard from './components/AdminGuard';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { CheckCircle2, ArrowLeft, Mail, Phone } from 'lucide-react';

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

  // Load cart from local storage
  useEffect(() => {
    const savedCart = localStorage.getItem('cart');
    if (savedCart) {
      setCart(JSON.parse(savedCart));
    }
  }, []);

  // Save cart to local storage
  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(cart));
  }, [cart]);

  // Save products to local storage
  useEffect(() => {
    localStorage.setItem('products', JSON.stringify(products));
  }, [products]);

  const handleAddToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
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
        return { ...item, quantity: Math.max(1, item.quantity + delta) };
      }
      return item;
    }));
  };

  const handleCheckout = () => {
    setIsCartOpen(false);
    setView(ViewState.CHECKOUT);
    // Simulate processing
    setTimeout(() => {
      setCart([]);
      setView(ViewState.SUCCESS);
    }, 2000);
  };

  // Product admin handlers
  const handleAddProduct = (prod: Product) => {
    setProducts(prev => {
      const nextId = prev.length ? Math.max(...prev.map(p => p.id)) + 1 : 1;
      return [...prev, { ...prod, id: nextId }];
    });
  };

  const handleEditProduct = (prod: Product) => {
    setProducts(prev => prev.map(p => p.id === prod.id ? prod : p));
  };

  const handleDeleteProduct = (id: number) => {
    setProducts(prev => prev.filter(p => p.id !== id));
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
              <button className="px-8 py-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-900/20">
                Ver Catálogo
              </button>
              <button className="px-8 py-4 bg-white/5 backdrop-blur-md text-white border border-white/10 rounded-xl font-bold hover:bg-white/10 transition-all">
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
            
            {/* Category Filter (Visual only for now) */}
            <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0 w-full sm:w-auto no-scrollbar">
               <span className="px-4 py-2 bg-slate-900 text-white rounded-full text-sm font-medium whitespace-nowrap cursor-pointer">Todo</span>
               <span className="px-4 py-2 bg-white border border-gray-200 text-slate-600 rounded-full text-sm font-medium whitespace-nowrap hover:bg-gray-50 cursor-pointer transition-colors">Juguetes</span>
               <span className="px-4 py-2 bg-white border border-gray-200 text-slate-600 rounded-full text-sm font-medium whitespace-nowrap hover:bg-gray-50 cursor-pointer transition-colors">Hogar</span>
               <span className="px-4 py-2 bg-white border border-gray-200 text-slate-600 rounded-full text-sm font-medium whitespace-nowrap hover:bg-gray-50 cursor-pointer transition-colors">Personalizados</span>
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {products.map(product => (
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
      <Navbar 
        cartCount={cart.reduce((acc, item) => acc + item.quantity, 0)} 
        onOpenCart={() => setIsCartOpen(true)}
        onGoHome={() => setView(ViewState.HOME)}
        onOpenAdmin={() => navigate('/admin')}
      />

      <main className="pt-4">
        <Routes>
          <Route index element={renderContent()} />
          <Route path="admin/login" element={<AdminLogin />} />
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

      <ChatAssistant products={products} />
      
      
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
                <li><a href="#" className="hover:text-indigo-600 transition-colors">Trabajos a Pedido</a></li>
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
                    href="https://instagram.com" 
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
                    href="https://wa.me/1234567890" 
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
            <div className="flex gap-4 mt-2 md:mt-0">
               <a href="#" className="hover:text-indigo-600">Privacidad</a>
               <a href="#" className="hover:text-indigo-600">Términos</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;