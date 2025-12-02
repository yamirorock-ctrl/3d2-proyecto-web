import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';
import { getOrderById, updateOrderPayment } from '../services/orderService';
import { Order } from '../types';

const OrderSuccess: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusParam, setStatusParam] = useState<string | null>(null);

  useEffect(() => {
    const orderId = searchParams.get('order_id');
    const paymentId = searchParams.get('payment_id');
    const status = searchParams.get('status');
    setStatusParam(status);

    const processPayment = async () => {
      if (!orderId) {
        navigate('/');
        return;
      }

      try {
        // Actualizar estado del pago si MercadoPago envió el payment_id
        if (paymentId && status) {
          await updateOrderPayment(orderId, paymentId, status);
        }

        // Obtener orden
        const foundOrder = await getOrderById(orderId);
        if (foundOrder) {
          setOrder(foundOrder);
        }

        // Limpiar carrito solo si el estado viene aprobado
        const isApproved = (status || '').toLowerCase() === 'approved';
        if (isApproved) {
          try {
            localStorage.removeItem('cart');
          } catch {}
          // Notificar a la app para limpiar el estado del carrito en memoria
          try {
            window.dispatchEvent(new Event('cart:clear'));
          } catch {}
        }
      } catch (error) {
        console.error('Error al procesar el pago:', error);
      } finally {
        setLoading(false);
      }
    };

    processPayment();
  }, [searchParams, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Procesando tu pedido...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="container mx-auto max-w-2xl">
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <div className="mb-6">
            <CheckCircle className="mx-auto text-green-500" size={64} />
          </div>

          <h1 className="text-3xl font-bold text-gray-900 mb-2">¡Pago Exitoso!</h1>
          <p className="text-gray-600 mb-8">
            Tu pedido ha sido procesado correctamente
          </p>

          {statusParam && statusParam.toLowerCase() === 'pending' && (
            <div className="bg-yellow-50 border border-yellow-200 rounded p-4 mb-6 text-left">
              <p className="text-yellow-800 font-medium">
                Tu pago está en revisión (pending). Conservamos tu carrito para que puedas reintentar si fuera necesario.
              </p>
              <p className="text-yellow-700 text-sm mt-2">
                Si el pago se aprueba, verás el estado como Pagado en el seguimiento y el carrito se vaciará automáticamente.
              </p>
              <div className="mt-4 text-right">
                <button
                  onClick={() => navigate('/checkout')}
                  className="inline-flex items-center gap-2 bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700 font-semibold"
                >
                  Reintentar pago
                </button>
              </div>
            </div>
          )}

          {order && (
            <div className="bg-gray-50 rounded-lg p-6 mb-8 text-left">
              <h2 className="text-xl font-semibold mb-4">Detalles del Pedido</h2>

              <div className="space-y-2 mb-4">
                <div className="flex justify-between">
                  <span className="text-gray-600">Número de Pedido:</span>
                  <span className="font-semibold">{order.order_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Email:</span>
                  <span className="font-semibold">{order.customer_email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total:</span>
                  <span className="font-semibold text-lg">${order.total.toLocaleString()}</span>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm">
                <p className="text-blue-800">
                  📧 Te enviamos un email a <strong>{order.customer_email}</strong> con los detalles de tu pedido.
                </p>
              </div>
            </div>
          )}

          <div className="space-y-3">
            <button
              onClick={() => navigate(`/order-tracking${order ? `?order_number=${encodeURIComponent(order.order_number)}` : ''}`)}
              className="w-full bg-indigo-600 text-white py-3 px-6 rounded-lg hover:bg-indigo-700 font-semibold"
            >
              Ver Estado del Pedido
            </button>

            <button
              onClick={() => navigate('/')}
              className="w-full bg-white text-indigo-600 py-3 px-6 rounded-lg hover:bg-gray-50 font-semibold border-2 border-indigo-600"
            >
              Volver a la Tienda
            </button>
          </div>

          {order && (
            <div className="mt-8 pt-6 border-t text-sm text-gray-600">
              <p>Guardá tu número de pedido: <strong>{order.order_number}</strong></p>
              <p className="mt-2">
                Para consultas: WhatsApp{' '}
                <a
                  href={`https://wa.me/54${order.customer_phone.replace(/\D/g, '')}`}
                  className="text-indigo-600 hover:underline"
                >
                  {order.customer_phone}
                </a>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OrderSuccess;
