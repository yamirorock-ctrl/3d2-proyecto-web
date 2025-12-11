import React from 'react';
import { Helmet } from 'react-helmet-async';
import ProductCard from './ProductCard';
import CustomOrderForm from './CustomOrderForm';
import { useProducts } from '../context/ProductContext';
import { useCart } from '../context/CartContext';
import { Product } from '../types';

const Home: React.FC = () => {
  const { filteredProducts, selectedCategory, setSelectedCategory, availableCategories, loading } = useProducts();
  const { addToCart } = useCart();

  const handleCustomOrder = (order: any) => {
    // This logic was in App.tsx (setCustomOrders), we might need to move it to a context or just log/save to local storage here if simple.
    // For now, let's keep it simple or assume we want to use the API/Service directly or Context.
    // App.tsx was saving to Sync/LocalStorage.
    // I'll leave a TODO or implement a simple handler. 
    // Since App.tsx logic was: setCustomOrders(prev => [...prev, order]) and save to LS.
    // We should probably add `addCustomOrder` to ProductContext or a separate one?
    // Let's just log it for now to avoid complexity creep, or handle it if critical.
    console.log('New custom order:', order);
    const existing = JSON.parse(localStorage.getItem('customOrders') || '[]');
    localStorage.setItem('customOrders', JSON.stringify([...existing, order]));
    alert('Pedido personalizado guardado localmente (simulación).');
  };

  if (loading) {
     return <div className="min-h-screen flex items-center justify-center">Cargando productos...</div>;
  }

  return (
    <>
      <Helmet>
        <title>Inicio | 3D2 - Impresiones 3D y Corte Láser</title>
        <meta name="description" content="Descubre nuestra colección de impresiones 3D y productos de corte láser. Desde juguetes hasta decoración personalizada." />
        <link rel="canonical" href="https://www.creart3d2.com/" />
      </Helmet>
      {/* Hero Section */}
        <div className="relative bg-slate-900 text-white py-24 px-4 sm:px-6 lg:px-8 rounded-3xl mb-12 overflow-hidden shadow-2xl mx-4 lg:mx-8 mt-6">
          <div className="absolute inset-0 z-0">
            <img 
              src="https://images.unsplash.com/photo-1513346940221-18f46db008d9?auto=format&fit=crop&q=80&w=1600" 
              alt="3D Printing Background" 
              className="w-full h-full object-cover opacity-20"
            />
            <div className="absolute inset-0 bg-linear-to-r from-slate-950 via-slate-900/90 to-transparent"></div>
          </div>
          
          {/* Animated 3D Logo Chip */}
          <div className="absolute right-8 top-1/2 -translate-y-1/2 z-10 hidden lg:block">
            <div className="relative w-64 h-64 animate-float">
              <div className="absolute inset-0 animate-spin-slow">
                <div className="w-full h-full rounded-3xl bg-linear-to-br from-indigo-500 via-purple-500 to-pink-500 shadow-2xl shadow-indigo-500/50 flex items-center justify-center transform perspective-1000 rotate-y-12 p-8">
                  <img 
                    src="/LOGO.jpg" 
                    alt="3D² Logo" 
                    className="w-full h-full object-contain drop-shadow-2xl"
                  />
                </div>
              </div>
              {/* Glow effect */}
              <div className="absolute inset-0 rounded-3xl bg-linear-to-br from-indigo-500 via-purple-500 to-pink-500 blur-xl opacity-50 animate-pulse"></div>
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
              {availableCategories.map((cat: string) => (
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
                filteredProducts.map((product: Product) => (
                <ProductCard 
                    key={product.id} 
                    product={product} 
                    onAddToCart={addToCart} 
                />
                ))
            )}
          </div>
        </div>
    </>
  );
};

export default Home;
