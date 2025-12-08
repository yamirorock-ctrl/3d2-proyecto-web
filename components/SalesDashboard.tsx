import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Order } from '../types';
import { TrendingUp, Package, DollarSign, Clock, Download, Calendar, CheckCircle, Loader, XCircle, Trash2, RefreshCw, Truck } from 'lucide-react';

interface Props {
  orders: Order[];
  onUpdateStatus?: (orderId: string, newStatus: Order['status']) => void;
  onDelete?: (orderId: string) => void;
  onRefresh?: () => void;
}

type DateFilter = 'today' | 'week' | 'month' | 'all';

const SalesDashboard: React.FC<Props> = ({ orders, onUpdateStatus, onDelete, onRefresh }) => {
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');

  const filteredOrders = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    return orders.filter(o => {
      const ts = (o as any).timestamp || (o as any).created_at;
      const orderDate = ts ? new Date(ts) : new Date(0);
      switch (dateFilter) {
        case 'today': return orderDate >= todayStart;
        case 'week': return orderDate >= weekStart;
        case 'month': return orderDate >= monthStart;
        default: return true;
      }
    });
  }, [orders, dateFilter]);

  const metrics = useMemo(() => {
    const total = filteredOrders.reduce((sum, o) => sum + (o.total || 0), 0);
    const completed = filteredOrders.filter(o => ['paid','delivered','completed'].includes(o.status as any)).length;
    const pending = filteredOrders.filter(o => ['pending','to_coordinate'].includes(o.status as any)).length;
    const processing = filteredOrders.filter(o => ['preparing','payment_pending','processing','shipped'].includes(o.status as any)).length;
    
    // Productos más vendidos
    const productCount: Record<string, { count: number; total: number; name: string }> = {};
    filteredOrders.forEach(order => {
      order.items.forEach(item => {
        if (!productCount[item.name]) {
          productCount[item.name] = { count: 0, total: 0, name: item.name };
        }
        productCount[item.name].count += item.quantity;
        productCount[item.name].total += item.price * item.quantity;
      });
    });
    const topProducts = Object.values(productCount)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    return { total, completed, pending, processing, topProducts };
  }, [filteredOrders]);

  const handleExportCSV = () => {
    const headers = ['ID', 'Fecha', 'Cliente', 'Email', 'Teléfono', 'Total', 'Método Pago', 'Estado', 'Productos'];
    const rows = filteredOrders.map(o => [
      o.id,
      new Date((o as any).timestamp || (o as any).created_at).toLocaleString('es-AR'),
      (o as any).customer?.name || (o as any).customer_name,
      (o as any).customer?.email || (o as any).customer_email,
      (o as any).customer?.phone || (o as any).customer_phone,
      o.total.toFixed(2),
      (o as any).paymentMethod || ((o as any).payment_id ? 'mercadopago' : 'otro'),
      o.status,
      o.items.map(i => `${i.name} (x${i.quantity})`).join('; ')
    ]);
    
    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ventas-${dateFilter}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header con filtros */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl sm:text-2xl font-bold text-slate-900">Control de Ventas</h3>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">Analiza el rendimiento de tu tienda</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
          <div className="flex gap-2 bg-gray-100 rounded-lg p-1">
            {(['today', 'week', 'month', 'all'] as DateFilter[]).map(filter => (
              <button
                key={filter}
                onClick={() => setDateFilter(filter)}
                className={`px-3 py-1.5 text-sm rounded-md transition-all ${
                  dateFilter === filter
                    ? 'bg-white text-indigo-600 shadow-sm font-medium'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {filter === 'today' && 'Hoy'}
                {filter === 'week' && 'Semana'}
                {filter === 'month' && 'Mes'}
                {filter === 'all' && 'Todo'}
              </button>
            ))}
          </div>
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg flex items-center gap-2 hover:bg-indigo-700 transition-colors"
            >
              <RefreshCw size={16} />
              Actualizar
            </button>
          )}
          <button
            onClick={handleExportCSV}
            className="px-4 py-2 bg-green-600 text-white rounded-lg flex items-center gap-2 hover:bg-green-700 transition-colors"
          >
            <Download size={16} />
            Exportar CSV
          </button>
        </div>
      </div>

      {/* Métricas principales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-linear-to-br from-indigo-500 to-indigo-600 rounded-xl p-4 sm:p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <DollarSign size={20} className="opacity-80 sm:w-6 sm:h-6" />
            <TrendingUp size={16} className="opacity-60 sm:w-5 sm:h-5" />
          </div>
          <p className="text-xs sm:text-sm opacity-90 mb-1">Total Vendido</p>
          <p className="text-2xl sm:text-3xl font-bold">${metrics.total.toFixed(2)}</p>
        </div>

        <div className="bg-linear-to-br from-green-500 to-green-600 rounded-xl p-4 sm:p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <Package size={20} className="opacity-80 sm:w-6 sm:h-6" />
          </div>
          <p className="text-xs sm:text-sm opacity-90 mb-1">Órdenes</p>
          <p className="text-2xl sm:text-3xl font-bold">{filteredOrders.length}</p>
        </div>

        <div className="bg-linear-to-br from-blue-500 to-blue-600 rounded-xl p-4 sm:p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <Clock size={20} className="opacity-80 sm:w-6 sm:h-6" />
          </div>
          <p className="text-xs sm:text-sm opacity-90 mb-1">En Proceso</p>
          <p className="text-2xl sm:text-3xl font-bold">{metrics.processing}</p>
        </div>

        <div className="bg-linear-to-br from-purple-500 to-purple-600 rounded-xl p-4 sm:p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <Calendar size={20} className="opacity-80 sm:w-6 sm:h-6" />
          </div>
          <p className="text-xs sm:text-sm opacity-90 mb-1">Pendientes</p>
          <p className="text-2xl sm:text-3xl font-bold">{metrics.pending}</p>
        </div>
      </div>

      {/* Gráfico de Ventas por Producto (Top 5) */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h4 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
          <TrendingUp size={20} className="text-indigo-600" />
          Top 5 Productos (Ingresos)
        </h4>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={metrics.topProducts}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" fontSize={12} tickFormatter={(val) => val.length > 15 ? val.slice(0, 15)+'...' : val} />
              <YAxis />
              <Tooltip formatter={(value: number) => [`$${value.toFixed(2)}`, 'Ingresos']} />
              <Bar dataKey="total" fill="#4f46e5" name="Ingresos ($)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top productos */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h4 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
          <TrendingUp size={20} className="text-indigo-600" />
          Productos Más Vendidos
        </h4>
        {metrics.topProducts.length === 0 ? (
          <p className="text-slate-500 text-sm">No hay datos para mostrar</p>
        ) : (
          <div className="space-y-3">
            {metrics.topProducts.map((product, idx) => (
              <div key={product.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 bg-indigo-100 text-indigo-600 rounded-full font-bold text-sm">
                    {idx + 1}
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">{product.name}</p>
                    <p className="text-xs text-slate-500">{product.count} unidades vendidas</p>
                  </div>
                </div>
                <p className="text-lg font-bold text-indigo-600">${product.total.toFixed(2)}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Distribución por estado */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h4 className="text-lg font-bold text-slate-900 mb-4">Distribución por Estado</h4>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
            <p className="text-2xl font-bold text-green-600">{metrics.completed}</p>
            <p className="text-sm text-slate-600 mt-1">Completadas</p>
          </div>
          <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-2xl font-bold text-blue-600">{metrics.processing}</p>
            <p className="text-sm text-slate-600 mt-1">En Proceso</p>
          </div>
          <div className="text-center p-4 bg-amber-50 rounded-lg border border-amber-200">
            <p className="text-2xl font-bold text-amber-600">{metrics.pending}</p>
            <p className="text-sm text-slate-600 mt-1">Pendientes</p>
          </div>
        </div>
      </div>

      {/* Lista detallada de órdenes */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b bg-gray-50">
          <h4 className="text-lg font-bold text-slate-900">Todas las Órdenes</h4>
          <p className="text-sm text-slate-500 mt-1">{filteredOrders.length} órdenes en el período seleccionado</p>
        </div>
        <div className="divide-y">
          {filteredOrders.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              <Package size={48} className="mx-auto mb-4 opacity-30" />
              <p>No hay órdenes para mostrar</p>
            </div>
          ) : (
            filteredOrders.sort((a, b) => {
              const aTime = new Date((a as any).timestamp || (a as any).created_at).getTime();
              const bTime = new Date((b as any).timestamp || (b as any).created_at).getTime();
              return bTime - aTime;
            }).map(order => (
              <div key={order.id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                  <div className="flex-1">
                    {/* Header */}
                    <div className="flex flex-wrap items-center gap-3 mb-3">
                      <span className="font-mono text-sm text-slate-500">#{order.id.slice(0, 8)}</span>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        ['paid','delivered','completed'].includes(order.status as any) ? 'bg-green-100 text-green-800' :
                        ['preparing','payment_pending','processing','shipped'].includes(order.status as any) ? 'bg-blue-100 text-blue-800' :
                        ['pending','to_coordinate'].includes(order.status as any) ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {['paid','delivered','completed'].includes(order.status as any) ? <><CheckCircle size={12} className="inline mr-1" />Completado</> :
                         ['preparing','payment_pending','processing','shipped'].includes(order.status as any) ? <><Loader size={12} className="inline mr-1" />En Proceso</> :
                         ['pending','to_coordinate'].includes(order.status as any) ? <><Clock size={12} className="inline mr-1" />Pendiente</> :
                         <><XCircle size={12} className="inline mr-1" />Cancelado</>}
                      </span>
                      <span className="px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-xs font-medium">
                        {((order as any).method === 'mercadopago' || (order as any).payment_id) ? 'MercadoPago' : 
                         (order as any).paymentMethod === 'transfer' ? 'Transferencia' : 'Otro'}
                      </span>
                      <span className="text-sm text-slate-500">
                        {new Date(((order as any).timestamp || (order as any).created_at)).toLocaleString('es-AR')}
                      </span>
                    </div>

                    {/* Customer info */}
                    <div className="bg-slate-50 rounded-lg p-4 mb-3">
                      <p className="text-sm font-medium text-slate-700 mb-2">Cliente:</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-slate-600">
                        <div><strong>Nombre:</strong> {(order as any).customer?.name || (order as any).customer_name}</div>
                        <div><strong>Email:</strong> {(order as any).customer?.email || (order as any).customer_email}</div>
                        <div><strong>Teléfono:</strong> {(order as any).customer?.phone || (order as any).customer_phone}</div>
                        <div><strong>Dirección:</strong> {(order as any).customer?.address || (order as any).customer_address || 'N/A'}</div>
                      </div>
                    </div>

                    {/* Items */}
                    <div className="mb-3">
                      <p className="text-sm font-medium text-slate-700 mb-2">Productos:</p>
                      <div className="space-y-1">
                        {order.items.map((item, idx) => (
                          <div key={idx} className="flex justify-between text-sm">
                            <span className="text-slate-600">{item.name} x{item.quantity}</span>
                            <span className="font-medium">${(item.price * item.quantity).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Tracking Info (si existe) */}
                    {((order as any).tracking_number || (order as any).ml_shipment_id) && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-3">
                        <p className="text-sm font-medium text-blue-900 mb-2 flex items-center gap-2">
                          <Truck size={16} />
                          Información de Envío
                        </p>
                        <div className="space-y-1 text-sm text-blue-800">
                          {(order as any).tracking_number && (
                            <div>
                              <strong>Número de seguimiento:</strong>{' '}
                              <span className="font-mono bg-white px-2 py-0.5 rounded border border-blue-300">
                                {(order as any).tracking_number}
                              </span>
                            </div>
                          )}
                          {(order as any).ml_shipment_id && (
                            <div>
                              <strong>ID Envío ML:</strong> {(order as any).ml_shipment_id}
                            </div>
                          )}
                          {(order as any).shipping_method && (
                            <div>
                              <strong>Método:</strong>{' '}
                              {(order as any).shipping_method === 'moto' ? 'Envío en Moto' :
                               (order as any).shipping_method === 'correo' ? 'MercadoEnvíos' :
                               (order as any).shipping_method === 'retiro' ? 'Retiro en Local' :
                               'A coordinar'}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Total */}
                    <div className="flex justify-between items-center pt-3 border-t">
                      <span className="text-sm font-medium text-slate-700">Total:</span>
                      <span className="text-xl font-bold text-indigo-600">${order.total.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  {(onUpdateStatus || onDelete) && (
                    <div className="flex flex-col gap-2 lg:w-64">
                      {/* Descargar etiqueta MercadoEnvíos si existe shipment */}
                      {(order as any).ml_shipment_id && (
                        <button
                          onClick={async () => {
                            try {
                              const token = localStorage.getItem('ml_access_token');
                              if (!token) {
                                alert('Conectá MercadoLibre en Admin para descargar etiquetas.');
                                return;
                              }
                              const resp = await fetch(`https://api.mercadolibre.com/shipments/${(order as any).ml_shipment_id}/label`, {
                                headers: {
                                  'Authorization': `Bearer ${token}`,
                                  'Accept': 'application/pdf'
                                }
                              });
                              if (!resp.ok) {
                                const txt = await resp.text();
                                console.error('Error label ML:', resp.status, txt);
                                alert('No se pudo descargar la etiqueta. Probá nuevamente.');
                                return;
                              }
                              const blob = await resp.blob();
                              const url = window.URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = `etiqueta-${(order as any).ml_shipment_id}.pdf`;
                              a.click();
                              window.URL.revokeObjectURL(url);
                            } catch (e) {
                              console.error('Excepción al descargar etiqueta:', e);
                              alert('Error inesperado al descargar la etiqueta.');
                            }
                          }}
                          className="px-4 py-2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md text-sm hover:bg-indigo-100 transition-colors flex items-center justify-center gap-2"
                        >
                          <Download size={14} />
                          Etiqueta ML
                        </button>
                      )}

                      {onUpdateStatus && order.status === 'pending' && (
                        <button
                          onClick={() => onUpdateStatus(order.id, 'processing')}
                          className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                        >
                          <Loader size={14} />
                          Procesar
                        </button>
                      )}
                      {onUpdateStatus && order.status === 'processing' && (
                        <button
                          onClick={() => onUpdateStatus(order.id, 'completed')}
                          className="px-4 py-2 bg-green-600 text-white rounded-md text-sm hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                        >
                          <CheckCircle size={14} />
                          Completar
                        </button>
                      )}
                      {onUpdateStatus && order.status !== 'cancelled' && (
                        <button
                          onClick={() => onUpdateStatus(order.id, 'cancelled')}
                          className="px-4 py-2 bg-red-50 text-red-700 border border-red-200 rounded-md text-sm hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
                        >
                          <XCircle size={14} />
                          Cancelar
                        </button>
                      )}
                      {onDelete && (
                        <button
                          onClick={() => onDelete(order.id)}
                          className="px-4 py-2 bg-slate-50 text-slate-700 border border-slate-200 rounded-md text-sm hover:bg-slate-100 transition-colors flex items-center justify-center gap-2"
                        >
                          <Trash2 size={14} />
                          Eliminar
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default SalesDashboard;
