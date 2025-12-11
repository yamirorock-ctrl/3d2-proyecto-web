import React, { useEffect } from 'react';
import { Toaster } from 'sonner';
import { useNavigate, useLocation } from 'react-router-dom';
import { initGA, logPageView } from './utils/analytics';
import Navbar from './components/Navbar';
import CartDrawer from './components/CartDrawer';
import ChatAssistant from './components/ChatAssistant';
import CheckoutModal from './components/CheckoutModal';
import Footer from './components/Footer';
import AppRoutes from './Routes';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProductProvider, useProducts } from './context/ProductContext';
import { CartProvider, useCart } from './context/CartContext';
import { Order } from './types';

// 🔧 MODO MANTENIMIENTO - Cambiar a true para activar mantenimiento
const MAINTENANCE_MODE = false;

const MainLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Initialize GA and track page views
  useEffect(() => {
    initGA();
  }, []);

  useEffect(() => {
    logPageView();
  }, [location]);

  const { 
    cart, 
    itemCount, 
    isCartOpen, 
    openCart, 
    closeCart, 
    removeFromCart, 
    updateQuantity, 
    isCheckoutOpen, 
    openCheckout, 
    closeCheckout, 
    cartTotal, 
    clearCart,
    cartNotice 
  } = useCart();
  
  const { currentUser, logout } = useAuth();
  const { 
    updateStock, 
    refreshProducts, 
    products, 
    setSelectedCategory, 
    setSearchQuery 
  } = useProducts();

  // Expose sync function to window for Admin/Debug
  useEffect(() => {
    (window as any).__forceSyncProducts = async () => {
         await refreshProducts();
         alert('Sincronización manual completada (Context).');
    };
  }, [refreshProducts]);

  const handleConfirmOrder = (order: Order) => {
    // Update stock via ProductContext
    order.items.forEach(item => {
        // Note: item.id in OrderItem vs Product.Order items might match product_id
        // Types: OrderItem { product_id: number, ... }
        // updateStock takes (id, qty).
        updateStock(item.product_id, item.quantity);
    });

    // Save order (local storage persistence mimicking App.tsx)
    try {
        const savedOrders = JSON.parse(localStorage.getItem('orders') || '[]');
        localStorage.setItem('orders', JSON.stringify([...savedOrders, order]));
    } catch (e) {
        console.warn('Error saving order locally', e);
    }
    
    clearCart();
    navigate('/order-success');
  };

  if (MAINTENANCE_MODE && window.location.pathname !== '/admin/login' && window.location.pathname !== '/admin') {
      return (
        <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-indigo-500 to-purple-600 p-4">
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
      );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-indigo-50 via-purple-50 to-pink-50 font-sans selection:bg-indigo-100 selection:text-indigo-900">
       {cartNotice && (
        <div className="bg-yellow-100 text-yellow-800 text-xs sm:text-sm p-2 text-center animate-fade-in">
          {cartNotice}
        </div>
       )}
       
       <Navbar 
         cartCount={itemCount} 
         onOpenCart={openCart}
         onGoHome={() => { 
             navigate('/'); 
             setSelectedCategory('Destacados'); // Reset to default view
         }}
         onOpenAdmin={() => navigate('/admin')}
         currentUser={currentUser}
         onLogoutUser={logout}
         onCategorySelect={(cat) => { 
             navigate('/'); 
             setSelectedCategory(cat); 
         }}
         onSearch={(q) => { 
             setSearchQuery(q); 
             navigate('/'); 
             setSelectedCategory(q ? '__all__' : 'Destacados'); // Ensure we look in all if searching
         }}
       />

       <main className="pt-4">
         <AppRoutes />
       </main>

       <CartDrawer 
         isOpen={isCartOpen} 
         onClose={closeCart} 
         items={cart}
         onRemoveItem={removeFromCart}
         onUpdateQuantity={updateQuantity}
         onCheckout={openCheckout}
       />

       <CheckoutModal
         isOpen={isCheckoutOpen}
         onClose={closeCheckout}
         items={cart}
         total={cartTotal}
         onConfirmOrder={handleConfirmOrder}
       />

       <ChatAssistant products={products} />
       
       <ChatAssistant products={products} />
       
       <Footer />
       <Toaster position="top-right" richColors />
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <ProductProvider>
        <CartProvider>
            <MainLayout />
        </CartProvider>
      </ProductProvider>
    </AuthProvider>
  );
};

export default App;