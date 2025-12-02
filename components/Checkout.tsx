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

      const cost = await calculateShippingCost(shippingMethod, subtotal);
      console.log('[CHECKOUT] setShippingCost=', cost);
      setShippingCost(cost);
    };

    updateShippingCost();
  }, [shippingMethod, subtotal]);

  // Setear método de envío automáticamente si no es Buenos Aires
  useEffect(() => {
    if (!isBuenosAires && shippingMethod !== 'to_coordinate') {
      setShippingMethod('to_coordinate');
    }
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

                {isBuenosAires && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Localidad *
                      </label>
                      <input
                        type="text"
                        value={customerCity}
                        onChange={(e) => setCustomerCity(e.target.value)}
                        placeholder="Ej: Esteban Echeverría"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                        required={isBuenosAires}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Código Postal
                      </label>
                      <input
                        type="text"
                        value={customerPostalCode}
                        onChange={(e) => setCustomerPostalCode(e.target.value)}
                        placeholder="Ej: 1842"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </>
                )}

            {/* Método de envío */}
            <div>
              <h2 className="text-xl font-semibold mb-4">Método de Entrega</h2>

              {!isBuenosAires ? (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-yellow-800 font-medium">
                    📦 Envío al interior: A coordinar con el vendedor
                  </p>
                  <p className="text-sm text-yellow-700 mt-2">
                    Te contactaremos por WhatsApp/Email para coordinar el envío y el costo.
                  </p>
                </div>
              ) : (
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
                        <span className="font-medium">Correo Argentino / Andreani</span>
                        <span className="ml-auto font-bold">
                          ${(shippingConfig?.correo_cost || 3000).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        Envío a todo Buenos Aires
                      </p>
                    </div>
                  </label>

                  {/* Retiro en local */}
                  <label className="flex items-start p-4 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-indigo-500 transition-colors">
                    <input
                      type="radio"
                      name="shipping"
                      value="retiro"
                      checked={shippingMethod === 'retiro'}
                      onChange={(e) => setShippingMethod(e.target.value as ShippingMethod)}
                      className="mt-1 mr-3"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Store className="text-indigo-600" size={20} />
                        <span className="font-medium">Retiro en Local</span>
                        <span className="ml-auto text-green-600 font-bold">GRATIS</span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        {shippingConfig?.store_address || 'Amado Nervo 85, El Jagüel'}
                      </p>
                      <p className="text-sm text-gray-500">
                        {shippingConfig?.store_hours || 'Lun a Vie 10-18hs'}
                      </p>
                    </div>
                  </label>
                </div>
              )}

              {/* Dirección de envío */}
              {isBuenosAires && shippingMethod && shippingMethod !== 'retiro' && shippingMethod !== 'to_coordinate' && (
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
