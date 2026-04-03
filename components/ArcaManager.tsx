import React, { useState, useEffect } from 'react';
import { ShieldCheck, Receipt, AlertCircle, CheckCircle, Loader, RefreshCw, Info, ExternalLink, Calendar, User, DollarSign } from 'lucide-react';
import { supabase } from '../services/supabaseService';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface InvoiceInfo {
  cae: string;
  cbte_numero: number;
  cae_vto: string;
}

export const ArcaManager: React.FC = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [serverStatus, setServerStatus] = useState<'OK' | 'ERROR' | 'CHECKING'>('CHECKING');

  useEffect(() => {
    checkAfipStatus();
    fetchPendingOrders();
  }, []);

  const checkAfipStatus = async () => {
    try {
      const res = await fetch('/api/afip');
      const data = await res.json();
      setServerStatus(data.connection === 'OK' ? 'OK' : 'ERROR');
    } catch (e) {
      setServerStatus('ERROR');
    }
  };

  const fetchPendingOrders = async () => {
    setLoading(true);
    try {
      // Buscamos órdenes: 
      // 1. Que no estén facturadas (is_invoiced != true)
      // 2. Que no sean de MercadoLibre (porque ya se encargan ellos)
      // 3. Que estén en estados lógicos para facturar
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Filtramos en cliente para mayor seguridad de no tocar la query original
      const filtered = (data || []).filter(o => {
        const isML = o.notes?.toLowerCase().includes('mercadolibre');
        return !o.is_invoiced && !isML && ['paid', 'delivered', 'completed', 'processing'].includes(o.status);
      });

      setOrders(filtered);
    } catch (err) {
      console.error("Error cargando órdenes:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateInvoice = async (order: any) => {
    if (!window.confirm(`¿Emitir Factura C por $${order.total}? Esta acción es legal y definitiva ante AFIP.`)) return;

    setProcessingId(order.id);
    try {
      const res = await fetch('/api/afip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create-invoice',
          orderData: {
            id: order.id,
            total: order.total,
            // Si tienes campos de DNI en tu tabla orders, aquí se mapearían:
            docTipo: order.customer_dni ? 96 : 99, 
            docNro: order.customer_dni || 0
          }
        })
      });

      const result = await res.json();

      if (!res.ok) throw new Error(result.error || 'Error al conectar con ARCA');

      if (result.success) {
        // Actualizamos el estado local de la orden
        await (supabase.from('orders') as any).update({ 
          is_invoiced: true,
          notes: (order.notes || '') + `\n[FACTURA C EMITIDA: Nº${result.cbte_number} - CAE: ${result.cae}]`
        }).eq('id', order.id);

        alert(`¡Factura Nº${result.cbte_number} emitida con éxito!\nCAE: ${result.cae}`);
        fetchPendingOrders();
      }
    } catch (err: any) {
      alert(`Error en ARCA: ${err.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="p-6 bg-[#0a0a0a] min-height-screen text-white rounded-xl border border-white/10 shadow-2xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h2 className="text-3xl font-bold bg-linear-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-emerald-400" />
            Gestión Fiscal ARCA
          </h2>
          <p className="text-gray-400 mt-2">Facturación Electrónica para Ventas Web y Manuales</p>
        </div>

        <div className={`px-4 py-2 rounded-full border flex items-center gap-2 text-sm font-medium ${
          serverStatus === 'OK' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' :
          serverStatus === 'ERROR' ? 'bg-red-500/10 border-red-500/30 text-red-400' :
          'bg-gray-500/10 border-gray-500/30 text-gray-400'
        }`}>
          <div className={`w-2 h-2 rounded-full ${
            serverStatus === 'OK' ? 'bg-emerald-400 animate-pulse' :
            serverStatus === 'ERROR' ? 'bg-red-400' : 'bg-gray-400'
          }`} />
          {serverStatus === 'OK' ? 'Conectado con AFIP' : serverStatus === 'ERROR' ? 'Error de Conexión' : 'Verificando ARCA...'}
          <button onClick={checkAfipStatus} className="p-1 hover:bg-white/10 rounded ml-2">
             <RefreshCw className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Info Card */}
      <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-4 mb-8 flex gap-4 items-center">
        <div className="bg-blue-500/20 p-2 rounded-lg">
          <Info className="text-blue-400 w-6 h-6" />
        </div>
        <p className="text-sm text-blue-200/80">
          Esta herramienta utiliza el Punto de Venta <strong>0002</strong> configurado para Web Services. 
          Las ventas de MercadoLibre no aparecen aquí ya que son facturadas automáticamente por su plataforma.
        </p>
      </div>

      {/* Orders List */}
      <div className="grid gap-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white/5 rounded-xl border border-dashed border-white/10">
            <Loader className="w-10 h-10 text-emerald-400 animate-spin mb-4" />
            <p className="text-gray-400 font-medium">Buscando ventas pendientes de facturación...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white/5 rounded-xl border border-dashed border-white/10">
            <CheckCircle className="w-12 h-12 text-emerald-500/40 mb-4" />
            <p className="text-gray-400 font-medium text-lg">¡Todo al día!</p>
            <p className="text-gray-500 text-sm">No hay ventas web o manuales pendientes de facturar.</p>
          </div>
        ) : (
          <div className="overflow-hidden bg-white/5 rounded-xl border border-white/10">
             <table className="w-full text-left border-collapse">
                <thead className="bg-white/5 border-b border-white/10">
                   <tr>
                      <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Fecha</th>
                      <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Cliente</th>
                      <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Monto</th>
                      <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider text-right">Acción Fiscal</th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                   {orders.map((order) => (
                      <tr key={order.id} className="hover:bg-white/2 transition-colors group">
                         <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                               <div className="p-2 bg-emerald-500/10 rounded-lg">
                                  <Calendar className="w-4 h-4 text-emerald-400" />
                               </div>
                               <span className="text-sm font-medium">
                                  {format(new Date(order.created_at), 'dd MMM, HH:mm', { locale: es })}
                               </span>
                            </div>
                         </td>
                         <td className="px-6 py-4">
                            <div className="flex flex-col">
                               <span className="text-sm font-semibold flex items-center gap-2">
                                  <User className="w-3 h-3 text-gray-400" />
                                  {order.customer_name || 'Consumidor Final'}
                               </span>
                               <span className="text-xs text-gray-500">{order.customer_email || 'Venta Manual'}</span>
                            </div>
                         </td>
                         <td className="px-6 py-4">
                            <span className="text-sm font-bold text-emerald-400 flex items-center gap-1">
                               <DollarSign className="w-3 h-3" />
                               {new Intl.NumberFormat('es-AR').format(order.total)}
                            </span>
                         </td>
                         <td className="px-6 py-4 text-right">
                            <button
                               onClick={() => handleCreateInvoice(order)}
                               disabled={processingId === order.id}
                               className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                                  processingId === order.id 
                                  ? 'bg-gray-500/20 text-gray-400 cursor-not-allowed'
                                  : 'bg-emerald-500 hover:bg-emerald-400 text-[#0a0a0a] shadow-lg shadow-emerald-500/20 active:scale-95'
                               }`}
                            >
                               {processingId === order.id ? (
                                  <>
                                     <Loader className="w-4 h-4 animate-spin" />
                                     Procesando...
                                  </>
                               ) : (
                                  <>
                                     <Receipt className="w-4 h-4" />
                                     Facturar C
                                  </>
                               )}
                            </button>
                         </td>
                      </tr>
                   ))}
                </tbody>
             </table>
          </div>
        )}
      </div>
    </div>
  );
};
