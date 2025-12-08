import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { CartItem, Product } from '../types';
import { useProducts } from './ProductContext';

interface CartContextType {
  cart: CartItem[];
  isCartOpen: boolean;
  isCheckoutOpen: boolean;
  cartNotice: string | null;
  openCart: () => void;
  closeCart: () => void;
  openCheckout: () => void;
  closeCheckout: () => void;
  addToCart: (product: Product) => void;
  removeFromCart: (id: number) => void;
  updateQuantity: (id: number, delta: number) => void;
  clearCart: () => void;
  cartTotal: number;
  itemCount: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [cartNotice, setCartNotice] = useState<string | null>(null);
  
  const { products } = useProducts();

  // Load cart from local storage with sanitization
  useEffect(() => {
    const savedCart = localStorage.getItem('cart');
    if (savedCart) {
      try {
        const parsed: CartItem[] = JSON.parse(savedCart);
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
          localStorage.setItem('cart', JSON.stringify(sanitized));
          setCartNotice('Ajustamos tu carrito para corregir items inválidos o duplicados.');
          setTimeout(() => setCartNotice(null), 5000);
        }
      } catch {
        localStorage.removeItem('cart');
        setCart([]);
        setCartNotice('Se reinició el carrito por datos corruptos en el navegador.');
        setTimeout(() => setCartNotice(null), 5000);
      }
    }
  }, []);

  // Sync with products changes (stock checks)
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

  // Global event listener for clearing cart
  useEffect(() => {
    const handler = () => {
      setCart([]);
      try { localStorage.removeItem('cart'); } catch {}
    };
    window.addEventListener('cart:clear', handler);
    return () => window.removeEventListener('cart:clear', handler);
  }, []);

  // Save cart to local storage
  useEffect(() => {
    try {
      localStorage.setItem('cart', JSON.stringify(cart));
    } catch (e) {
      if (e instanceof Error && e.name === 'QuotaExceededError') {
        console.warn('LocalStorage full, cleaning old data...');
        localStorage.removeItem('session');
        localStorage.removeItem('failedAttempts');
        try {
          localStorage.setItem('cart', JSON.stringify(cart));
        } catch (e2) {
          console.error('Could not save cart');
        }
      }
    }
  }, [cart]);

  const addToCart = (product: Product, quantity: number = 1) => {
    if (product.stock !== undefined && product.stock === 0) {
      alert('Este producto está agotado');
      return;
    }

    setCart(prev => {
      // Diferenciar por ID y saleType (para no mezclar unidad con mayorista)
      const targetSaleType = product.saleType || 'unidad';
      const existing = prev.find(item => item.id === product.id && (item.saleType || 'unidad') === targetSaleType);
      
      if (existing) {
        const newTotal = existing.quantity + quantity;
        if (product.stock !== undefined && newTotal > product.stock) {
          alert(`Solo hay ${product.stock} unidades disponibles de este producto`);
          return prev;
        }
        return prev.map(item => 
          (item.id === product.id && (item.saleType || 'unidad') === targetSaleType)
            ? { ...item, quantity: newTotal } 
            : item
        );
      }
      
      // Si el producto viene con una cantidad predefinida (ej: pack), usarla como base si no se especifica otra
      // Pero aquí `quantity` ya viene del argumento.
      return [...prev, { ...product, quantity: quantity, saleType: targetSaleType }];
    });
    setIsCartOpen(true);
  };

  const removeFromCart = (id: number) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const updateQuantity = (id: number, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQuantity = item.quantity + delta;
        if (item.stock !== undefined && newQuantity > item.stock) {
          alert(`Solo hay ${item.stock} unidades disponibles`);
          return item;
        }
        return { ...item, quantity: Math.max(1, newQuantity) };
      }
      return item;
    }));
  };

  const clearCart = () => {
      setCart([]);
  };

  const openCart = () => setIsCartOpen(true);
  const closeCart = () => setIsCartOpen(false);
  const openCheckout = () => {
      setIsCartOpen(false);
      setIsCheckoutOpen(true);
  };
  const closeCheckout = () => setIsCheckoutOpen(false);

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const itemCount = cart.reduce((acc, item) => acc + item.quantity, 0);

  return (
    <CartContext.Provider value={{ 
        cart, 
        isCartOpen, 
        isCheckoutOpen, 
        cartNotice,
        openCart, 
        closeCart, 
        openCheckout,
        closeCheckout,
        addToCart, 
        removeFromCart, 
        updateQuantity,
        clearCart,
        cartTotal,
        itemCount
    }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
