import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { XCircle, AlertTriangle } from 'lucide-react';

const OrderFailure: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  
  // Capturar estados de Mercado Pago desde la URL
  const status = queryParams.get('status');
  const statusDetail = queryParams.get('status_detail');
  const paymentId = queryParams.get('payment_id');

  const getFriendlyMessage = () => {
    switch (statusDetail) {
      case 'cc_rejected_insufficient_amount':
        return 'Tu tarjeta no tiene fondos suficientes para completar esta compra.';
      case 'cc_rejected_bad_filled_security_code':
        return 'El código de seguridad ingresado es incorrecto.';
      case 'cc_rejected_call_for_authorize':
        return 'Debes autorizar el pago con tu banco antes de intentar nuevamente.';
      case 'cc_rejected_high_risk':
        return 'El pago fue rechazado por medidas de seguridad. Por favor, intentá con otro medio.';
      default:
        return 'No pudimos procesar tu pago en este momento.';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="container mx-auto max-w-2xl">
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <div className="mb-6">
            <XCircle className="mx-auto text-red-500" size={64} />
          </div>

          <h1 className="text-3xl font-bold text-gray-900 mb-2">Pago No Completado</h1>
          <p className="text-lg text-red-600 font-medium mb-4">
            {getFriendlyMessage()}
          </p>
          <p className="text-gray-500 mb-8">
            Referencia de Pago: <span className="font-mono">{paymentId || 'No disponible'}</span>
          </p>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-8 text-left">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="text-yellow-600" size={20} />
              <h3 className="font-semibold text-yellow-900">¿Qué podés hacer?</h3>
            </div>
            <ul className="list-disc list-inside text-sm text-yellow-800 space-y-1">
              <li>Revisar los datos de tu tarjeta</li>
              <li>Asegurarte de tener saldo disponible</li>
              <li>Intentar con otra tarjeta o medio de pago</li>
              <li>Contactar a tu banco si el error persiste</li>
            </ul>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => navigate('/checkout')}
              className="w-full bg-indigo-600 text-white py-3 px-6 rounded-lg hover:bg-indigo-700 font-semibold transition-colors"
            >
              Volver al Checkout
            </button>

            <button
              onClick={() => navigate('/')}
              className="w-full bg-white text-gray-700 py-3 px-6 rounded-lg hover:bg-gray-50 font-semibold border-2 border-gray-300 transition-colors"
            >
              Explorar otros productos
            </button>
          </div>

          <div className="mt-8 pt-6 border-t text-sm text-gray-600">
            <p>¿Necesitás ayuda inmediata?</p>
            <p className="mt-2 font-medium text-indigo-600">
              Escribinos por WhatsApp y coordinamos tu pedido manualmente.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderFailure;
