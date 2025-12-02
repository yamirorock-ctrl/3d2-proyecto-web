import React, { useState, useMemo } from 'react';
import { X, Trash2, ShoppingBag, ArrowRight, CreditCard } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { CartItem } from '../types';
import SmartImage from './SmartImage';
import { startMercadoPagoCheckout } from '../services/mercadoPago';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  onRemoveItem: (id: number) => void;
  onUpdateQuantity: (id: number, delta: number) => void;
  onCheckout: () => void;
}

const CartDrawer: React.FC<CartDrawerProps> = ({ 
  isOpen, 
  onClose, 
  items, 
  onRemoveItem, 
  onUpdateQuantity,
  onCheckout
}) => {
  const navigate = useNavigate();
  const total = useMemo(() => items.reduce((sum, item) => sum + (item.price * item.quantity), 0), [items]);
  const [mpLoading, setMpLoading] = useState(false);
  const [mpError, setMpError] = useState<string | null>(null);
  const mpPublicKey = (import.meta as any).env?.VITE_MP_PUBLIC;
  const mpConfigured = !!mpPublicKey;

  const handleMercadoPago = async () => {
    if (items.length === 0) return;
    if (!mpConfigured) {
      setMpError('Falta VITE_MP_PUBLIC en .env.local');
      return;
    }
    setMpError(null);
    setMpLoading(true);
    try {
      const mpItems = items.map(i => ({
        id: String(i.id),
        title: i.name,
        quantity: i.quantity,
        unit_price: i.price
      }));
      await startMercadoPagoCheckout(mpItems);
    } catch (e: any) {
      setMpError(e.message || 'Error Mercado Pago');
    } finally {
      setMpLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Overlay */}
      <div 
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />

      <div className="absolute inset-y-0 right-0 max-w-md w-full flex">
        <div className="h-full w-full bg-white shadow-2xl flex flex-col animate-slide-in-right">
          
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <ShoppingBag size={20} className="text-indigo-600" />
              Tu Carrito
            </h2>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-gray-200 rounded-full transition-colors text-slate-500"
            >
              <X size={20} />
            </button>
          </div>

          {/* Items */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {items.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-60">
                <ShoppingBag size={64} className="text-slate-300" />
                <p className="text-lg font-medium text-slate-600">Tu carrito está vacío</p>
                <button 
                  onClick={onClose}
                  className="text-indigo-600 font-medium hover:underline"
                >
                  Continuar comprando
                </button>
              </div>
            ) : (
              items.map((item) => (
                <div key={item.id} className="flex gap-4 group">
                  <div className="h-24 w-24 flex-shrink-0 overflow-hidden rounded-xl border border-gray-200">
                    <SmartImage
                      src={item.image}
                      alt={item.name}
                      className="h-full w-full object-cover"
                      showError
                    />
                  </div>

                  <div className="flex flex-1 flex-col">
                    <div>
                      <div className="flex justify-between text-base font-medium text-slate-900">
                        <h3 className="line-clamp-1">{item.name}</h3>
                        <p className="ml-4">${(item.price * item.quantity).toFixed(2)}</p>
                      </div>
                      <p className="mt-1 text-sm text-slate-500">{item.category}</p>
                    </div>
                    <div className="flex flex-1 items-end justify-between text-sm">
                      <div className="flex items-center border border-gray-200 rounded-lg">
                        <button 
                          onClick={() => onUpdateQuantity(item.id, -1)}
                          className="px-3 py-1 hover:bg-gray-100 text-slate-600"
                          disabled={item.quantity <= 1}
                        >
                          -
                        </button>
                        <span className="px-2 font-medium text-slate-900">{item.quantity}</span>
                        <button 
                          onClick={() => onUpdateQuantity(item.id, 1)}
                          className="px-3 py-1 hover:bg-gray-100 text-slate-600"
                        >
                          +
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => onRemoveItem(item.id)}
                        className="font-medium text-red-500 hover:text-red-700 flex items-center gap-1"
                      >
                        <Trash2 size={14} />
                        Eliminar
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {items.length > 0 && (
            <div className="border-t border-gray-100 bg-gray-50 px-6 py-6 space-y-4">
              <div className="flex justify-between text-base font-medium text-slate-900">
                <p>Subtotal</p>
                <p>${total.toFixed(2)}</p>
              </div>
              <p className="mt-0.5 text-sm text-slate-500">
                Envío calculado al finalizar compra.
              </p>
              <div className="space-y-3">
                <button
                  onClick={() => {
                    onClose();
                    navigate('/checkout');
                  }}
                  className="w-full flex items-center justify-center gap-2 rounded-xl border border-transparent bg-indigo-600 px-6 py-3 text-base font-medium text-white shadow-lg hover:bg-indigo-700 transition-all active:scale-[0.98]"
                >
                  Finalizar Compra <ArrowRight size={18} />
                </button>
                <button
                  onClick={onClose}
                  className="w-full text-sm text-slate-600 hover:text-slate-900"
                >
                  Continuar Comprando
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CartDrawer;