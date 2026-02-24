import React from 'react';
import { Helmet } from 'react-helmet-async';
import { useParams, useNavigate } from 'react-router-dom';
import ProductCard from './ProductCard';
import CustomOrderForm from './CustomOrderForm';
import ProductDetailModal from './ProductDetailModal';
import { useProducts } from '../context/ProductContext';
import { useCart } from '../context/CartContext';
import { Product } from '../types';

const Home: React.FC = () => {
  const { filteredProducts, selectedCategory, setSelectedCategory, availableCategories, loading, products } = useProducts();
  const { addToCart } = useCart();
  const { productId } = useParams();
  const navigate = useNavigate();

  // Find product from URL if exists
  const urlProduct = React.useMemo(() => {
    if (!productId) return null;
    return products.find(p => p.id === Number(productId));
  }, [productId, products]);

  // Handle modal close
  const handleCloseModal = () => {
      navigate('/', { replace: true });
  };

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
        <div className="relative bg-black text-white py-24 px-4 sm:px-6 lg:px-8 rounded-3xl mb-12 overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] mx-4 lg:mx-8 mt-6 border border-white/5">
          <div className="absolute inset-0 z-0">
            {/* Background Image / Overlay */}
            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1614850523296-d8c1af93d400?q=80&w=1600')] bg-cover bg-center opacity-30 mix-blend-overlay"></div>
            <div className="absolute inset-0 bg-linear-to-r from-[#0a0b10] via-[#0a0b10]/80 to-transparent"></div>
            
            {/* Animated Glow Orbs */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 blur-[120px] rounded-full animate-pulse"></div>
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-magenta-500/10 blur-[120px] rounded-full animate-pulse" style={{ animationDelay: '1.5s' }}></div>
          </div>
          
          {/* Animated 3D Logo Chip - Refined for Gaming */}
          <div className="absolute right-8 top-1/2 -translate-y-1/2 z-10 hidden lg:block">
            <div className="relative w-72 h-72 animate-float">
               {/* Cyber Frame */}
               <div className="absolute -inset-4 border border-cyan-500/20 rounded-full animate-ping [animation-duration:3s]"></div>
               <div className="absolute -inset-8 border border-magenta-500/10 rounded-full animate-ping [animation-duration:5s]"></div>
               
               <div className="w-full h-full rounded-2xl bg-slate-900/80 backdrop-blur-xl border border-white/10 shadow-[0_0_40px_rgba(0,243,255,0.2)] flex items-center justify-center p-8 group overflow-hidden">
                  <div className="absolute inset-0 bg-linear-to-tr from-cyan-500/10 to-magenta-500/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <img 
                    src="/LOGO.jpg" 
                    alt="3D² Logo" 
                    className="w-full h-full object-contain drop-shadow-[0_0_15px_rgba(255,255,255,0.5)] transition-transform duration-500 group-hover:scale-110"
                  />
                </div>
            </div>
          </div>
          
          <div className="relative z-10 max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-cyan-500/10 border border-cyan-500/30 rounded-full text-cyan-400 text-xs font-bold mb-6 backdrop-blur-md tracking-[0.2em] uppercase">
              <span className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></span>
              Impresión 3D & Tech Labs
            </div>
            
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-black leading-[1.1] mb-6 tracking-tight">
              EVOLUCIONA<br/>
              <span className="text-transparent bg-clip-text bg-linear-to-r from-cyan-400 via-blue-500 to-magenta-500 drop-shadow-sm">TU IMAGINACIÓN.</span>
            </h1>
            
            <p className="text-lg text-slate-400 mb-10 max-w-lg leading-relaxed font-medium">
              Obra de ingeniería y arte en cada capa. Desde setups gamers hasta piezas únicas de colección. 
              Tecnología de punta aplicada a tus ideas.
            </p>
            
            <div className="flex flex-wrap gap-4">
              <button 
                onClick={() => setSelectedCategory('__all__')}
                className="group relative px-8 py-4 bg-cyan-500 text-black rounded-xl font-black hover:bg-cyan-400 transition-all shadow-[0_0_20px_rgba(0,243,255,0.4)] overflow-hidden"
              >
                <span className="relative z-10 flex items-center gap-2">
                  EXPLORAR DATA <span className="text-xl">›</span>
                </span>
                <div className="absolute inset-0 bg-white/20 -translate-x-full group-hover:translate-x-full transition-transform duration-500"></div>
              </button>
              
              <button 
                onClick={() => setSelectedCategory('Personalizados')}
                className="px-8 py-4 bg-white/5 backdrop-blur-xl text-white border border-white/20 rounded-xl font-bold hover:bg-white/10 hover:border-magenta-500/50 transition-all shadow-xl"
              >
                ORDE ESPECIAL
              </button>
            </div>
          </div>
        </div>

        {/* Product Grid Container */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-32">
          <div className="flex flex-col md:flex-row justify-between items-center mb-12 gap-8 border-b border-white/5 pb-8">
            <div className="text-center md:text-left">
              <h2 className="text-3xl font-black text-white glow-cyan tracking-tight uppercase">HARDWARE & ARTE</h2>
              <p className="text-slate-500 mt-1 font-mono text-sm uppercase tracking-widest">Protocolo de visualización activo</p>
            </div>
            
            {/* Category Filter - Gaming Style */}
            <div className="flex gap-3 overflow-x-auto pb-4 md:pb-0 w-full md:w-auto no-scrollbar justify-center md:justify-start">
              <button 
                onClick={()=>setSelectedCategory('Destacados')} 
                className={`px-5 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all duration-300 border ${
                  selectedCategory==='Destacados'
                  ? 'bg-cyan-500 border-cyan-400 text-black shadow-[0_0_15px_rgba(0,243,255,0.3)]' 
                  : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:border-white/30'
                }`}
              >
                TOP TRENDING
              </button>
              
              <button 
                onClick={()=>setSelectedCategory('__all__')} 
                className={`px-5 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all duration-300 border ${
                  selectedCategory==='__all__'
                  ? 'bg-magenta-500 border-magenta-400 text-white shadow-[0_0_15px_rgba(255,0,255,0.3)]' 
                  : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:border-white/30'
                }`}
              >
                ALL DATA
              </button>

              {availableCategories.map((cat: string) => (
                <button 
                  key={cat} 
                  onClick={()=>setSelectedCategory(cat)} 
                  className={`px-5 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all duration-300 border ${
                    selectedCategory===cat
                    ? 'bg-white text-black border-white' 
                    : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:border-white/30'
                  }`}
                >
                  {cat}
                </button>
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
      {/* Modal Automático desde URL */}
      {urlProduct && (
        <ProductDetailModal 
          product={urlProduct} 
          isOpen={true} 
          onClose={handleCloseModal} 
          onAddToCart={addToCart}
        />
      )}
    </>
  );
};

export default Home;
