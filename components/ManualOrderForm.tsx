
import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Product, Order, OrderItem, ShippingMethod } from '../types';
import { createOrder } from '../services/orderService';
import { updateProductStock } from '../services/productService';
import { Search, Calculator, Check, X, User, Phone, FileText, ShoppingCart, DollarSign } from 'lucide-react';

interface Props {
  products: Product[];
  onClose: () => void;
  onOrderCreated: () => void;
}

export const ManualOrderForm: React.FC<Props> = ({ products, onClose, onOrderCreated }) => {
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [customPrice, setCustomPrice] = useState<string>(''); // String para permitir edición manual fácil
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<Order['status']>('paid'); // Por defecto 'Pagado' (asumimos venta mostrador)
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Filtrar productos
  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Cuando cambia el producto o cantidad, calcular precio SUGERIDO
  useEffect(() => {
    if (selectedProduct) {
      // Precio base x cantidad
      const suggested = selectedProduct.price * quantity;
      // Solo actualizamos si el usuario NO ha tocado el precio manualmente (o si está vacío)
      if (customPrice === '' || Number(customPrice) === 0) {
        setCustomPrice(suggested.toString());
      }
    }
  }, [selectedProduct, quantity]);

  // Reset precio sugerido al cambiar producto explícitamente
  const handleProductSelect = (p: Product) => {
    setSelectedProduct(p);
    setCustomPrice((p.price * quantity).toString());
    setSearchTerm(''); // Limpiar búsqueda para ver selección clara
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) {
      toast.error('Selecciona un producto');
      return;
    }
    if (!customerName) {
      toast.error('Ingresa el nombre del cliente');
      return;
    }

    setIsSubmitting(true);
    try {
      // Construir ítem de orden
      const orderItem: OrderItem = {
        product_id: selectedProduct.id,
        name: selectedProduct.name,
        price: Number(customPrice) / quantity, // Precio unitario real pagado
        quantity: quantity,
        image: selectedProduct.image || selectedProduct.images?.[0]?.url || '',
      };

      // Construir orden completa
      const orderData = {
        customer_name: customerName,
        customer_email: 'manual@ventas.local', // Email dummy para registros manuales
        customer_phone: customerPhone || 'Sin teléfono',
        items: [orderItem],
        subtotal: Number(customPrice),
        shipping_cost: 0,
        total: Number(customPrice),
        shipping_method: 'retiro' as ShippingMethod, // Asumimos retiro/mostrador por defecto
        notes: `VENTA MANUAL: ${notes || ''}`,
      };

      const result = await createOrder(orderData);

      if (result.error) {
        throw result.error;
      }

      // Si el estado seleccionado no es 'pending' (default de createOrder), actualizarlo
      if (result.data && status !== 'pending') {
         const { updateOrderStatus } = await import('../services/orderService');
         await updateOrderStatus(result.data.id, status);
      }

      // --- STOCK UPDATE ---
      // Descontar stock automáticamente
      if (selectedProduct.id) {
        await updateProductStock(selectedProduct.id, quantity);
      }
      // --------------------

      toast.success('¡Venta registrada y stock actualizado!');
      onOrderCreated(); // Refrescar lista
      onClose(); // Cerrar modal

    } catch (error: any) {
      console.error('Error al crear orden manual:', error);
      toast.error('Error al guardar la venta: ' + (error.message || 'Desconocido'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b flex justify-between items-center bg-linear-to-r from-emerald-50 to-white">
          <h2 className="text-xl font-bold text-emerald-800 flex items-center gap-2">
            <ShoppingCart size={24} /> Nueva Venta Rápida
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5">
          
          {/* 1. Selección de Producto */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">Producto</label>
            
            {!selectedProduct ? (
              <div className="relative">
                <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
                <input
                  type="text"
                  placeholder="Buscar mate, cuadro..."
                  className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-hidden"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  autoFocus
                />
                
                {searchTerm && (
                  <div className="absolute top-full left-0 right-0 bg-white border rounded-lg shadow-xl mt-1 max-h-48 overflow-y-auto z-10">
                    {filteredProducts.length === 0 ? (
                      <div className="p-3 text-sm text-slate-500 text-center">No se encontraron productos</div>
                    ) : (
                      filteredProducts.map(p => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => handleProductSelect(p)}
                          className="w-full text-left px-4 py-2 hover:bg-emerald-50 flex items-center gap-3 border-b last:border-0"
                        >
                          <img src={p.image || p.images?.[0]?.url} alt="" className="w-8 h-8 rounded-sm object-cover bg-slate-100" />
                          <div>
                            <div className="font-medium text-slate-800">{p.name}</div>
                            <div className="text-xs text-emerald-600 font-bold">${p.price}</div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-100 rounded-lg">
                <img src={selectedProduct.image || selectedProduct.images?.[0]?.url} alt="" className="w-12 h-12 rounded-md object-cover bg-white" />
                <div className="flex-1">
                  <div className="font-bold text-slate-800">{selectedProduct.name}</div>
                  <div className="text-xs text-emerald-600">Precio Lista: ${selectedProduct.price}</div>
                </div>
                <button 
                  type="button" 
                  onClick={() => setSelectedProduct(null)} 
                  className="text-slate-400 hover:text-red-500 p-1"
                  title="Cambiar producto"
                >
                  <X size={18} />
                </button>
              </div>
            )}
          </div>

          {/* 2. Cantidad y Precio (En la misma fila) */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Cantidad</label>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-hidden font-bold text-center"
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 flex items-center justify-between">
                <span>Total a Cobrar</span>
                {Number(customPrice) !== (selectedProduct?.price || 0) * quantity && selectedProduct && (
                   <span className="text-[10px] bg-yellow-100 text-yellow-800 px-1 rounded-sm">Modificado</span>
                )}
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-2.5 text-slate-400" size={16} />
                <input
                  type="number"
                  className={`w-full pl-8 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-hidden font-bold ${
                    Number(customPrice) < ((selectedProduct?.price || 0) * quantity) ? 'text-green-600' : 'text-slate-900'
                  }`}
                  value={customPrice}
                  onChange={(e) => setCustomPrice(e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>

          {/* 3. Datos Cliente */}
          <div className="space-y-3 pt-2 border-t border-dashed">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Datos del Cliente</h3>
            
            <div className="relative">
              <User className="absolute left-3 top-2.5 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="Nombre del Cliente (ej: Juan Pérez)"
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-hidden"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
            </div>

            <div className="relative">
              <Phone className="absolute left-3 top-2.5 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="WhatsApp / Teléfono (Opcional)"
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-hidden"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
              />
            </div>
          </div>

          {/* 4. Notas y Estado */}
          <div className="space-y-3">
            <div className="relative">
              <FileText className="absolute left-3 top-2.5 text-slate-400" size={18} />
              <textarea
                placeholder="Notas: 'Paga con MP', 'Retira Jueves', 'Dice: Feliz Cumple'..."
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-hidden text-sm h-20 resize-none"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-4 text-sm">
                <label className="font-medium text-slate-700">Estado Inicial:</label>
                <div className="flex gap-2">
                    <button 
                        type="button" 
                        onClick={() => setStatus('paid')} 
                        className={`px-3 py-1 rounded-full border ${status === 'paid' ? 'bg-green-100 border-green-300 text-green-800' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                    >
                        Pagado
                    </button>
                    <button 
                        type="button" 
                        onClick={() => setStatus('pending')} 
                        className={`px-3 py-1 rounded-full border ${status === 'pending' ? 'bg-yellow-100 border-yellow-300 text-yellow-800' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                    >
                        Pendiente
                    </button>
                </div>
            </div>
          </div>

        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-slate-50 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-200 rounded-lg transition-colors"
            disabled={isSubmitting}
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !selectedProduct || !customerName}
            className="px-6 py-2 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 shadow-md transform hover:-translate-y-0.5 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Check size={18} /> Registrar Venta (${customPrice})
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
