import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, MapPin, Truck, Store, Package, CreditCard } from 'lucide-react';
import { CartItem, ShippingMethod } from '../types';
import { createOrder, calculateShippingCost, getShippingConfig } from '../services/orderService';
import { estimateProductWeight } from '../services/weightEstimator';
import { createPaymentPreference } from '../services/mercadoPagoService';

interface CheckoutProps {
  cart: CartItem[];
  onClearCart: () => void;
}

// Dimensiones estándar para productos 3D y láser (estimaciones realistas)
const PRODUCT_DIMENSIONS = {
  '3D': { width: 12, height: 12, length: 15, weight: 150 },      // Figura 3D pequeña/mediana
  'Láser': { width: 20, height: 0.5, length: 25, weight: 100 },  // Producto plano de corte láser
  'default': { width: 15, height: 10, length: 20, weight: 200 }  // Por defecto si no tiene tecnología
};

const PROVINCIAS_ARGENTINA = [
  'Buenos Aires',
  'CABA',
  'Catamarca',
  'Chaco',
  'Chubut',
  'Córdoba',
  'Corrientes',
  'Entre Ríos',
  'Formosa',
  'Jujuy',
  'La Pampa',
  'La Rioja',
  'Mendoza',
  'Misiones',
  'Neuquén',
  'Río Negro',
  'Salta',
  'San Juan',
  'San Luis',
  'Santa Cruz',
  'Santa Fe',
  'Santiago del Estero',
  'Tierra del Fuego',
  'Tucumán',
];

