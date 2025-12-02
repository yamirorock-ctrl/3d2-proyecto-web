import React, { useState } from 'react';
import { X, CreditCard, Banknote, DollarSign, MapPin, FileText, CheckCircle } from 'lucide-react';
import { CartItem, Order } from '../types';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  total: number;
  onConfirmOrder: (order: Order) => void;
}

const CheckoutModal: React.FC<CheckoutModalProps> = ({ 
  isOpen, 
  onClose, 
  items, 
  total,
  onConfirmOrder 
}) => {
  const [step, setStep] = useState<'form' | 'success'>('form');
  const [formData, setFormData] = useState({
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    address: '',
    notes: '',
    paymentMethod: 'transferencia' as 'transferencia' | 'efectivo' | 'mercadopago',
    shippingMethod: 'retiro' as 'caba' | 'gba' | 'retiro',
    shippingCost: 0
  });

  // Calcular si aplica envío gratis
  const freeShippingThreshold = 50000;
  const qualifiesForFreeShipping = total >= freeShippingThreshold;
  
  // Calcular total con envío
  const shippingCost = formData.shippingMethod === 'retiro' || qualifiesForFreeShipping ? 0 : formData.shippingCost;
  const finalTotal = total + shippingCost;

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.customerName || !formData.customerEmail || !formData.customerPhone) {
      alert('Por favor completa todos los campos obligatorios');
      return;
    }

    // Validar dirección si eligió envío
    if ((formData.shippingMethod === 'caba' || formData.shippingMethod === 'gba') && !formData.address) {
      alert('Por favor ingresa tu dirección de envío');
      return;
    }

    // Validar costo de envío si eligió envío y no es gratis
    if ((formData.shippingMethod === 'caba' || formData.shippingMethod === 'gba') && !qualifiesForFreeShipping && formData.shippingCost === 0) {
      alert('Por favor ingresa el costo de envío calculado');
      return;
    }

    const order: Order = {
      id: `ORD-${Date.now()}`,
      customerName: formData.customerName,
      customerEmail: formData.customerEmail,
      customerPhone: formData.customerPhone,
      items: items,
      total: finalTotal,
      paymentMethod: formData.paymentMethod,
      shippingMethod: formData.shippingMethod,
      shippingCost: shippingCost,
      status: 'pendiente',
      timestamp: new Date().toISOString(),
      address: formData.address || undefined,
      notes: formData.notes || undefined
    };

    onConfirmOrder(order);
    setStep('success');
    
    // Reset form after 3 seconds and close
    setTimeout(() => {
      setStep('form');
      setFormData({
        customerName: '',
        customerEmail: '',
        customerPhone: '',
        address: '',
        notes: '',
        paymentMethod: 'transferencia',
        shippingMethod: 'retiro',
        shippingCost: 0
      });
      onClose();
    }, 5000); // 5 segundos para leer los datos de pago
  };

  const paymentMethods = [
    { 
      id: 'transferencia', 
      name: 'Transferencia Bancaria', 
      icon: <CreditCard size={20} />,
      description: 'Te enviaremos los datos bancarios'
    },
    { 
      id: 'efectivo', 
      name: 'Efectivo', 
      icon: <Banknote size={20} />,
      description: 'Pago al retirar/recibir'
    },
    { 
      id: 'mercadopago', 
      name: 'MercadoPago', 
      icon: <DollarSign size={20} />,
      description: 'Te enviaremos el link de pago'
    }
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-2 sm:p-4">
        {/* Overlay */}
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" 
          onClick={onClose}
        />

        {/* Modal */}
        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-[95vw] sm:max-w-lg lg:max-w-2xl max-h-[90vh] overflow-y-auto">
          
          {step === 'form' ? (
            <>
              {/* Header */}
              <div className="sticky top-0 bg-white border-b px-4 sm:px-6 py-3 sm:py-4 flex justify-between items-center">
                <h2 className="text-lg sm:text-2xl font-bold text-slate-900">Finalizar Pedido</h2>
                <button 
                  onClick={onClose}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 sm:space-y-6">
                
                {/* Order Summary */}
                <div className="bg-slate-50 rounded-xl p-4">
                  <h3 className="font-bold text-slate-900 mb-3">Resumen del Pedido</h3>
                  <div className="space-y-2 mb-4">
                    {items.map(item => (
                      <div key={item.id} className="flex justify-between text-sm">
                        <span className="text-slate-600">{item.name} x{item.quantity}</span>
                        <span className="font-medium">${(item.price * item.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="border-t pt-3 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Subtotal</span>
                      <span className="font-medium">${total.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Envío</span>
                      <span className="font-medium">
                        {shippingCost === 0 ? (
                          <span className="text-green-600">GRATIS</span>
                        ) : (
                          `$${shippingCost.toFixed(2)}`
                        )}
                      </span>
                    </div>
                    <div className="border-t pt-2 flex justify-between text-lg font-bold">
                      <span>Total</span>
                      <span className="text-indigo-600">${finalTotal.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Customer Info */}
                <div className="space-y-4">
                  <h3 className="font-bold text-slate-900">Información de Contacto</h3>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Nombre Completo <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.customerName}
                      onChange={(e) => setFormData({...formData, customerName: e.target.value})}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="Juan Pérez"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Email <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      value={formData.customerEmail}
                      onChange={(e) => setFormData({...formData, customerEmail: e.target.value})}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="tu@email.com"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Teléfono <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      value={formData.customerPhone}
                      onChange={(e) => setFormData({...formData, customerPhone: e.target.value})}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="+54 11 1234-5678"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
                      <MapPin size={16} />
                      Dirección de Envío (opcional)
                    </label>
                    <input
                      type="text"
                      value={formData.address}
                      onChange={(e) => setFormData({...formData, address: e.target.value})}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="Calle 123, Ciudad"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
                      <FileText size={16} />
                      Notas adicionales (opcional)
                    </label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({...formData, notes: e.target.value})}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                      rows={3}
                      placeholder="Detalles especiales sobre tu pedido..."
                    />
                  </div>
                </div>

                {/* Shipping Method */}
                <div className="space-y-4">
                  <h3 className="font-bold text-slate-900">Método de Envío</h3>
                  <div className="grid gap-3">
                    <label
                      className={`relative flex items-start gap-4 p-4 border-2 rounded-xl cursor-pointer transition-all ${
                        formData.shippingMethod === 'retiro'
                          ? 'border-indigo-600 bg-indigo-50'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="shippingMethod"
                        value="retiro"
                        checked={formData.shippingMethod === 'retiro'}
                        onChange={(e) => setFormData({...formData, shippingMethod: 'retiro', shippingCost: 0})}
                        className="sr-only"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-slate-900">Retiro en Punto</div>
                        <div className="text-sm text-slate-500">Coordinas con nosotros el punto de encuentro</div>
                        <div className="text-sm font-medium text-green-600 mt-1">GRATIS</div>
                      </div>
                      {formData.shippingMethod === 'retiro' && (
                        <CheckCircle size={20} className="text-indigo-600" />
                      )}
                    </label>

                    <label
                      className={`relative flex items-start gap-4 p-4 border-2 rounded-xl cursor-pointer transition-all ${
                        formData.shippingMethod === 'caba'
                          ? 'border-indigo-600 bg-indigo-50'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="shippingMethod"
                        value="caba"
                        checked={formData.shippingMethod === 'caba'}
                        onChange={(e) => setFormData({...formData, shippingMethod: 'caba'})}
                        className="sr-only"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-slate-900">Envío a CABA</div>
                        <div className="text-sm text-slate-500">Entrega a domicilio en Capital Federal</div>
                        {qualifiesForFreeShipping ? (
                          <div className="text-sm font-medium text-green-600 mt-1">GRATIS (compra mayor a $50.000)</div>
                        ) : (
                          <div className="text-sm text-slate-600 mt-1">Costo calculado por logística</div>
                        )}
                      </div>
                      {formData.shippingMethod === 'caba' && (
                        <CheckCircle size={20} className="text-indigo-600" />
                      )}
                    </label>

                    <label
                      className={`relative flex items-start gap-4 p-4 border-2 rounded-xl cursor-pointer transition-all ${
                        formData.shippingMethod === 'gba'
                          ? 'border-indigo-600 bg-indigo-50'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="shippingMethod"
                        value="gba"
                        checked={formData.shippingMethod === 'gba'}
                        onChange={(e) => setFormData({...formData, shippingMethod: 'gba'})}
                        className="sr-only"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-slate-900">Envío a GBA</div>
                        <div className="text-sm text-slate-500">Entrega a domicilio en Gran Buenos Aires</div>
                        {qualifiesForFreeShipping ? (
                          <div className="text-sm font-medium text-green-600 mt-1">GRATIS (compra mayor a $50.000)</div>
                        ) : (
                          <div className="text-sm text-slate-600 mt-1">Costo calculado por logística</div>
                        )}
                      </div>
                      {formData.shippingMethod === 'gba' && (
                        <CheckCircle size={20} className="text-indigo-600" />
                      )}
                    </label>
                  </div>

                  {/* Campo para ingresar costo de envío si no es gratis ni retiro */}
                  {(formData.shippingMethod === 'caba' || formData.shippingMethod === 'gba') && !qualifiesForFreeShipping && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <p className="text-sm text-yellow-800 mb-2">
                        <strong>Importante:</strong> Te contactaremos para calcular el costo exacto del envío según tu ubicación. 
                        Si ya lo coordinaste, ingresa el monto:
                      </p>
                      <input
                        type="number"
                        min="0"
                        value={formData.shippingCost || ''}
                        onChange={(e) => setFormData({...formData, shippingCost: parseFloat(e.target.value) || 0})}
                        className="w-full px-4 py-2 border border-yellow-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
                        placeholder="Costo de envío (opcional por ahora)"
                      />
                    </div>
                  )}
                  
                  {qualifiesForFreeShipping && formData.shippingMethod !== 'retiro' && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2">
                      <CheckCircle size={18} className="text-green-600" />
                      <p className="text-sm text-green-800">
                        <strong>¡Felicitaciones!</strong> Tu compra califica para envío gratis
                      </p>
                    </div>
                  )}

                  <p className="text-xs text-slate-500">
                    📦 Preparación: 24hs • Envío coordinado con logística
                  </p>
                </div>

                {/* Payment Method */}
                <div className="space-y-4">
                  <h3 className="font-bold text-slate-900">Método de Pago</h3>
                  <div className="grid gap-3">
                    {paymentMethods.map(method => (
                      <label
                        key={method.id}
                        className={`relative flex items-center gap-4 p-4 border-2 rounded-xl cursor-pointer transition-all ${
                          formData.paymentMethod === method.id
                            ? 'border-indigo-600 bg-indigo-50'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name="paymentMethod"
                          value={method.id}
                          checked={formData.paymentMethod === method.id}
                          onChange={(e) => setFormData({...formData, paymentMethod: e.target.value as any})}
                          className="sr-only"
                        />
                        <div className={`flex-shrink-0 ${formData.paymentMethod === method.id ? 'text-indigo-600' : 'text-slate-400'}`}>
                          {method.icon}
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-slate-900">{method.name}</div>
                          <div className="text-sm text-slate-500">{method.description}</div>
                        </div>
                        {formData.paymentMethod === method.id && (
                          <CheckCircle size={20} className="text-indigo-600" />
                        )}
                      </label>
                    ))}
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-indigo-700 transition-all shadow-lg hover:shadow-xl active:scale-[0.98]"
                >
                  Confirmar Pedido
                </button>
              </form>
            </>
          ) : (
            /* Success State */
            <div className="p-8">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle size={40} className="text-green-600" />
              </div>
              <h2 className="text-3xl font-bold text-slate-900 mb-4 text-center">¡Pedido Confirmado!</h2>
              <p className="text-slate-600 mb-6 text-center">
                Gracias por tu compra. Te contactaremos pronto a <strong>{formData.customerEmail}</strong>
              </p>

              {/* Datos de Pago */}
              <div className="bg-indigo-50 border-2 border-indigo-200 rounded-xl p-6 mb-6">
                <h3 className="font-bold text-indigo-900 mb-4 text-lg flex items-center gap-2">
                  <CreditCard size={20} />
                  Datos para {formData.paymentMethod === 'transferencia' ? 'Transferencia' : formData.paymentMethod === 'mercadopago' ? 'MercadoPago' : 'el Pago'}
                </h3>
                
                {formData.paymentMethod === 'transferencia' && (
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between border-b border-indigo-200 pb-2">
                      <span className="text-slate-600 font-medium">Banco:</span>
                      <span className="font-bold text-slate-900">Banco Provincia</span>
                    </div>
                    <div className="flex justify-between border-b border-indigo-200 pb-2">
                      <span className="text-slate-600 font-medium">Tipo:</span>
                      <span className="font-bold text-slate-900">Caja de Ahorro</span>
                    </div>
                    <div className="flex justify-between border-b border-indigo-200 pb-2">
                      <span className="text-slate-600 font-medium">CBU:</span>
                      <span className="font-mono font-bold text-slate-900">0140058803500158646826</span>
                    </div>
                    <div className="flex justify-between border-b border-indigo-200 pb-2">
                      <span className="text-slate-600 font-medium">Alias:</span>
                      <span className="font-mono font-bold text-slate-900">rock.ciclos.soda</span>
                    </div>
                    <div className="flex justify-between border-b border-indigo-200 pb-2">
                      <span className="text-slate-600 font-medium">Titular:</span>
                      <span className="font-bold text-slate-900">Yamil Sanchez</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600 font-medium">CUIL:</span>
                      <span className="font-mono font-bold text-slate-900">20-33286626-6</span>
                    </div>
                  </div>
                )}

                {formData.paymentMethod === 'mercadopago' && (
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between border-b border-indigo-200 pb-2">
                      <span className="text-slate-600 font-medium">Alias:</span>
                      <span className="font-mono font-bold text-slate-900">yamiro.rock</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600 font-medium">CVU:</span>
                      <span className="font-mono font-bold text-slate-900 text-xs">0000003100081752940884</span>
                    </div>
                    <div className="bg-white rounded-lg p-3 mt-3">
                      <p className="text-xs text-slate-600">
                        También te enviaremos un link de pago directo por email
                      </p>
                    </div>
                  </div>
                )}

                {formData.paymentMethod === 'efectivo' && (
                  <p className="text-sm text-slate-700">
                    Coordinaremos contigo el punto de encuentro para el pago en efectivo y la entrega del producto.
                  </p>
                )}
              </div>

              {/* Info de envío */}
              <div className="bg-slate-50 rounded-xl p-4 mb-4">
                <p className="text-sm text-slate-700">
                  <strong>Envío:</strong> {
                    formData.shippingMethod === 'retiro' ? 'Retiro coordinado' :
                    formData.shippingMethod === 'caba' ? 'Envío a CABA' :
                    'Envío a GBA'
                  }
                  {shippingCost === 0 && ' - GRATIS'}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  📦 Preparación: 24hs • Te contactaremos para coordinar
                </p>
              </div>

              <p className="text-xs text-slate-500 text-center">
                Recibirás un email con toda esta información
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CheckoutModal;
