import React, { useEffect, useState } from 'react';
import { Package, Truck, CheckCircle, Clock, XCircle, Search, Edit2, Save, X } from 'lucide-react';
import { getAllOrders, updateOrderStatus, updateOrderTracking } from '../services/orderService';
import { Order, OrderStatus } from '../types';

const OrdersManagement: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<OrderStatus | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [editingTracking, setEditingTracking] = useState<string | null>(null);
  const [trackingNumber, setTrackingNumber] = useState('');

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    setLoading(true);
    const fetchedOrders = await getAllOrders();
    setOrders(fetchedOrders);
    setLoading(false);
  };

  const handleStatusChange = async (orderId: string, newStatus: OrderStatus) => {
    const success = await updateOrderStatus(orderId, newStatus);
    if (success) {
      loadOrders();
    } else {
      alert('Error al actualizar el estado del pedido');
    }
  };

  const handleSaveTracking = async (orderId: string) => {
    if (!trackingNumber.trim()) {
      alert('Por favor ingresá un número de tracking');
      return;
    }

    const success = await updateOrderTracking(orderId, trackingNumber.trim());
    if (success) {
      setEditingTracking(null);
      setTrackingNumber('');
      loadOrders();
    } else {
      alert('Error al actualizar el tracking');
    }
  };

  const startEditTracking = (order: Order) => {
    setEditingTracking(order.id);
    setTrackingNumber(order.tracking_number || '');
  };

  const cancelEditTracking = () => {
    setEditingTracking(null);
    setTrackingNumber('');
  };

  const getStatusBadge = (status: OrderStatus) => {
    const badges: Record<OrderStatus, { text: string; color: string }> = {
      pending: { text: 'Pendiente', color: 'bg-yellow-100 text-yellow-800' },
      payment_pending: { text: 'Esperando Pago', color: 'bg-orange-100 text-orange-800' },
      paid: { text: 'Pagado', color: 'bg-green-100 text-green-800' },
      preparing: { text: 'En Preparación', color: 'bg-blue-100 text-blue-800' },
      shipped: { text: 'Enviado', color: 'bg-indigo-100 text-indigo-800' },
      delivered: { text: 'Entregado', color: 'bg-green-200 text-green-900' },
      cancelled: { text: 'Cancelado', color: 'bg-red-100 text-red-800' },
      to_coordinate: { text: 'A Coordinar', color: 'bg-purple-100 text-purple-800' },
      processing: { text: 'Procesando', color: 'bg-blue-100 text-blue-800' },
      completed: { text: 'Completado', color: 'bg-green-200 text-green-900' },
    };

    const badge = badges[status];
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${badge.color}`}>
        {badge.text}
      </span>
    );
  };

  const getShippingMethodBadge = (method: string) => {
    const methods: Record<string, { text: string; icon: React.ReactNode }> = {
      moto: { text: 'Moto', icon: <Truck size={14} /> },
      correo: { text: 'Correo', icon: <Package size={14} /> },
      retiro: { text: 'Retiro', icon: <Package size={14} /> },
      to_coordinate: { text: 'A Coord.', icon: <Clock size={14} /> },
    };

    const methodInfo = methods[method] || { text: method, icon: null };
    return (
      <span className="flex items-center gap-1 text-sm text-gray-600">
        {methodInfo.icon}
        {methodInfo.text}
      </span>
    );
  };

  const filteredOrders = orders.filter((order) => {
    const matchesFilter = filter === 'all' || order.status === filter;
    const matchesSearch =
      order.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customer_email.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const stats = {
    total: orders.length,
    pending: orders.filter((o) => o.status === 'pending' || o.status === 'payment_pending').length,
    preparing: orders.filter((o) => o.status === 'paid' || o.status === 'preparing').length,
    shipped: orders.filter((o) => o.status === 'shipped').length,
    delivered: orders.filter((o) => o.status === 'delivered').length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando pedidos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Gestión de Pedidos</h1>

      {/* Estadísticas */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-600">Total</p>
          <p className="text-2xl font-bold">{stats.total}</p>
        </div>
        <div className="bg-yellow-50 rounded-lg shadow p-4">
          <p className="text-sm text-yellow-800">Pendientes</p>
          <p className="text-2xl font-bold text-yellow-900">{stats.pending}</p>
        </div>
        <div className="bg-blue-50 rounded-lg shadow p-4">
          <p className="text-sm text-blue-800">En Preparación</p>
          <p className="text-2xl font-bold text-blue-900">{stats.preparing}</p>
        </div>
        <div className="bg-indigo-50 rounded-lg shadow p-4">
          <p className="text-sm text-indigo-800">Enviados</p>
          <p className="text-2xl font-bold text-indigo-900">{stats.shipped}</p>
        </div>
        <div className="bg-green-50 rounded-lg shadow p-4">
          <p className="text-sm text-green-800">Entregados</p>
          <p className="text-2xl font-bold text-green-900">{stats.delivered}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Buscar por número, cliente o email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as OrderStatus | 'all')}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">Todos los estados</option>
            <option value="pending">Pendientes</option>
            <option value="payment_pending">Esperando Pago</option>
            <option value="paid">Pagados</option>
            <option value="preparing">En Preparación</option>
            <option value="shipped">Enviados</option>
            <option value="delivered">Entregados</option>
            <option value="cancelled">Cancelados</option>
            <option value="to_coordinate">A Coordinar</option>
          </select>
        </div>
      </div>

      {/* Lista de pedidos */}
      <div className="space-y-4">
        {filteredOrders.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
            No se encontraron pedidos
          </div>
        ) : (
          filteredOrders.map((order) => (
            <div key={order.id} className="bg-white rounded-lg shadow overflow-hidden">
              <div className="p-6">
                {/* Header del pedido */}
                <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">{order.order_number}</h3>
                    <p className="text-sm text-gray-600">
                      {new Date(order.created_at).toLocaleString('es-AR')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {getShippingMethodBadge(order.shipping_method)}
                    {getStatusBadge(order.status)}
                  </div>
                </div>

                {/* Info del cliente */}
                <div className="grid md:grid-cols-2 gap-4 mb-4 text-sm">
                  <div>
                    <p className="font-semibold text-gray-700">Cliente</p>
                    <p>{order.customer_name}</p>
                    <p className="text-gray-600">{order.customer_email}</p>
                    <p className="text-gray-600">{order.customer_phone}</p>
                  </div>
                  {order.customer_address && (
                    <div>
                      <p className="font-semibold text-gray-700">Dirección</p>
                      <p>{order.customer_address}</p>
                      <p className="text-gray-600">
                        {order.customer_city}, {order.customer_province}
                      </p>
                    </div>
                  )}
                </div>

                {/* Items */}
                <div className="mb-4">
                  <p className="font-semibold text-gray-700 text-sm mb-2">Productos</p>
                  <div className="space-y-2">
                    {order.items.map((item, index) => (
                      <div key={index} className="flex items-center gap-3 text-sm">
                        <img
                          src={item.image}
                          alt={item.name}
                          className="w-12 h-12 object-cover rounded"
                        />
                        <div className="flex-1">
                          <p>{item.name}</p>
                          <p className="text-gray-600">
                            {item.quantity} x ${item.price.toLocaleString()}
                          </p>
                        </div>
                        <span className="font-semibold">
                          ${(item.price * item.quantity).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Total */}
                <div className="flex justify-between items-center mb-4 pt-4 border-t">
                  <span className="font-semibold">Total</span>
                  <span className="text-xl font-bold">${order.total.toLocaleString()}</span>
                </div>

                {/* Tracking */}
                <div className="mb-4">
                  <p className="font-semibold text-gray-700 text-sm mb-2">Número de Tracking</p>
                  {editingTracking === order.id ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={trackingNumber}
                        onChange={(e) => setTrackingNumber(e.target.value)}
                        placeholder="Ingresá el número de tracking"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                      <button
                        onClick={() => handleSaveTracking(order.id)}
                        className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                      >
                        <Save size={16} />
                      </button>
                      <button
                        onClick={cancelEditTracking}
                        className="px-3 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-700 font-mono flex-1">
                        {order.tracking_number || 'Sin tracking'}
                      </span>
                      <button
                        onClick={() => startEditTracking(order)}
                        className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200 text-sm flex items-center gap-1"
                      >
                        <Edit2 size={14} />
                        Editar
                      </button>
                    </div>
                  )}
                </div>

                {/* Acciones */}
                <div className="flex flex-wrap gap-2">
                  <select
                    value={order.status}
                    onChange={(e) => handleStatusChange(order.id, e.target.value as OrderStatus)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="pending">Pendiente</option>
                    <option value="payment_pending">Esperando Pago</option>
                    <option value="paid">Pagado</option>
                    <option value="preparing">En Preparación</option>
                    <option value="shipped">Enviado</option>
                    <option value="delivered">Entregado</option>
                    <option value="cancelled">Cancelado</option>
                    <option value="to_coordinate">A Coordinar</option>
                  </select>

                  <a
                    href={`https://wa.me/54${order.customer_phone.replace(/\D/g, '')}?text=Hola ${order.customer_name}, te contactamos por tu pedido ${order.order_number}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm"
                  >
                    WhatsApp
                  </a>

                  <a
                    href={`mailto:${order.customer_email}?subject=Pedido ${order.order_number}&body=Hola ${order.customer_name},%0D%0A%0D%0ATe contactamos por tu pedido ${order.order_number}.`}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm"
                  >
                    Email
                  </a>
                </div>

                {order.notes && (
                  <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded p-3">
                    <p className="text-sm font-semibold text-yellow-800">Notas:</p>
                    <p className="text-sm text-yellow-700">{order.notes}</p>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default OrdersManagement;