const Checkout: React.FC<CheckoutProps> = ({ cart, onClearCart }) => {
  const navigate = useNavigate();
  
  // Estado del formulario
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerProvince, setCustomerProvince] = useState('');
  const [customerCity, setCustomerCity] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerPostalCode, setCustomerPostalCode] = useState('');
  const [notes, setNotes] = useState('');
  
  // Estado de envío
  const [shippingMethod, setShippingMethod] = useState<ShippingMethod | ''>('');
  const [shippingCost, setShippingCost] = useState(0);
  const [shippingConfig, setShippingConfig] = useState<any>(null);
  const [mlShippingCost, setMlShippingCost] = useState<number | null>(null);
  const [mlShippingLoading, setMlShippingLoading] = useState(false);
  const [mlEstimatedDelivery, setMlEstimatedDelivery] = useState<string | null>(null);
  
  // Estado de facturación (Nuevo)
  const [billingType, setBillingType] = useState<'Consumidor Final' | 'Factura A' | 'Factura B'>('Consumidor Final');
  const [billingDni, setBillingDni] = useState('');

  // Estado de procesamiento
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');

  const subtotal = useMemo(() => cart.reduce((sum, item) => sum + item.price * item.quantity, 0), [cart]);
  const total = subtotal + shippingCost;
  useEffect(() => {
    console.log('[CHECKOUT] subtotal=', subtotal, 'shippingCost=', shippingCost, 'total=', total);
  }, [subtotal, shippingCost, total]);

  const isBuenosAires = customerProvince === 'Buenos Aires' || customerProvince === 'CABA';

  // Cargar configuración de envíos
  useEffect(() => {
    const loadConfig = async () => {
      const config = await getShippingConfig();
      setShippingConfig(config);
    };
    loadConfig();
  }, []);

  // Calcular costo de envío cuando cambia el método
  useEffect(() => {
    const updateShippingCost = async () => {
      if (!shippingMethod) {
        setShippingCost(0);
        return;
      }

      // Si es correo (ML), usar costo cotizado dinámicamente
      if (shippingMethod === 'correo') {
        if (mlShippingCost !== null) {
          console.log('[CHECKOUT] Using ML quoted cost:', mlShippingCost);
          setShippingCost(mlShippingCost);
        } else {
          setShippingCost(0);
        }
        return;
      }

      if (shippingConfig) {
        const cost = await calculateShippingCost(shippingConfig, shippingMethod, subtotal);
        console.log('[CHECKOUT] setShippingCost=', cost);
        setShippingCost(cost);
      }
    };

    updateShippingCost();
  }, [shippingMethod, subtotal, mlShippingCost]);

  // Cotizar envío ML cuando el usuario ingresa código postal y selecciona correo
  // Force shippingMethod to 'correo'
  useEffect(() => {
    setShippingMethod('correo');
  }, []);

  useEffect(() => {
    // Para envío a convenir / pago en destino, el costo en el carrito es 0
    if (shippingMethod === 'correo') {
      setMlShippingCost(0);
      setMlEstimatedDelivery(null);
      setMlShippingLoading(false);
    }
  }, [shippingMethod, customerPostalCode]);

  // Permitir envíos a todo el país (MercadoEnvíos cotiza interior)
  useEffect(() => {
    // No forzar método de envío por provincia
  }, [isBuenosAires, shippingMethod]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validaciones
    if (!customerName || !customerEmail || !customerPhone || !customerProvince) {
      setError('Por favor completá todos los campos obligatorios');
      return;
    }

    if (!shippingMethod) {
      setError('Por favor seleccioná un método de envío');
      return;
    }

    if (shippingMethod && !customerAddress) {
      setError('Por favor ingresá tu dirección para el envío');
      return;
    }

    setIsProcessing(true);

    try {
      // Crear el pedido
      const orderItems = cart.map((item) => ({
        product_id: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        image: item.image,
      }));

      // Concatenar datos de facturación en las notas
      let finalNotes = notes || '';
      if (billingType || billingDni) {
        finalNotes += `\n[FACTURACIÓN: ${billingType} | DNI/CUIT: ${billingDni || 'NO DECLARADO'}]`;
      }

      const { data: order, error: orderError } = await createOrder({
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone,
        customer_address: customerAddress || undefined,
        customer_city: customerCity || undefined,
        customer_province: customerProvince,
        customer_postal_code: customerPostalCode || undefined,
        items: orderItems,
        subtotal,
        shipping_cost: shippingCost,
        total,
        shipping_method: shippingMethod,
        notes: finalNotes || undefined,
        status: 'payment_pending' as any,
      });


      if (orderError || !order) {
        setError('Error al crear el pedido. Por favor intentá nuevamente.');
        setIsProcessing(false);
        return;
      }

      // INTEGRACIÓN MERCADOPAGO: Crear preferencia y redirigir
      // Calculamos el string de dimensiones para ML (Ancho x Alto x Largo, Peso)
      const dimensions = `${Math.min(40, Math.ceil((subtotal > 0 ? 15 : 10)))}x${Math.min(30, Math.ceil(15))}x${Math.min(50, Math.ceil(20))},${Math.max(300, 500)}`;
      
      // Capturar Device ID para prevención de fraude
      const deviceId = (window as any).MP_DEVICE_SESSION_ID || '';

      const preferenceResult = await createPaymentPreference(
        order.id,
        order.order_number,
        orderItems,
        shippingCost,
        customerEmail,
        customerPostalCode || undefined,
        dimensions,
        deviceId
      );

      if (!preferenceResult) {
        // Fallback: Si no hay credenciales de MP, modo sandbox
        onClearCart();
        console.log('[SANDBOX] Pedido creado OK (sin MP):', order);
        alert('Pedido creado. MercadoPago no configurado, usando modo sandbox.');
        setIsProcessing(false);
        navigate(`/order-success?order_id=${order.id}`);
        return;
      }

      // Redirigir a MercadoPago
      console.log('[MP] Redirigiendo a checkout:', preferenceResult.initPoint);
      window.location.href = preferenceResult.initPoint;
    } catch (err) {
      console.error('Error al procesar el pedido:', err);
      setError('Ocurrió un error inesperado. Por favor intentá nuevamente.');
      setIsProcessing(false);
    }
  };

  if (cart.length === 0) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <ShoppingCart className="mx-auto text-gray-300" size={64} />
        <h2 className="text-2xl font-bold text-gray-900 mt-4">Tu carrito está vacío</h2>
        <p className="text-gray-600 mt-2">Agregá productos para continuar con la compra</p>
        <button
          onClick={() => navigate('/')}
          className="mt-6 bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700"
        >
          Ver Productos
        </button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Finalizar Compra</h1>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Formulario */}
        <div>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* SECCIÓN DATOS DE CONTACTO */}
            <div>
              <h2 className="text-xl font-semibold mb-4">Datos de Contacto</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre completo *
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Ej: Juan Pérez"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="customerEmail" className="block text-sm font-medium text-gray-700 mb-1">
                    Email *
                  </label>
                  <input
                    id="customerEmail"
                    title="Ingresar correo electrónico"
                    type="email"
                    placeholder="tucorreo@ejemplo.com"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Teléfono *
                  </label>
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="Ej: 1123456789"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="customerProvince" className="block text-sm font-medium text-gray-700 mb-1">
                    Provincia *
                  </label>
                  <select
                    id="customerProvince"
                    title="Selecciona una provincia"
                    value={customerProvince}
                    onChange={(e) => setCustomerProvince(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    required
                  >
                    <option value="">Seleccioná una provincia</option>
                    {PROVINCIAS_ARGENTINA.map((prov) => (
                      <option key={prov} value={prov}>
                        {prov}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Localidad {shippingMethod === 'correo' && <span className="text-red-500">*</span>}
                  </label>
                  <input
                    type="text"
                    value={customerCity}
                    onChange={(e) => setCustomerCity(e.target.value)}
                    placeholder="Ej: Esteban Echeverría"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    required={shippingMethod === 'correo'}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Código Postal {shippingMethod === 'correo' && <span className="text-red-500">*</span>}
                  </label>
                  <input
                    type="text"
                    value={customerPostalCode}
                    onChange={(e) => setCustomerPostalCode(e.target.value)}
                    placeholder="Ej: 1842"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    required={shippingMethod === 'correo'}
                  />
                  {shippingMethod === 'correo' && (
                    <p className="text-xs text-gray-500 mt-1">
                      Necesario para calcular el costo de envío
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* SECCIÓN FACTURACIÓN NUEVA */}
            <div>
              <h2 className="text-xl font-semibold mb-4">Datos de Facturación</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-200">
                <div>
                  <label htmlFor="billingType" className="block text-sm font-medium text-gray-700 mb-1">
                    Tipo de Comprobante
                  </label>
                  <select
                    id="billingType"
                    title="Selecciona el tipo de comprobante"
                    value={billingType}
                    onChange={(e) => setBillingType(e.target.value as 'Consumidor Final' | 'Factura A' | 'Factura B')}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    <option value="Consumidor Final">Consumidor Final (Ticket/Factura B)</option>
                    <option value="Factura A">Factura A (Responsable Inscripto)</option>
                    <option value="Factura B">Factura B (Exento/Monotributo)</option>
                  </select>
                </div>

                {billingType !== 'Consumidor Final' ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      CUIT *
                    </label>
                    <input
                      type="text"
                      value={billingDni}
                      onChange={(e) => setBillingDni(e.target.value.replace(/\D/g, ''))}
                      placeholder="Sin guiones"
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      DNI (Opcional)
                    </label>
                    <input
                      type="text"
                      value={billingDni}
                      onChange={(e) => setBillingDni(e.target.value.replace(/\D/g, ''))}
                      placeholder="Ej: 40123456"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Método de envío */}
            <div>
              <h2 className="text-xl font-semibold mb-4">Método de Entrega</h2>

              <div className="space-y-3">


                {/* Nota de tiempos de entrega */}
                <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
                  <span className="text-xl">⚠️</span>
                  <p className="text-sm text-amber-900 leading-relaxed">
                    <strong>Importante:</strong> La mercadería tiene una demora de entrega de <span className="font-bold">2 a 7 días hábiles</span>.
                  </p>
                </div>

                {/* Método de Envío: Correo Argentino (Pago en Destino) */}
                <div className="border-2 border-indigo-500 bg-indigo-50/30 rounded-lg p-4 relative">
                    <div className="flex items-center gap-3">
                       <div className="bg-indigo-100 p-2 rounded-full text-indigo-600">
                          <Package size={24} />
                       </div>
                       <div className="flex-1">
                          <h3 className="font-semibold text-slate-900">Envío por Correo Argentino</h3>
                          <p className="text-sm text-slate-600">
                            Despachamos tu pedido por correo.<br/>
                            <strong>Abonas el costo de envío al cartero cuando recibes el paquete.</strong>
                          </p>
                       </div>
                       <div className="text-right flex items-center justify-end">
                          <span className="font-bold text-lg text-slate-900 leading-tight">
                            Pago en<br/>destino
                          </span>
                       </div>
                    </div>
                </div>

              </div> {/* Close space-y-3 */}

              {/* Dirección de envío */}
              <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <MapPin className="inline mr-1" size={16} />
                    Dirección de entrega *
                  </label>
                  <input
                    type="text"
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                    placeholder="Calle, número, piso, depto"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    required
                  />
              </div>
            </div> {/* Close Método de Entrega section */}
            
            {/* Notas */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notas adicionales (opcional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Aclaraciones sobre el pedido o la entrega"
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            {/* Botón de pago */}
            <button
              type="submit"
              disabled={isProcessing}
              className={`w-full bg-indigo-600 text-white py-4 rounded-lg font-semibold hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2`}
            >
              {isProcessing ? (
                'Procesando...'
              ) : (
                <>
                  <CreditCard size={20} />
                  Pagar ${total.toLocaleString()}
                </>
              )}
            </button>
          </form>
        </div>

        {/* Resumen del pedido */}
        <div>
          <div className="bg-white rounded-lg shadow-md p-6 sticky top-4">
            <h2 className="text-xl font-semibold mb-4">Resumen del Pedido</h2>

            {/* Items */}
            <div className="space-y-3 mb-4 max-h-96 overflow-y-auto">
              {cart.map((item) => (
                <div key={item.id} className="flex gap-3 py-2 border-b">
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-16 h-16 object-cover rounded"
                  />
                  <div className="flex-1">
                    <h3 className="font-medium text-sm">{item.name}</h3>
                    <p className="text-sm text-gray-600">
                      {item.quantity} x ${item.price.toLocaleString()}
                    </p>
                  </div>
                  <span className="font-semibold">
                    ${(item.price * item.quantity).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>

            {/* Totales */}
            <div className="space-y-2 pt-4 border-t">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal</span>
                <span>${subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Envío</span>
                <span>
                  {shippingCost === 0 ? (
                    <span className="text-green-600 font-medium">GRATIS</span>
                  ) : (
                    `$${shippingCost.toLocaleString()}`
                  )}
                </span>
              </div>
              <div className="flex justify-between text-xl font-bold pt-2 border-t">
                <span>Total</span>
                <span>${total.toLocaleString()}</span>
              </div>
            </div>

            {/* Info de seguridad */}
            <div className="mt-6 p-3 bg-blue-50 rounded-lg">
              <p className="text-xs text-blue-800">
                🔒 Pago seguro con MercadoPago. Aceptamos todas las tarjetas y medios de pago.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Checkout;
