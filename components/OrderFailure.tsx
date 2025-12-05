import React from 'react';
import { useNavigate } from 'react-router-dom';
import { XCircle } from 'lucide-react';

const OrderFailure: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="container mx-auto max-w-2xl">
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <div className="mb-6">
            <XCircle className="mx-auto text-red-500" size={64} />
          </div>

          <h1 className="text-3xl font-bold text-gray-900 mb-2">Pago No Completado</h1>
          <p className="text-gray-600 mb-8">
            No pudimos procesar tu pago. Por favor, intentá nuevamente.
          </p>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-8 text-left">
            <h3 className="font-semibold text-yellow-900 mb-2">¿Qué pudo haber pasado?</h3>
            <ul className="list-disc list-inside text-sm text-yellow-800 space-y-1">
              <li>Cancelaste el pago</li>
              <li>Fondos insuficientes</li>
              <li>Error en los datos de la tarjeta</li>
              <li>Límite de compra excedido</li>
            </ul>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => navigate('/checkout')}
              className="w-full bg-indigo-600 text-white py-3 px-6 rounded-lg hover:bg-indigo-700 font-semibold"
            >
              Intentar Nuevamente
            </button>

            <button
              onClick={() => navigate('/')}
              className="w-full bg-white text-gray-700 py-3 px-6 rounded-lg hover:bg-gray-50 font-semibold border-2 border-gray-300"
            >
              Volver a la Tienda
            </button>
          </div>

          <div className="mt-8 pt-6 border-t text-sm text-gray-600">
            <p>¿Necesitás ayuda?</p>
            <p className="mt-2">
              Contactanos por WhatsApp o email y te ayudamos con tu compra
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderFailure;
