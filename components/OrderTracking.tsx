import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Package, Truck, CheckCircle, Clock, XCircle } from 'lucide-react';
import { getOrderByNumber } from '../services/orderService';
import { Order, OrderStatus } from '../types';

const OrderTracking: React.FC = () => {
  const [orderNumber, setOrderNumber] = useState('');
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchParams] = useSearchParams();

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setOrder(null);

    if (!orderNumber.trim()) {
      setError('Por favor ingresá un número de pedido');
      return;
    }

    setLoading(true);

    try {
      const foundOrder = await getOrderByNumber(orderNumber.trim());

      if (!foundOrder) {
        setError('No se encontró ningún pedido con ese número');
      } else {
        setOrder(foundOrder);
      }
    } catch (err) {
      setError('Error al buscar el pedido. Por favor intentá nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  // Autofill y búsqueda automática si viene ?order_number= en la URL
  useEffect(() => {
    const fromQuery = searchParams.get('order_number');
    if (fromQuery) {
      setOrderNumber(fromQuery);
      // Disparar búsqueda automática sin necesidad de que el usuario envíe el formulario
      (async () => {
        setLoading(true);
        setError('');
        setOrder(null);
        try {
          const foundOrder = await getOrderByNumber(fromQuery.trim());
          if (!foundOrder) {
            setError('No se encontró ningún pedido con ese número');
          } else {
            setOrder(foundOrder);
          }
        } catch (err) {
          setError('Error al buscar el pedido. Por favor intentá nuevamente.');
        } finally {
          setLoading(false);
        }
      })();
    }
  }, [searchParams]);

  const getStatusInfo = (status: OrderStatus) => {
    switch (status) {
      case 'pending':
        return {
          icon: Clock,
          text: 'Pendiente',
          color: 'text-yellow-600',
          bg: 'bg-yellow-100',
          description: 'Tu pedido está siendo procesado',
        };
      case 'payment_pending':
        return {
          icon: Clock,
          text: 'Esperando Pago',
          color: 'text-orange-600',
          bg: 'bg-orange-100',
          description: 'Esperando confirmación del pago',
        };
      case 'paid':
        return {
          icon: CheckCircle,
          text: 'Pagado',
          color: 'text-green-600',
          bg: 'bg-green-100',
          description: 'Pago confirmado. Preparando tu pedido',
        };
      case 'preparing':
        return {
          icon: Package,
          text: 'En Preparación',
          color: 'text-blue-600',
          bg: 'bg-blue-100',
          description: 'Estamos preparando tu pedido',
        };
      case 'shipped':
        return {
          icon: Truck,
          text: 'Enviado',
          color: 'text-indigo-600',
          bg: 'bg-indigo-100',
          description: 'Tu pedido está en camino',
        };
      case 'delivered':
        return {
          icon: CheckCircle,
          text: 'Entregado',
          color: 'text-green-600',
          bg: 'bg-green-100',
          description: '¡Tu pedido fue entregado!',
        };
      case 'cancelled':
        return {
          icon: XCircle,
          text: 'Cancelado',
          color: 'text-red-600',
          bg: 'bg-red-100',
          description: 'El pedido fue cancelado',
        };
      case 'to_coordinate':
        return {
          icon: Clock,
          text: 'A Coordinar',
          color: 'text-purple-600',
          bg: 'bg-purple-100',
          description: 'Nos contactaremos para coordinar el envío',
        };
      default:
        return {
          icon: Package,
          text: 'Estado desconocido',
          color: 'text-gray-600',
          bg: 'bg-gray-100',
          description: '',
        };
    }
  };

  const getShippingMethodText = (method: string) => {
    switch (method) {
      case 'moto':
        return 'Envío en Moto';
      case 'correo':
        return 'MercadoEnvíos';
      case 'retiro':
        return 'Retiro en Local';
      case 'to_coordinate':
        return 'A Coordinar';
      default:
        return method;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="container mx-auto max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Seguimiento de Pedido</h1>
          <p className="text-gray-600">
            Ingresá tu número de pedido para ver el estado de tu compra
          </p>
        </div>

        {/* Formulario de búsqueda */}
        <form onSubmit={handleSearch} className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="flex gap-2">
            <input
              type="text"
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
              placeholder="Ej: 3D2-20251130-0001"
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="submit"
              disabled={loading}
              className="bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 flex items-center gap-2"
            >
              {loading ? (
                'Buscando...'
              ) : (
                <>
                  <Search size={20} />
                  Buscar
                </>
              )}
            </button>
          </div>

          {error && (
            <div className="mt-4 text-red-600 text-sm">{error}</div>
          )}
        </form>

        {/* Resultado */}
        {order && (
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            {/* Estado del pedido */}
            <div className={`p-6 ${getStatusInfo(order.status).bg}`}>
              <div className="flex items-center gap-3">
                {React.createElement(getStatusInfo(order.status).icon, {
                  size: 32,
                  className: getStatusInfo(order.status).color,
                })}
                <div>
                  <h2 className={`text-2xl font-bold ${getStatusInfo(order.status).color}`}>
                    {getStatusInfo(order.status).text}
                  </h2>
                  <p className="text-gray-700">{getStatusInfo(order.status).description}</p>
                </div>
              </div>
            </div>

            {/* Detalles del pedido */}
            <div className="p-6 space-y-6">
              {/* Información general */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Información del Pedido</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Número de Pedido:</span>
                    <p className="font-semibold">{order.order_number}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Fecha:</span>
                    <p className="font-semibold">
                      {new Date(order.created_at).toLocaleDateString('es-AR')}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-600">Método de Envío:</span>
                    <p className="font-semibold">{getShippingMethodText(order.shipping_method)}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Total:</span>
                    <p className="font-semibold text-lg">${order.total.toLocaleString()}</p>
                  </div>
                </div>
              </div>

              {/* Tracking */}
              {order.tracking_number && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="font-semibold text-blue-900 mb-1">Número de Seguimiento</h3>
                  <p className="text-blue-800 font-mono text-lg">{order.tracking_number}</p>
                  <p className="text-sm text-blue-700 mt-2">
                    Podés rastrear tu envío en la página del correo con este número
                  </p>
                </div>
              )}

              {/* Items */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Productos</h3>
                <div className="space-y-3">
                  {order.items.map((item, index) => (
                    <div key={index} className="flex gap-3 items-center py-2 border-b">
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-16 h-16 object-cover rounded"
                      />
                      <div className="flex-1">
                        <h4 className="font-medium">{item.name}</h4>
                        <p className="text-sm text-gray-600">
                          Cantidad: {item.quantity} x ${item.price.toLocaleString()}
                        </p>
                      </div>
                      <span className="font-semibold">
                        ${(item.price * item.quantity).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Dirección de envío */}
              {order.customer_address && (
                <div>
                  <h3 className="text-lg font-semibold mb-2">Dirección de Entrega</h3>
                  <p className="text-gray-700">
                    {order.customer_address}
                    {order.customer_city && `, ${order.customer_city}`}
                    {order.customer_province && `, ${order.customer_province}`}
                    {order.customer_postal_code && ` (CP ${order.customer_postal_code})`}
                  </p>
                </div>
              )}

              {/* Notas */}
              {order.notes && (
                <div>
                  <h3 className="text-lg font-semibold mb-2">Notas</h3>
                  <p className="text-gray-700 bg-gray-50 p-3 rounded">{order.notes}</p>
                </div>
              )}

              {/* Contacto */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold mb-2">¿Tenés alguna consulta?</h3>
                <p className="text-sm text-gray-600">
                  Contactanos por WhatsApp al{' '}
                  <a
                    href={`https://api.whatsapp.com/send?phone=${((import.meta as any).env?.VITE_WHATSAPP_NUMBER || '5491171285516').trim()}`}
                    className="text-indigo-600 hover:underline"
                  >
                    {((import.meta as any).env?.VITE_WHATSAPP_NUMBER || '5491171285516').trim()}
                  </a>{' '}
                  o por email a{' '}
                  <a
                    href={`mailto:${order.customer_email}`}
                    className="text-indigo-600 hover:underline"
                  >
                    {order.customer_email}
                  </a>
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OrderTracking;
