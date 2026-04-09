import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { Product, Order, OrderItem, ShippingMethod, OrderStatus, Payment, RawMaterial } from '../types';
import { createOrder, updateOrder } from '../services/orderService';
import { updateProductStock } from '../services/productService';
import { getMaterials } from '../services/supabaseService';
import { Search, Calculator, Check, Plus, X, User, Phone, FileText, ShoppingCart, DollarSign, Trash2, Edit, AlertCircle, Package, RefreshCw } from 'lucide-react';
import { useProducts } from '../context/ProductContext';

interface Props {
  products: Product[];
  initialOrder?: Order; // Para modo edición
  onClose: () => void;
  onOrderCreated: () => void;
}

export const ManualOrderForm: React.FC<Props> = ({ products, initialOrder, onClose, onOrderCreated }) => {
  const { updateStock } = useProducts();
  // Estado del "Carrito Manual"
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  
  // Estado del producto actual siendo agregado
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isCustomProductMode, setIsCustomProductMode] = useState(false);
  const [customNameItem, setCustomNameItem] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [customPrice, setCustomPrice] = useState<string>(''); // Precio TOTAL del ítem actual (unitario * cantidad)
  const [saleType, setSaleType] = useState<'retail' | 'pack' | 'wholesale'>('retail');

  // Insumos personalizados para orden manual
  const [availableMaterials, setAvailableMaterials] = useState<RawMaterial[]>([]);
  const [customConsumables, setCustomConsumables] = useState<{ material: string, quantity: number }[]>([]);
  const [tempMaterial, setTempMaterial] = useState('');
  const [tempMaterialQty, setTempMaterialQty] = useState<number>(1);
  const [packMaterial, setPackMaterial] = useState('');
  const [packMaterialQty, setPackMaterialQty] = useState<number>(1);

  // Datos de la Orden
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<Order['status']>('paid'); 
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Estados para Pagos y Fechas (Gestión de Señas)
  const [paymentAmount, setPaymentAmount] = useState<string>(''); // Monto que paga AHORA
  const [payMethod, setPayMethod] = useState<Payment['method']>('efectivo');
  const [deliveryDate, setDeliveryDate] = useState<string>(''); // Fecha prometida

  // Monotributo / Facturación
  const [isFacturado, setIsFacturado] = useState(false);
  const [billingDni, setBillingDni] = useState('');
  const [billingType, setBillingType] = useState<Order['billing_type']>('Consumidor Final');
  const [invoiceNumber, setInvoiceNumber] = useState('');

  useEffect(() => {
    getMaterials().then(res => {
      if (res.data) setAvailableMaterials(res.data);
    });
  }, []);

  // Cargar datos si es edición
  useEffect(() => {
    if (initialOrder) {
      setOrderItems(initialOrder.items || []);
      setCustomerName(initialOrder.customer_name || '');
      setCustomerPhone(initialOrder.customer_phone || '');
      setStatus(initialOrder.status);
      
      // Facturación
      setIsFacturado(initialOrder.is_invoiced || false);
      setBillingDni(initialOrder.billing_dni_cuit || '');
      setBillingType(initialOrder.billing_type || 'Consumidor Final');
      setInvoiceNumber(initialOrder.invoice_number || '');
      
      // Parsear notas para recuperar: Notas reales, Seña, Fecha Entrega
      const fullNotes = initialOrder.notes || '';
      
      // 1. Extraer Seña/Pago
      const paymentMatch = fullNotes.match(/\[(SEÑA|PAGADO TOTAL): \$(\d+)/);
      if (paymentMatch) {
        setPaymentAmount(paymentMatch[2]);
      } else {
        // Si no hay tag, y está pagado, asumimos total. Si pendiente, tal vez 0.
        if (initialOrder.status === 'paid') {
           setPaymentAmount(initialOrder.total.toString()); 
        }
      }

      // 2. Extraer Fecha Entrega: [ENTREGA: DD/MM/YYYY]
      const deliveryMatch = fullNotes.match(/\[ENTREGA: (\d{1,2})\/(\d{1,2})\/(\d{4})\]/);
      if (deliveryMatch) {
         const [_, d, m, y] = deliveryMatch;
         // Input type="date" requiere YYYY-MM-DD
         setDeliveryDate(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`);
      }

      // 3. Limpiar notas visuales (quitando los tags de sistema)
      const cleanNotes = fullNotes
        .replace(/VENTA MANUAL:\s*/, '')
        .replace(/\n\[SEÑA:.*?\]/, '')
        .replace(/\n\[PAGADO TOTAL:.*?\]/, '')
        .replace(/\n\[ENTREGA:.*?\]/, '')
        .trim();
      setNotes(cleanNotes);
    }
  }, [initialOrder]);

  // Filtrar productos
  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Calcular total de la orden completa
  const orderTotal = orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const remainingBalance = Math.max(0, orderTotal - (Number(paymentAmount) || 0));

  // Cuando cambia el total, sugerir pago completo por defecto (solo si NO es edición o si estamos creando)
  useEffect(() => {
     if (!initialOrder && paymentAmount === '' && orderTotal > 0) {
       setPaymentAmount(orderTotal.toString());
     } else if (!initialOrder && orderItems.length === 0) {
       setPaymentAmount('');
     }
  }, [orderTotal, initialOrder]);

  // Si hay saldo pendiente, sugerir estado 'Pendiente' (reactivo)
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
      let unitPrice = selectedProduct.price;
      
      if (saleType === 'pack' && selectedProduct.packEnabled && selectedProduct.packDiscount) {
        unitPrice = selectedProduct.price * (1 - selectedProduct.packDiscount / 100);
      } else if (saleType === 'wholesale' && selectedProduct.mayoristaEnabled && selectedProduct.wholesaleDiscount) {
        unitPrice = selectedProduct.price * (1 - selectedProduct.wholesaleDiscount / 100);
      }
      
      const suggested = Math.round(unitPrice * quantity);
      setCustomPrice(suggested.toString());
    }
  }, [selectedProduct, quantity, saleType]);

  const handleProductSelect = (p: Product) => {
    setSelectedProduct(p);
    setSearchTerm('');
    
    // Auto-detectar mejor modo inicial si el minorista está deshabilitado
    if (p.unitEnabled === false) {
      if (p.packEnabled) {
          setSaleType('pack');
          setQuantity(p.unitsPerPack || 2);
      } else if (p.mayoristaEnabled) {
          setSaleType('wholesale');
          setQuantity(p.wholesaleUnits || 12);
      }
    } else {
      setSaleType('retail');
      setQuantity(1);
    }
  };

  const handleAddItem = () => {
    if (!selectedProduct && !isCustomProductMode) return;
    if (isCustomProductMode && !customNameItem) return;
    
    // Calcular precio unitario REAL basado en el total ingresado
    const priceTotal = Number(customPrice);
    const unitPrice = quantity > 0 ? priceTotal / quantity : 0;

    let displayName = isCustomProductMode ? `[ESPECIAL] ${customNameItem}` : selectedProduct!.name;
    if (!isCustomProductMode) {
      if (saleType === 'pack') displayName += ` (Pack x${selectedProduct?.unitsPerPack || 2})`;
      else if (saleType === 'wholesale') displayName += ` (Mayorista/Crudo)`;
    }

    const newItem: OrderItem = {
      product_id: selectedProduct?.id || 0, // 0 o null para productos personalizados
      name: displayName,
      price: unitPrice,
      quantity: quantity,
      image: selectedProduct?.image || selectedProduct?.images?.[0]?.url || 'https://via.placeholder.com/150?text=Personalizado',
      sale_type: saleType,
      consumables: isCustomProductMode && customConsumables.length > 0 ? [...customConsumables] : undefined
    };

    setOrderItems([...orderItems, newItem]);
    
    // Resetear selección para agregar otro
    setSelectedProduct(null);
    setCustomNameItem('');
    setQuantity(1);
    setCustomPrice('');
    setCustomConsumables([]);
    setTempMaterial('');
    setTempMaterialQty(1);
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

      // Concatenar datos de facturación si los hay para evitar crash por columnas inexistentes
      if (isFacturado || billingDni || invoiceNumber) {
        finalNotes += `\n[FACTURACIÓN: ${billingType || 'A/B/C'} | DNI/CUIT: ${billingDni || 'N/A'} | N°: ${invoiceNumber || 'Pendiente'}]`;
      }

      // Payload base
      const commonData = {
        customer_name: customerName,
        customer_email: (initialOrder as any)?.customer_email || 'manual@ventas.local', 
        customer_phone: customerPhone || 'Sin teléfono',
        items: orderItems,
        subtotal: orderTotal,
        shipping_cost: 0,
        total: orderTotal,
        shipping_method: 'retiro' as ShippingMethod,
        notes: finalNotes,
        status: status, // Forzamos el estado calculado
      };

      if (initialOrder) {
        // === MODO EDICIÓN ===
        const result = await updateOrder(initialOrder.id, commonData);
        if (result.error) throw result.error;
        // Eliminado registro de pago en edición (se maneja desde panel principal)
        
        toast.success('¡Orden actualizada correctamente!');
        // NOTA: No descontamos stock en edición para evitar duplicados complejos.
      } else {
        // === MODO CREACIÓN ===
        const result = await createOrder(commonData);
        if (result.error) throw result.error;
        
        // Registrar pago inicial
        if (pay > 0 && result.data) {
          const { addPayment } = await import('../services/orderService');
          await addPayment({
            order_id: result.data.id,
            amount: pay,
            method: payMethod,
            date: new Date().toISOString(),
            notes: 'Pago inicial'
          });
        }

        // Stock solo se descuenta en creación
        for (const item of orderItems) {
          if (item.product_id) {
            await updateStock(item.product_id, item.quantity);
          }
        }
        
        if (result.data && status !== 'pending') {
           const { updateOrderStatus } = await import('../services/orderService');
           await updateOrderStatus(result.data.id, status);
        }

        // --- NEW AFIP LOGIC ---
        if (result.data && isFacturado && remainingBalance === 0) {
           toast.info('Venta creada. Entablando conexión con ARCA...');
           try {
              const res = await fetch('/api/afip', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  action: 'create-invoice',
                  orderData: {
                    id: result.data.id,
                    total: orderTotal,
                    docTipo: billingDni ? (billingDni.length > 8 ? 80 : 96) : 99, 
                    docNro: billingDni || 0
                  }
                })
              });
              const afipResult = await res.json();
              if (res.ok && afipResult.success) {
                 const { supabase } = await import('../services/supabaseService');
                 await (supabase.from('orders') as any).update({ 
                    is_invoiced: true,
                    billing_dni_cuit: billingDni,
                    billing_type: billingType,
                    invoice_number: `Nº${afipResult.cbte_number}`,
                    notes: finalNotes + `\n[FACTURA C EMITIDA: Nº${afipResult.cbte_number} - CAE: ${afipResult.cae} - VTO: ${afipResult.cae_vto}]`
                 }).eq('id', result.data.id);
                 toast.success(`¡Factura C Oficial Nº${afipResult.cbte_number} emitida con éxito!`);
              } else {
                 toast.error('La orden se guardó PERO falló ARCA: ' + (afipResult.error || 'Autenticación fallida'));
              }
           } catch (e) {
              toast.error('La orden se guardó PERO hubo un error de conexión con AFIP');
           }
        } else {
           toast.success('¡Venta registrada y stock actualizado al instante!');
        }
      }

      onOrderCreated(); // Refrescar lista
      onClose(); 

    } catch (error: any) {
      console.error('Error al guardar orden:', error);
      toast.error('Error al guardar: ' + (error.message || 'Desconocido'));
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
          <button title="Cerrar" onClick={onClose} className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-full transition-colors">
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
            
            {/* Buscador o Producto Personalizado */}
            <div className="space-y-4 relative">
              <div className="flex justify-between items-center bg-slate-50 p-1 rounded-lg border border-slate-200">
                <button 
                  type="button" 
                  onClick={() => { setIsCustomProductMode(false); setSelectedProduct(null); }}
                  className={`flex-1 py-1 px-2 rounded-md transition-all text-xs font-bold ${!isCustomProductMode ? 'bg-white shadow-sm text-emerald-700' : 'text-slate-500'}`}
                >
                  Catálogo
                </button>
                <button 
                  type="button" 
                  onClick={() => { setIsCustomProductMode(true); setSelectedProduct(null); }}
                  className={`flex-1 py-1 px-2 rounded-md transition-all text-xs font-bold ${isCustomProductMode ? 'bg-white shadow-sm text-blue-700' : 'text-slate-500'}`}
                >
                  Personalizado (Especial)
                </button>
              </div>

              {!isCustomProductMode ? (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-700">Buscar en el Catálogo</label>
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
                      <button title="Quitar producto seleccionado" type="button" onClick={() => setSelectedProduct(null)} className="text-slate-400 hover:text-red-500 p-1 bg-white rounded-full shadow-xs">
                        <X size={16} />
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4 bg-blue-50/50 p-4 rounded-xl border border-blue-100 animate-in zoom-in-95 duration-200">
                   <div>
                    <label className="block text-xs font-bold text-blue-700 uppercase mb-1">Nombre del Producto Especial</label>
                    <input 
                      type="text" 
                      placeholder="Ej: Llavero personalizado x50" 
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden bg-white text-sm"
                      value={customNameItem}
                      onChange={(e) => setCustomNameItem(e.target.value)}
                    />
                   </div>
                   <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-blue-700 uppercase mb-1">Cantidad</label>
                        <input 
                          title="Cantidad personalizada"
                          type="number" 
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden bg-white text-sm"
                          value={quantity}
                          onChange={(e) => setQuantity(Number(e.target.value))}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-blue-700 uppercase mb-1">Precio Total</label>
                        <div className="relative">
                          <DollarSign className="absolute left-2 top-2.5 text-blue-500" size={14} />
                          <input 
                            title="Precio personalizado total"
                            type="number" 
                            className="w-full pl-6 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden bg-white text-sm font-bold"
                            value={customPrice}
                            onChange={(e) => setCustomPrice(e.target.value)}
                          />
                        </div>
                      </div>
                   </div>

                   {/* Selectores de Tipo de Venta para Personalizado */}
                   <div className="flex gap-2 p-1 bg-blue-100/50 rounded-lg">
                        <button 
                            type="button"
                            onClick={() => setSaleType('retail')}
                            className={`flex-1 py-1 text-[10px] font-bold rounded-md transition-all ${saleType === 'retail' ? 'bg-white text-blue-700 shadow-xs' : 'text-blue-400 hover:text-blue-600'}`}
                        >
                            Minorista
                        </button>
                        <button 
                            type="button"
                            onClick={() => setSaleType('pack')}
                            className={`flex-1 py-1 text-[10px] font-bold rounded-md transition-all ${saleType === 'pack' ? 'bg-white text-blue-700 shadow-xs' : 'text-blue-400 hover:text-blue-600'}`}
                        >
                            Pack
                        </button>
                        <button 
                            type="button"
                            onClick={() => setSaleType('wholesale')}
                            className={`flex-1 py-1 text-[10px] font-bold rounded-md transition-all ${saleType === 'wholesale' ? 'bg-white text-blue-700 shadow-xs' : 'text-blue-400 hover:text-blue-600'}`}
                        >
                            Mayorista
                        </button>
                   </div>
                   
                   {/* Sección Consumibles / Insumos Dinámicos */}
                   <div className="bg-white p-3 rounded-lg border border-blue-100 shadow-sm mt-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1 mb-2">
                        <Package size={12}/> Insumos a descontar (por unidad)
                      </label>
                      
                      {customConsumables.map((c, i) => (
                          <div key={i} className="flex justify-between items-center bg-slate-50 p-2 rounded mb-1 border border-slate-100 text-xs">
                             <span><b className="text-slate-700">{c.material}</b> x{c.quantity}</span>
                             <button title="Quitar insumo" type="button" onClick={() => setCustomConsumables(prev => prev.filter((_, idx) => idx !== i))} className="text-red-500 hover:text-red-700 p-1"><X size={12}/></button>
                          </div>
                      ))}

                      <div className="flex flex-col sm:flex-row gap-2 mt-2">
                         <select 
                            title="Elegir Insumo"
                            className="flex-1 p-1.5 text-xs border border-slate-200 rounded focus:ring-1 focus:ring-blue-500 bg-slate-50"
                            value={tempMaterial}
                            onChange={e => setTempMaterial(e.target.value)}
                         >
                            <option value="">Seleccionar insumo...</option>
                            {availableMaterials.map(m => (
                              <option key={m.id} value={m.name}>{m.name} ({m.category})</option>
                            ))}
                         </select>
                         <input 
                            title="Cantidad de insumo"
                            type="number" 
                            min="0.1"
                            step="any"
                            className="w-16 p-1.5 text-xs border border-slate-200 rounded text-center focus:ring-1 focus:ring-blue-500 bg-slate-50"
                            value={tempMaterialQty}
                            onChange={e => setTempMaterialQty(Number(e.target.value) || 1)}
                         />
                         <button 
                            type="button" 
                            className="bg-blue-100 hover:bg-blue-200 text-blue-700 px-3 py-1.5 rounded text-xs font-bold transition-colors"
                            onClick={() => {
                               if (tempMaterial && tempMaterialQty > 0) {
                                  setCustomConsumables(prev => [...prev, { material: tempMaterial, quantity: tempMaterialQty }]);
                                  setTempMaterial('');
                                  setTempMaterialQty(1);
                               }
                            }}
                         >
                            Añadir
                         </button>
                      </div>
                   </div>

                   <button
                    type="button"
                    onClick={handleAddItem}
                    disabled={!customNameItem}
                    className="w-full py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
                  >
                    <Plus size={18} /> Agregar Trabajo Especial
                  </button>
                </div>
              )}
            </div>

            {/* Controles de Cantidad y Precio (Solo visibles si hay producto de CATÁLOGO seleccionado) */}
            {selectedProduct && !isCustomProductMode && (
              <div className="bg-slate-50 p-4 rounded-xl space-y-4 animate-in fade-in slide-in-from-top-2 border border-slate-100">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Cantidad</label>
                    <input
                      title="Elegir cantidad de producto"
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
                        title="Precio modificado"
                        type="number"
                        className="w-full pl-6 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-hidden font-bold text-slate-900 bg-white"
                        value={customPrice}
                        onChange={(e) => setCustomPrice(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* Selectores de Tipo de Venta */}
                <div className="flex gap-2 p-1 bg-slate-200 rounded-lg">
                   {selectedProduct.unitEnabled !== false && (
                    <button 
                      type="button"
                      onClick={() => { setSaleType('retail'); setQuantity(1); }}
                      className={`flex-1 py-1 text-xs font-bold rounded-md transition-all ${saleType === 'retail' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      Unidad
                    </button>
                   )}
                   {selectedProduct.packEnabled && (
                    <button 
                      type="button"
                      onClick={() => { setSaleType('pack'); setQuantity(selectedProduct.unitsPerPack || 2); }}
                      className={`flex-1 py-1 text-xs font-bold rounded-md transition-all ${saleType === 'pack' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      Pack x{selectedProduct.unitsPerPack}
                    </button>
                   )}
                   {selectedProduct.mayoristaEnabled && (
                    <button 
                      type="button"
                      onClick={() => { setSaleType('wholesale'); setQuantity(selectedProduct.wholesaleUnits || 12); }}
                      className={`flex-1 py-1 text-xs font-bold rounded-md transition-all ${saleType === 'wholesale' ? 'bg-white text-purple-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      Mayorista
                    </button>
                   )}
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
                         <button title="Quitar item del pedido" onClick={() => handleRemoveItem(idx)} className="text-slate-300 hover:text-red-500 transition-colors p-1 hover:bg-red-50 rounded-md">
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
               
               {/* MATERIALES DE EMPAQUE (Rápido) */}
               <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 mt-4">
                  <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1 mb-2">
                    <Package size={12}/> Envases / Materiales de Despacho
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2">
                     <select 
                        title="Seleccionar material de despachado"
                        className="flex-1 p-1.5 text-xs border border-slate-200 rounded focus:ring-1 focus:ring-emerald-500 bg-white"
                        value={packMaterial}
                        onChange={e => setPackMaterial(e.target.value)}
                     >
                        <option value="">Añadir bolsa, caja, cinta...</option>
                        {availableMaterials.filter(m => m.category === 'Insumos' || m.category === 'Otros').map(m => (
                          <option key={m.id} value={m.name}>{m.name} (Stock: {m.quantity})</option>
                        ))}
                     </select>
                     <input 
                        type="number" 
                        min="1"
                        step="1"
                        className="w-16 p-1.5 text-xs border border-slate-200 rounded text-center focus:ring-1 focus:ring-emerald-500 bg-white"
                        value={packMaterialQty}
                        onChange={e => setPackMaterialQty(Number(e.target.value) || 1)}
                        title="Cantidad"
                     />
                     <button 
                        type="button" 
                        className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-3 py-1.5 rounded text-xs font-bold transition-colors"
                        onClick={() => {
                           if (packMaterial && packMaterialQty > 0) {
                              const existIndex = orderItems.findIndex(i => i.name === `[EMPAQUE] ${packMaterial}`);
                              if (existIndex >= 0) {
                                  const updated = [...orderItems];
                                  updated[existIndex].quantity += packMaterialQty;
                                  // As consumables deduction multiplies by item quantity, we leave the consumable quantity at 1.
                                  setOrderItems(updated);
                              } else {
                                  const newItem = {
                                      product_id: 0,
                                      name: `[EMPAQUE] ${packMaterial}`,
                                      price: 0,
                                      quantity: packMaterialQty,
                                      image: 'https://via.placeholder.com/150/f8fafc/94a3b8?text=Empaque',
                                      consumables: [{ material: packMaterial, quantity: 1 }]
                                  };
                                  setOrderItems([...orderItems, newItem]);
                              }
                              setPackMaterial('');
                              setPackMaterialQty(1);
                           }
                        }}
                     >
                        Sumar
                     </button>
                  </div>
               </div>
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
                      {!initialOrder && (
                        <>
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

                          {/* Medio de Pago */}
                          <div>
                              <label className="block text-xs font-bold text-blue-700 uppercase mb-1">Medio</label>
                              <select 
                                title="Seleccionar medio de pago"
                                value={payMethod} 
                                onChange={e => setPayMethod(e.target.value as any)} 
                                className="w-full px-3 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden text-sm font-medium text-slate-700 bg-white"
                              >
                                <option value="efectivo">Efectivo</option>
                                <option value="transferencia">Transf.</option>
                                <option value="mercadopago">MP</option>
                                <option value="otro">Otro</option>
                              </select>
                          </div>
                        </>
                      )}
                      
                      {initialOrder && (
                        <div className="col-span-2 bg-white/50 p-3 rounded-lg border border-blue-200 text-xs text-blue-800 font-medium">
                          <AlertCircle className="inline mr-1" size={14} />
                          Para modificar los pagos abonados (eliminar o registrar nuevos cobros), utiliza el <b>Historial de Pagos</b> en el panel principal.
                        </div>
                      )}

                      {/* Campo Fecha Entrega */}
                      <div className="col-span-2">
                          <label className="block text-xs font-bold text-blue-700 uppercase mb-1">Fecha Entrega</label>
                          <input 
                              title="Fecha del despacho"
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

               {/* SECCIÓN FISCAL - NUEVO */}
               <div className={`p-4 rounded-xl border space-y-3 ${remainingBalance > 0 ? 'bg-slate-50 border-slate-200 opacity-70' : 'bg-emerald-50 border-emerald-100'}`}>
                  <div className="flex items-center justify-between mb-1">
                      <div className="flex flex-col">
                        <span className={`text-xs font-bold uppercase flex items-center gap-1 ${remainingBalance > 0 ? 'text-slate-500' : 'text-emerald-800'}`}>
                          <Calculator size={14}/> Datos para Facturar (ARCA)
                        </span>
                        {remainingBalance > 0 && <span className="text-[9px] text-red-500 font-bold mt-0.5">La factura AFIP se bloquea si hay saldo pendiente.</span>}
                      </div>
                      <button 
                        type="button"
                        disabled={remainingBalance > 0}
                        onClick={() => setIsFacturado(!isFacturado)}
                        className={`w-10 h-5 rounded-full transition-colors relative ${remainingBalance > 0 ? 'bg-slate-200 cursor-not-allowed' : (isFacturado ? 'bg-emerald-600' : 'bg-slate-300')}`}
                        title={remainingBalance > 0 ? "No podés facturar con deuda" : "Marcar como facturado ya mismo"}
                      >
                         <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${(isFacturado && remainingBalance === 0) ? 'left-6' : 'left-1'}`} />
                      </button>
                  </div>

                  <div className="space-y-2">
                     <div className="flex gap-2">
                        <input 
                           title="Ingresar DNI/CUIT"
                           type="text" 
                           placeholder="DNI / CUIT del Cliente" 
                           className="flex-1 px-3 py-2 border border-emerald-200 rounded-lg focus:ring-2 focus:ring-emerald-500 bg-white text-xs font-mono"
                           value={billingDni}
                           onChange={e => setBillingDni(e.target.value)}
                        />
                        <select title="Tipo de Factura" 
                           className="w-24 px-2 py-2 border border-emerald-200 rounded-lg focus:ring-2 focus:ring-emerald-500 bg-white text-[10px] font-bold"
                           value={billingType}
                           onChange={e => setBillingType(e.target.value as any)}
                        >
                           <option value="Consumidor Final">C. Final</option>
                           <option value="B">Fact. B</option>
                           <option value="C">Fact. C</option>
                           <option value="A">Fact. A</option>
                        </select>
                     </div>
                     {isFacturado && (
                        <div className="animate-in fade-in slide-in-from-top-1">
                           <label className="block text-[9px] font-bold text-emerald-600 uppercase mb-1">Número de Factura emitida</label>
                           <input 
                              type="text" 
                              placeholder="0000X-000000XX" 
                              className="w-full px-3 py-2 border border-emerald-300 rounded-lg focus:ring-2 focus:ring-emerald-500 bg-white text-xs font-bold font-mono"
                              value={invoiceNumber}
                              onChange={e => setInvoiceNumber(e.target.value)}
                           />
                        </div>
                     )}
                  </div>
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
                    <Check size={20} className="stroke-3" /> Registrar Venta Final (${orderTotal.toLocaleString('es-AR')})
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
