
import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Product, Order, OrderItem, ShippingMethod } from '../types';
import { createOrder } from '../services/orderService';
import { updateProductStock } from '../services/productService';
import { Search, Calculator, Check, Plus, X, User, Phone, FileText, ShoppingCart, DollarSign, Trash2 } from 'lucide-react';

interface Props {
  products: Product[];
  onClose: () => void;
  onOrderCreated: () => void;
}

export const ManualOrderForm: React.FC<Props> = ({ products, onClose, onOrderCreated }) => {
  // Estado del "Carrito Manual"
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  
  // Estado del producto actual siendo agregado
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [customPrice, setCustomPrice] = useState<string>(''); // Precio TOTAL del ítem actual (unitario * cantidad)

  // Datos de la Orden
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<Order['status']>('paid'); 
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Estados para Pagos y Fechas (Gestión de Señas)
  const [paymentAmount, setPaymentAmount] = useState<string>(''); // Monto que paga AHORA
  const [deliveryDate, setDeliveryDate] = useState<string>(''); // Fecha prometida

  // Filtrar productos
  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Calcular total de la orden completa
  const orderTotal = orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const remainingBalance = Math.max(0, orderTotal - (Number(paymentAmount) || 0));

  // Cuando cambia el total, sugerir pago completo por defecto (si no se ha editado)
  useEffect(() => {
     if (paymentAmount === '' && orderTotal > 0) {
       setPaymentAmount(orderTotal.toString());
     } else if (orderItems.length === 0) {
       setPaymentAmount('');
     }
  }, [orderTotal]);

  // Si hay saldo pendiente, sugerir estado 'Pendiente'
  useEffect(() => {
    if (remainingBalance > 0) {
      setStatus('pending');
    } else if (orderTotal > 0 && remainingBalance === 0) {
      setStatus('paid');
    }
  }, [remainingBalance, orderTotal]);

  // Cuando cambia el producto seleccionado o cantidad, calcular precio SUGERIDO actual
  useEffect(() => {
    if (selectedProduct) {
      const suggested = selectedProduct.price * quantity;
      setCustomPrice(suggested.toString());
    }
  }, [selectedProduct, quantity]);

  const handleProductSelect = (p: Product) => {
    setSelectedProduct(p);
    setQuantity(1);
    setCustomPrice(p.price.toString());
    setSearchTerm('');
  };

  const handleAddItem = () => {
    if (!selectedProduct) return;
    
    // Calcular precio unitario REAL basado en el total ingresado
    const priceTotal = Number(customPrice);
    const unitPrice = quantity > 0 ? priceTotal / quantity : 0;

    const newItem: OrderItem = {
      product_id: selectedProduct.id,
      name: selectedProduct.name,
      price: unitPrice,
      quantity: quantity,
      image: selectedProduct.image || selectedProduct.images?.[0]?.url || '',
    };

    setOrderItems([...orderItems, newItem]);
    
    // Resetear selección para agregar otro
    setSelectedProduct(null);
    setQuantity(1);
    setCustomPrice('');
    toast.success('Producto agregado a la lista');
  };

  const handleRemoveItem = (index: number) => {
    const newItems = [...orderItems];
    newItems.splice(index, 1);
    setOrderItems(newItems);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (orderItems.length === 0) {
      toast.error('La orden debe tener al menos un producto');
      return;
    }
    if (!customerName) {
      toast.error('Ingresa el nombre del cliente');
      return;
    }

    setIsSubmitting(true);
    try {
      // Construir nota con metadatos útiles
      let finalNotes = `VENTA MANUAL: ${notes || ''}`;
      
      const pay = Number(paymentAmount) || 0;
      if (remainingBalance > 0) {
        finalNotes += `\n[SEÑA: $${pay} / RESTA: $${remainingBalance}]`;
      } else {
        // Solo agregar [PAGADO TOTAL] si es relevante o diferente al total
        // finalNotes += `\n[PAGADO TOTAL: $${pay}]`;
      }

      if (deliveryDate) {
        // Formatear fecha para lectura fácil
        const [y, m, d] = deliveryDate.split('-');
        finalNotes += `\n[ENTREGA: ${d}/${m}/${y}]`;
      }

      // Construir orden completa
      const orderData = {
        customer_name: customerName,
        customer_email: 'manual@ventas.local', 
        customer_phone: customerPhone || 'Sin teléfono',
        items: orderItems,
        subtotal: orderTotal,
        shipping_cost: 0,
        total: orderTotal,
        shipping_method: 'retiro' as ShippingMethod,
        notes: finalNotes,
      };

      const result = await createOrder(orderData);

      if (result.error) {
        throw result.error;
      }

      if (result.data && status !== 'pending') {
         const { updateOrderStatus } = await import('../services/orderService');
         await updateOrderStatus(result.data.id, status);
      }

      // --- STOCK UPDATE (LOOP) ---
      for (const item of orderItems) {
        if (item.product_id) {
          await updateProductStock(item.product_id, item.quantity);
        }
      }
      // ---------------------------

      toast.success('¡Venta registrada y stock actualizado!');
      onOrderCreated(); 
      onClose(); 

    } catch (error: any) {
      console.error('Error al crear orden manual:', error);
      toast.error('Error al guardar la venta: ' + (error.message || 'Desconocido'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b flex justify-between items-center bg-linear-to-r from-emerald-50 to-white">
          <h2 className="text-xl font-bold text-emerald-800 flex items-center gap-2">
            <ShoppingCart size={24} /> Nueva Venta Rápida (Multi-Producto)
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Body columns */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* COLUMNA IZQUIERDA: Agregar Productos */}
          <div className="space-y-5">
            <h3 className="font-semibold text-slate-800 border-b pb-2 flex items-center gap-2">
              <Plus size={18} className="text-emerald-600"/> 1. Agregar Productos
            </h3>
            
            {/* Buscador */}
            <div className="space-y-2 relative">
              <label className="block text-sm font-medium text-slate-700">Buscar Producto</label>
              {!selectedProduct ? (
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
                  <input
                    type="text"
                    placeholder="Buscar mate, cuadro..."
                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-hidden"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    autoFocus={orderItems.length === 0}
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
                            className="w-full text-left px-4 py-2 hover:bg-emerald-50 flex items-center gap-3 border-b last:border-0 transition-colors"
                          >
                            <img src={p.image || p.images?.[0]?.url} alt="" className="w-8 h-8 rounded-sm object-cover bg-slate-100" />
                            <div className="min-w-0 flex-1">
                              <div className="font-medium text-slate-800 truncate">{p.name}</div>
                              <div className="text-xs text-emerald-600 font-bold">${p.price}</div>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-100 rounded-lg animate-in fade-in slide-in-from-top-1">
                  <img src={selectedProduct.image || selectedProduct.images?.[0]?.url} alt="" className="w-12 h-12 rounded-md object-cover bg-white shadow-xs" />
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-slate-800 truncate">{selectedProduct.name}</div>
                    <div className="text-xs text-emerald-600">Base: ${selectedProduct.price}</div>
                  </div>
                  <button type="button" onClick={() => setSelectedProduct(null)} className="text-slate-400 hover:text-red-500 p-1 bg-white rounded-full shadow-xs">
                    <X size={16} />
                  </button>
                </div>
              )}
            </div>

            {/* Controles de Cantidad y Precio (Solo visibles si hay producto seleccionado) */}
            {selectedProduct && (
              <div className="bg-slate-50 p-4 rounded-xl space-y-4 animate-in fade-in slide-in-from-top-2 border border-slate-100">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Cantidad</label>
                    <input
                      type="number"
                      min="1"
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-hidden font-bold text-center bg-white"
                      value={quantity}
                      onChange={(e) => setQuantity(Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Precio Total Item</label>
                    <div className="relative">
                      <DollarSign className="absolute left-2 top-2.5 text-slate-400" size={14} />
                      <input
                        type="number"
                        className="w-full pl-6 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-hidden font-bold text-slate-900 bg-white"
                        value={customPrice}
                        onChange={(e) => setCustomPrice(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="w-full py-2 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2 shadow-sm"
                >
                  <Plus size={18} /> Agregar a la Orden
                </button>
              </div>
            )}

            {/* Lista de Ítems Agregados */}
            <div className="space-y-2 mt-6">
               <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex justify-between items-center">
                 <span>Ítems en la Orden</span>
                 <span className="bg-slate-100 text-slate-600 px-2 rounded-full text-[10px]">{orderItems.length}</span>
               </h4>
               
               {orderItems.length === 0 ? (
                 <div className="text-center py-8 text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                   <ShoppingCart className="mx-auto mb-2 opacity-20" size={32} />
                   <p>Ningún producto agregado aún</p>
                 </div>
               ) : (
                 <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                   {orderItems.map((item, idx) => (
                     <div key={idx} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg shadow-xs group hover:border-emerald-200 transition-colors">
                       <div className="flex items-center gap-3 overflow-hidden">
                         <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs font-bold border border-slate-200">x{item.quantity}</span>
                         <span className="text-sm font-medium truncate max-w-[140px] text-slate-700" title={item.name}>{item.name}</span>
                       </div>
                       <div className="flex items-center gap-3">
                         <span className="text-sm font-bold text-emerald-600">${(item.price * item.quantity).toLocaleString('es-AR')}</span>
                         <button onClick={() => handleRemoveItem(idx)} className="text-slate-300 hover:text-red-500 transition-colors p-1 hover:bg-red-50 rounded-md">
                           <Trash2 size={16} />
                         </button>
                       </div>
                     </div>
                   ))}
                 </div>
               )}
               
               {/* Resumen Total Izquierda (Pequeño) */}
               {orderItems.length > 0 && (
                 <div className="flex justify-between items-center px-2 py-1 text-xs text-slate-400">
                    <span>Subtotal Items:</span>
                    <span>${orderTotal.toLocaleString('es-AR')}</span>
                 </div>
               )}
            </div>

          </div>

          {/* COLUMNA DERECHA: Datos Cliente y Finalizar */}
          <div className="space-y-5 flex flex-col h-full animate-in fade-in slide-in-from-right-4 duration-300">
            <h3 className="font-semibold text-slate-800 border-b pb-2 flex items-center gap-2">
              <User size={18} className="text-blue-500"/> 2. Datos y Pago
            </h3>
            
            <div className="space-y-4 flex-1 overflow-y-auto pr-1">
              
              {/* Datos Básicos */}
              <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 relative group">
                    <User className="absolute left-3 top-3 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={18} />
                    <input
                      type="text"
                      placeholder="Nombre Cliente *"
                      className="w-full pl-10 pr-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-hidden transition-all text-sm"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                    />
                  </div>
                  <div className="col-span-2 relative group">
                    <Phone className="absolute left-3 top-3 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={18} />
                    <input
                      type="text"
                      placeholder="WhatsApp / Teléfono"
                      className="w-full pl-10 pr-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-hidden transition-all text-sm"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                    />
                  </div>
              </div>

              {/* Seccioń de Pagos y Fechas - DESTACADA */}
              <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 space-y-4">
                  <div className="flex justify-between items-center border-b border-blue-200 pb-2 mb-2">
                      <span className="text-sm font-bold text-blue-800 uppercase">Resumen de Pago</span>
                      <span className="text-lg font-black text-blue-900">${orderTotal.toLocaleString('es-AR')}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                      {/* Campo Pago / Seña */}
                      <div>
                          <label className="block text-xs font-bold text-blue-700 uppercase mb-1">Pagó / Seña</label>
                          <div className="relative">
                              <span className="absolute left-3 top-2 text-blue-500 font-bold">$</span>
                              <input 
                                  type="number" 
                                  className="w-full pl-6 pr-3 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden font-bold text-slate-900"
                                  placeholder="0"
                                  value={paymentAmount}
                                  onChange={(e) => setPaymentAmount(e.target.value)}
                              />
                          </div>
                      </div>

                      {/* Campo Fecha Entrega */}
                      <div>
                          <label className="block text-xs font-bold text-blue-700 uppercase mb-1">Fecha Entrega</label>
                          <input 
                              type="date" 
                              className="w-full px-3 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden text-sm font-medium text-slate-700"
                              value={deliveryDate}
                              onChange={(e) => setDeliveryDate(e.target.value)}
                              min={new Date().toISOString().split('T')[0]}
                          />
                      </div>
                  </div>

                  {/* Resta Pagar (Calculado) */}
                  {remainingBalance > 0 && (
                      <div className="bg-white/60 p-2 rounded-lg flex justify-between items-center border border-blue-100">
                          <span className="text-xs font-bold text-red-500 uppercase">Resta Pagar:</span>
                          <span className="text-sm font-black text-red-600">${remainingBalance.toLocaleString('es-AR')}</span>
                      </div>
                  )}
              </div>

              <div className="relative group">
                <FileText className="absolute left-3 top-3 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={18} />
                <textarea
                  placeholder="Notas internas adicionales..."
                  className="w-full pl-10 pr-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-hidden text-sm h-20 resize-none transition-all"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-2 pt-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest text-center mb-1">Estado del Pedido</label>
                  <div className="flex gap-2">
                      <button 
                          type="button" 
                          onClick={() => setStatus('paid')} 
                          className={`flex-1 py-2 rounded-lg text-sm font-bold border transition-all flex items-center justify-center gap-2 ${status === 'paid' ? 'bg-green-100 border-green-300 text-green-700 shadow-sm ring-2 ring-green-500/20' : 'bg-white border-slate-200 text-slate-400 hover:bg-slate-50 hover:text-slate-600'}`}
                          title="Si el cliente canceló el TOTAL"
                      >
                          {status === 'paid' && <Check size={14} />} Pagado (Total)
                      </button>
                      <button 
                          type="button" 
                          onClick={() => setStatus('pending')} 
                          className={`flex-1 py-2 rounded-lg text-sm font-bold border transition-all flex items-center justify-center gap-2 ${status === 'pending' ? 'bg-yellow-100 border-yellow-300 text-yellow-700 shadow-sm ring-2 ring-yellow-500/20' : 'bg-white border-slate-200 text-slate-400 hover:bg-slate-50 hover:text-slate-600'}`}
                          title="Si queda saldo pendiente"
                      >
                          {status === 'pending' && <Check size={14} />} Pendiente
                      </button>
                  </div>
              </div>
            </div>

            <div className="pt-4 border-t mt-auto">
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || orderItems.length === 0 || !customerName}
                className="w-full py-3.5 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
              >
                {isSubmitting ? (
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Check size={20} className="stroke-[3]" /> Registrar Venta Final (${orderTotal.toLocaleString('es-AR')})
                  </>
                )}
              </button>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
};
