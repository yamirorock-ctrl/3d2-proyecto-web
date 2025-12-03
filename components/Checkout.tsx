import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, MapPin, Truck, Store, Package, CreditCard } from 'lucide-react';
import { CartItem, ShippingMethod } from '../types';
import { createOrder, calculateShippingCost, getShippingConfig } from '../services/orderService';
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
      if (!shippingMethod || shippingMethod === '') {
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

      const cost = await calculateShippingCost(shippingMethod, subtotal);
      console.log('[CHECKOUT] setShippingCost=', cost);
      setShippingCost(cost);
    };

    updateShippingCost();
  }, [shippingMethod, subtotal, mlShippingCost]);

  // Cotizar envío ML cuando el usuario ingresa código postal y selecciona correo
  useEffect(() => {
    const quoteMlShipping = async () => {
      if (shippingMethod !== 'correo' || !customerPostalCode || customerPostalCode.length < 4) {
        setMlShippingCost(null);
          setMlEstimatedDelivery(null);
        return;
      }

      setMlShippingLoading(true);
      try {
        // Calcular dimensiones del paquete basado en los productos del carrito
        let totalWidth = 0;
        let totalHeight = 0;
        let totalLength = 0;
        let totalWeight = 0;

        cart.forEach(item => {
          const dim = PRODUCT_DIMENSIONS[item.technology || 'default'];
          // Para múltiples unidades, solo aumentamos peso y largo (apilados)
          totalWeight += dim.weight * item.quantity;
          totalLength += dim.length * 0.3 * item.quantity; // Factor de compresión al apilar
          // Ancho y alto se toman del producto más grande
          totalWidth = Math.max(totalWidth, dim.width);
          totalHeight = Math.max(totalHeight, dim.height * Math.min(item.quantity, 3)); // Max 3 apilados en altura
        });

        // Redondear y aplicar límites de paquete postal
        const dimensions = {
          width: Math.min(40, Math.ceil(totalWidth + 5)),   // +5cm de packaging
          height: Math.min(30, Math.ceil(totalHeight + 3)),  // +3cm de packaging
          length: Math.min(50, Math.ceil(totalLength + 10)), // +10cm de packaging
          weight: Math.max(300, Math.ceil(totalWeight + 100)) // +100g de packaging
        };
        
        console.log('[ML Quote] Cart items:', cart.map(i => ({ name: i.name, tech: i.technology, qty: i.quantity })));
        console.log('[ML Quote] Calculated dimensions:', dimensions);

        const response = await fetch('https://3d2-bewhook.vercel.app/api/ml-quote-shipping', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            zipCodeTo: customerPostalCode,
            dimensions
          })
        });

        if (!response.ok) {
          console.error('[ML Quote] Failed to quote shipping');
          setMlShippingCost(8000); // Costo estimado por defecto
          return;
        }

        const data = await response.json();
        console.log('[ML Quote] API Response:', data);
        console.log('[ML Quote] Options count:', data.options?.length || 0);
        console.log('[ML Quote] Default cost:', data.defaultCost);
        
        if (data.success && data.defaultCost) {
          console.log('[ML Quote] Using cost:', data.defaultCost);
          setMlShippingCost(data.defaultCost);
          // Extraer fecha de entrega si está disponible
          if (data.selectedOption?.estimatedDelivery) {
            console.log('[ML Quote] Estimated delivery:', data.selectedOption.estimatedDelivery);
            setMlEstimatedDelivery(data.selectedOption.estimatedDelivery);
          } else {
            console.log('[ML Quote] No estimated delivery available');
            setMlEstimatedDelivery(null);
          }
        } else {
          console.warn('[ML Quote] No valid response, using fallback 8000');
          setMlShippingCost(8000);
          setMlEstimatedDelivery(null);
        }
      } catch (error) {
        console.error('[ML Quote] Exception:', error);
        setMlShippingCost(8000); // Fallback
        setMlEstimatedDelivery(null);
      } finally {
        setMlShippingLoading(false);
      }
    };

    quoteMlShipping();
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

    if (isBuenosAires && shippingMethod !== 'retiro' && !customerAddress) {
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

      const { order, error: orderError } = await createOrder({
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
        notes: notes || undefined,
      });

      if (orderError || !order) {
        setError('Error al crear el pedido. Por favor intentá nuevamente.');
        setIsProcessing(false);
        return;
      }

      // INTEGRACIÓN MERCADOPAGO: Crear preferencia y redirigir
      const preferenceResult = await createPaymentPreference(
        order.id,
        order.order_number,
        orderItems,
        shippingCost,
        customerEmail
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email *
                  </label>
                  <input
                    type="email"
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Provincia *
                  </label>
                  <select
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

            {/* Método de envío */}
            <div>
              <h2 className="text-xl font-semibold mb-4">Método de Entrega</h2>

              <div className="space-y-3">
                  {/* Envío en moto */}
                  <label className="flex items-start p-4 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-indigo-500 transition-colors">
                    <input
                      type="radio"
                      name="shipping"
                      value="moto"
                      checked={shippingMethod === 'moto'}
                      onChange={(e) => setShippingMethod(e.target.value as ShippingMethod)}
                      className="mt-1 mr-3"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Truck className="text-indigo-600" size={20} />
                        <span className="font-medium">Envío en Moto</span>
                        {subtotal >= (shippingConfig?.moto_free_threshold || 40000) && (
                          <span className="ml-auto text-green-600 font-bold">GRATIS</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        {subtotal >= (shippingConfig?.moto_free_threshold || 40000)
                          ? `Envío gratis en tu compra`
                          : `Hasta 20 km: $20,000 | Km extra: $4,000 c/u`}
                      </p>
                      {subtotal < (shippingConfig?.moto_free_threshold || 40000) && (
                        <p className="text-xs text-indigo-600 font-medium mt-1">
                          💡 Envío gratis desde ${(shippingConfig?.moto_free_threshold || 40000).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </label>

                  {/* Envío por correo */}
                  <label className="flex items-start p-4 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-indigo-500 transition-colors">
                    <input
                      type="radio"
                      name="shipping"
                      value="correo"
                      checked={shippingMethod === 'correo'}
                      onChange={(e) => setShippingMethod(e.target.value as ShippingMethod)}
                      className="mt-1 mr-3"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Package className="text-indigo-600" size={20} />
                        <span className="font-medium">MercadoEnvíos</span>
                        <span className="ml-auto font-bold">
                          {mlShippingLoading ? (
                            <span className="text-gray-400">Calculando...</span>
                          ) : mlShippingCost !== null ? (
                            <span className="text-indigo-600">${mlShippingCost.toLocaleString()}</span>
                          ) : (
                            <span className="text-gray-400">Ingresá CP</span>
                          )}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        {customerPostalCode && customerPostalCode.length >= 4
                          ? mlEstimatedDelivery 
                            ? `Llega aproximadamente el ${new Date(mlEstimatedDelivery).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })}`
                            : 'Costo calculado por MercadoEnvíos (tiempos sujetos a disponibilidad)'
                          : 'Ingresá tu código postal para ver el costo'}
                      </p>
                    </div>
                  </label>

                {/* Nota de tiempos de entrega */}
                <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <p className="text-sm text-gray-700">
                    Tiempo estimado de entrega: <span className="font-semibold">2 a 7 días hábiles</span> una vez realizada la compra.
                  </p>
                </div>
              </div>

              {/* Dirección de envío */}
              {shippingMethod && (
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
              )}
            </div>

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
              className="w-full bg-indigo-600 text-white py-4 rounded-lg font-semibold hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
