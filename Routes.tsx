import React, { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Home from './components/Home';
import { useAuth } from './context/AuthContext';
import AdminGuard from './components/AdminGuard'; // We will update this or use it as is if it just checks auth

// Lazy loaded components
const Checkout = React.lazy(() => import('./components/Checkout'));
const OrderSuccess = React.lazy(() => import('./components/OrderSuccess'));
const OrderFailure = React.lazy(() => import('./components/OrderFailure'));
const OrderTracking = React.lazy(() => import('./components/OrderTracking'));
const MLCallback = React.lazy(() => import('./components/MLCallback'));
const Register = React.lazy(() => import('./components/Register'));
const UserLogin = React.lazy(() => import('./components/UserLogin'));
const AdminLogin = React.lazy(() => import('./components/AdminLogin'));
const ResetAdmin = React.lazy(() => import('./components/ResetAdmin'));
const AdminPage = React.lazy(() => import('./components/AdminPage'));
const OrdersManagement = React.lazy(() => import('./components/OrdersManagement'));

// Loading component
const Loading = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
  </div>
);

const AppRoutes: React.FC = () => {
    const { login } = useAuth(); // Pass login to UserLogin if needed, though UserLogin in App.tsx had onLogin prop.
    // UserLogin component definition: <UserLogin onLogin={(u)=>setCurrentUser(u)} />
    // We should update UserLogin to use AuthContext or pass the prop.
    // Ideally components accept props or use context. Updating all components is huge work.
    // I can wrap the lazy component or pass props.
    // <UserLogin onLogin={login} />

  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route index element={<Home />} />
        <Route path="register" element={<Register />} />
        <Route path="login" element={<UserLogin onLogin={(u: string) => login(u)} />} />
        <Route path="admin/login" element={<AdminLogin />} />
        <Route path="checkout" element={
            // Checkout takes cart and onClearCart.
            // We need to wrap it to use Context or pass props from a wrapper.
            // Checkout component likely expects props.
            // App.tsx: <Checkout cart={cart} onClearCart={() => setCart([])} />
            // I should verify Checkout component first. If it takes props, I need a wrapper or use context inside it.
            // I'll create a wrapper component inside this file or update Checkout.
            // Updating Checkout to use CartContext is cleaner.
            // But to avoid touching too many files, I'll use a Wrapper here.
            <CheckoutWrapper />
        } />
        <Route path="order-success" element={<OrderSuccess />} />
        <Route path="order-failure" element={<OrderFailure />} />
        <Route path="order-tracking" element={<OrderTracking />} />
        <Route path="ml-callback" element={<MLCallback />} />
        <Route path="reset-admin" element={<ResetAdmin onDone={() => window.location.href = '/'} />} />
        <Route path="admin" element={
          <AdminGuard>
             <AdminPageWrapper /> 
          </AdminGuard>
        } />
        <Route path="admin/orders" element={
          <AdminGuard>
            <OrdersManagement />
          </AdminGuard>
        } />
      </Routes>
    </Suspense>
  );
};

// Wrappers to adapt Context to Props
import { useCart } from './context/CartContext';
import { useProducts } from './context/ProductContext';

const CheckoutWrapper = () => {
    const { cart, clearCart } = useCart();
    return <Checkout cart={cart} onClearCart={clearCart} />;
};

const AdminPageWrapper = () => {
    const { products, addProduct, editProduct, removeProduct } = useProducts();
    // AdminPage expects: products, onAdd, onEdit, onDelete
    return (
        <AdminPage 
            products={products} 
            onAdd={addProduct} 
            onEdit={editProduct} 
            onDelete={removeProduct} 
        />
    );
};

export default AppRoutes;
