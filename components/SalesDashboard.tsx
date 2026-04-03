import React, { useState, useEffect, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Order, Payment, OrderStatus } from '../types';
import { getFiscalConfig, FiscalConfig } from '../services/configService';
import { TrendingUp, Package, DollarSign, Clock, Download, Calendar, CheckCircle, Loader, XCircle, Trash2, RefreshCw, Truck, Edit, AlertCircle, Plus, Wallet, CreditCard, Banknote, History, Printer, Calculator, ShieldCheck, Info } from 'lucide-react';

interface Props {
  orders: Order[];
  payments?: Payment[];
  onUpdateStatus?: (orderId: string, newStatus: OrderStatus) => void;
  onEdit?: (order: Order) => void;
  onDelete?: (orderId: string) => void;
  onRecordPayment?: (orderId: string, amount: number, method: Payment['method']) => void;
  onRefresh?: () => void;
  onPatchOrder?: (orderId: string, updates: Partial<Order>) => void;
  onDeletePayment?: (paymentId: string) => void;
}

type DateFilter = 'today' | 'week' | 'month' | 'all';
type StatusFilter = 'all' | 'completed' | 'processing' | 'pending';

const SalesDashboard: React.FC<Props> = ({ orders, payments, onUpdateStatus, onEdit, onDelete, onRecordPayment, onRefresh, onPatchOrder, onDeletePayment }) => {
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [billingFilter, setBillingFilter] = useState<'all' | 'invoiced' | 'pending'>('all');
  const [recordingPaymentId, setRecordingPaymentId] = useState<string | null>(null);
  const [editingInvoicingId, setEditingInvoicingId] = useState<string | null>(null);
  const [newPayAmount, setNewPayAmount] = useState<string>('');
  const [newPayMethod, setNewPayMethod] = useState<Payment['method']>('efectivo');
  const [fiscalConfig, setFiscalConfig] = useState<FiscalConfig | null>(null);

  React.useEffect(() => {
    getFiscalConfig().then(setFiscalConfig);
  }, []);
  
  // Billing local state
  const [billDni, setBillDni] = useState('');
  const [billType, setBillType] = useState<'Consumidor Final' | 'A' | 'B' | 'C'>('Consumidor Final');
  const [invNum, setInvNum] = useState('');

  // Helper para parsear info extra de notas de forma robusta
  const getExtraInfo = (notes?: string | null) => {
    if (!notes) return { debt: 0, delivery: null };
    
    // Regex mejorada para capturar montos con puntos, comas y espacios opcionales
    const debtMatch = notes.match(/RESTA:\s*\$([\d\.,\s]+)/i);
    const deliveryMatch = notes.match(/ENTREGA: (\d{1,2})\/(\d{1,2})\/(\d{4})/);
    
    let debt = 0;
    if (debtMatch) {
       // Limpiar caracteres no numéricos excepto el punto decimal
       const cleanNumber = debtMatch[1].replace(/\./g, '').replace(',', '.').replace(/\s/g, '');
       debt = parseFloat(cleanNumber) || 0;
    }

    return {
      debt,
      delivery: deliveryMatch ? `${deliveryMatch[1]}/${deliveryMatch[2]}` : null
    };
  };

  const filteredOrders = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    return orders.filter(o => {
      const ts = (o as any).timestamp || (o as any).created_at;
      const orderDate = ts ? new Date(ts) : new Date(0);
      
      const matchesDate = (() => {
        switch (dateFilter) {
          case 'today': return orderDate >= todayStart;
          case 'week': return orderDate >= weekStart;
          case 'month': return orderDate >= monthStart;
          default: return true;
        }
      })();

      const matchesBilling = (() => {
        if (billingFilter === 'all') return true;
        if (billingFilter === 'invoiced') return o.is_invoiced === true;
        if (billingFilter === 'pending') return !o.is_invoiced;
        return true;
      })();

      const isNotAbandonedCart = o.status !== 'payment_pending';

      return matchesDate && matchesBilling && isNotAbandonedCart;
    });
  }, [orders, dateFilter, billingFilter]);

  const displayedOrders = useMemo(() => {
    return filteredOrders.filter(o => {
      if (statusFilter === 'all') return true;
      if (statusFilter === 'completed') return ['paid', 'delivered', 'completed'].includes(o.status as any);
      if (statusFilter === 'processing') return ['preparing', 'processing', 'shipped'].includes(o.status as any);
      if (statusFilter === 'pending') return ['pending', 'to_coordinate'].includes(o.status as any);
      return true;
    });
  }, [filteredOrders, statusFilter]);

  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 150);
    return () => clearTimeout(timer);
  }, []);

  const metrics = useMemo(() => {
    // 1. Filtrar órdenes canceladas
    const activeOrders = filteredOrders.filter(o => o.status !== 'cancelled');

    // 2. Calcular Ingresos Reales por FECHA DE PAGO (Timeline real)
    // Buscamos pagos que ocurrieron en el rango de fechas seleccionado
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const filteredPayments = (payments || []).filter(p => {
      const pDate = new Date(p.date);
      switch (dateFilter) {
        case 'today': return pDate >= todayStart;
        case 'week': return pDate >= weekStart;
        case 'month': return pDate >= monthStart;
        default: return true;
      }
    });

    const totalRealIncomeFromPayments = filteredPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
    
    // 3. Monotributo Metrics
    const invoicingStartDate = fiscalConfig?.start_date ? new Date(fiscalConfig.start_date) : new Date('2026-04-01');
    
    const invoicedOrders = activeOrders.filter(o => {
      const orderDate = new Date((o as any).timestamp || (o as any).created_at);
      if (orderDate < invoicingStartDate) return false;
      
      const isML = o.notes?.includes('Venta automática desde MercadoLibre');
      return o.is_invoiced || isML;
    });

    const pendingInvoiceOrders = activeOrders.filter(o => {
      const orderDate = new Date((o as any).timestamp || (o as any).created_at);
      if (orderDate < invoicingStartDate) return false;
      
      const isML = o.notes?.includes('Venta automática desde MercadoLibre');
      return !o.is_invoiced && !isML;
    });
    
    const invoicedTotal = invoicedOrders.reduce((sum, o) => sum + (o.total || 0), 0);
    const pendingInvoiceTotal = pendingInvoiceOrders.reduce((sum, o) => sum + (o.total || 0), 0);

    // 4. FALLBACK: Sumar ingresos de órdenes que NO tienen pagos registrados en la nueva tabla (Legacy)
    // Esto evita que el dashboard se vea en $0 si el usuario tiene mucha historia en notas.
    let legacyIncome = 0;
    activeOrders.forEach(o => {
      const hasExplicitPayments = (payments || []).some(p => p.order_id === o.id);
      if (!hasExplicitPayments) {
        // Verificar si la ORDEN entra en el rango de fecha seleccionado
        const ts = (o as any).timestamp || (o as any).created_at;
        const oDate = ts ? new Date(ts) : new Date(0);
        let inRange = false;
        switch (dateFilter) {
          case 'today': inRange = oDate >= todayStart; break;
          case 'week': inRange = oDate >= weekStart; break;
          case 'month': inRange = oDate >= monthStart; break;
          default: inRange = true;
        }

        if (inRange && o.status !== 'payment_pending' && o.status !== 'cancelled') {
          const { debt } = getExtraInfo(o.notes);
          legacyIncome += Math.max(0, (o.total || 0) - debt);
        }
      }
    });

    const totalRealIncome = totalRealIncomeFromPayments + legacyIncome;

    // 4. Desglose por Medio de Pago (Solo de pagos explícitos)
    const byMethod = {
      efectivo: filteredPayments.filter(p => p.method === 'efectivo').reduce((sum, p) => sum + p.amount, 0),
      transferencia: filteredPayments.filter(p => p.method === 'transferencia').reduce((sum, p) => sum + p.amount, 0),
      mercadopago: filteredPayments.filter(p => p.method === 'mercadopago').reduce((sum, p) => sum + p.amount, 0),
      otro: filteredPayments.filter(p => p.method === 'otro').reduce((sum, p) => sum + p.amount, 0),
    };
    
    // Si hay ingresos legacy, los movemos a "otro" o un campo especial para que el total coincida
    byMethod.otro += legacyIncome;

    const completed = activeOrders.filter(o => ['paid','delivered','completed'].includes(o.status as any)).length;
    const pending = activeOrders.filter(o => ['pending','to_coordinate'].includes(o.status as any)).length;
    const processing = activeOrders.filter(o => ['preparing','payment_pending','processing','shipped'].includes(o.status as any)).length;
    
    // Deuda Total (Para información visual)
    const totalDebt = activeOrders.reduce((sum, o) => sum + getExtraInfo(o.notes).debt, 0);

    // Productos más vendidos (Ranking por cantidad)
    const productCount: Record<string, { count: number; total: number; name: string }> = {};
    activeOrders.forEach(order => {
      // Ignorar carritos abandonados para top productos
      if (order.status === 'payment_pending' || order.status === 'cancelled') return;
      
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

    return { 
      total: totalRealIncome, 
      totalDebt, 
      byMethod, 
      completed, 
      pending, 
      processing, 
      topProducts,
      invoicedTotal,
      pendingInvoiceTotal,
      invoicedCount: invoicedOrders.length,
      pendingInvoiceCount: pendingInvoiceOrders.length
    };
  }, [filteredOrders, payments, dateFilter]);

  const handleExportCSV = () => {
    const headers = ['ID', 'Fecha', 'Cliente', 'Email', 'Teléfono', 'Total', 'Método Pago', 'Estado', 'Productos', 'Notas/Deuda'];
    const rows = filteredOrders.map(o => [
      o.id,
      new Date((o as any).timestamp || (o as any).created_at).toLocaleString('es-AR'),
      (o as any).customer?.name || (o as any).customer_name,
      (o as any).customer?.email || (o as any).customer_email,
      (o as any).customer?.phone || (o as any).customer_phone,
      o.total.toFixed(2),
      (o as any).paymentMethod || ((o as any).payment_id ? 'mercadopago' : 'otro'),
      o.status,
      o.items.filter(i => !i.name.startsWith('[EMPAQUE]')).map(i => `${i.name} (x${i.quantity})`).join('; '),
      o.notes || ''
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

  const handleStatusClick = (order: Order, nextStatus: string) => {
    const { debt } = getExtraInfo(order.notes);
    
    // Si hay deuda y estamos avanzando el estado (a procesar o completar), preguntar si se paga.
    if (debt > 0 && (nextStatus === 'processing' || nextStatus === 'completed') && onPatchOrder) {
        const shouldPay = window.confirm(
            `Esta orden tiene una deuda pendiente de $${debt.toLocaleString('es-AR')}.\n\n¿Deseas registrar el PAGO TOTAL y borrar la deuda?\n\n[ACEPTAR] = Sí, saldar deuda y cambiar estado.\n[CANCELAR] = No, mantener deuda y cambiar estado.`
        );
        
        if (shouldPay) {
            // Eliminar variaciones de [RESTA: $...] o RESTA: $...
            // Regex explicación:
            // \[?  -> Corchete opcional al inicio
            // RESTA:\s*\$ -> Texto literal "RESTA: $" con espacios opcionales
            // [\d\.,]+ -> Numeros, puntos y comas
            // \]? -> Corchete opcional al final
            let newNotes = (order.notes || '').replace(/\[?RESTA:\s*\$[\d\.,\s]+\]?/gi, '').trim();
            if (!newNotes.includes('[PAGADO TOTAL]')) {
                newNotes += ' [PAGADO TOTAL]';
            }
            onPatchOrder(order.id, { status: nextStatus as any, notes: newNotes });
        } else {
             onUpdateStatus && onUpdateStatus(order.id, nextStatus as any);
        }
    } else {
        onUpdateStatus && onUpdateStatus(order.id, nextStatus as any);
    }
  };

  const handlePrintReceipt = (order: Order) => {
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) return alert('Por favor habilitá las ventanas emergentes (pop-ups) para imprimir el recibo.');

    const receiptHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Comprobante de Pedido #${order.order_number || order.id.slice(0,8)}</title>
        <style>
          @page { margin: 10mm; size: A4; }
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333; line-height: 1.3; font-size: 11px; padding: 0; max-width: 100%; margin: 0 auto; box-sizing: border-box; }
          h1, h2, h3, p { margin: 0; padding: 0; }
          .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 10px; }
          .header img { width: 45px; height: 45px; object-fit: cover; border-radius: 50%; margin-bottom: 5px; }
          .header h1 { color: #4f46e5; font-size: 20px; }
          .header p { color: #666; font-size: 11px; margin-top: 2px; }
          .warning { text-align: center; background: #f3f4f6; padding: 5px; font-size: 10px; color: #666; border: 1px solid #e5e7eb; margin-bottom: 15px; }
          .details { display: flex; justify-content: space-between; margin-bottom: 15px; }
          .details div { flex: 1; }
          .details h3 { font-size: 13px; border-bottom: 1px solid #eee; padding-bottom: 2px; margin-bottom: 5px; color: #4f46e5; }
          .details p { margin-bottom: 3px; }
          table { border-collapse: collapse; margin-bottom: 15px; width: 100%; border: 1px solid #eee; }
          th, td { padding: 6px; text-align: left; border-bottom: 1px solid #eee; font-size: 11px; }
          th { background-color: #f9fafb; font-weight: bold; padding: 8px 6px; }
          td { padding-top: 8px; padding-bottom: 8px; }
          .item-name { max-width: 250px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: inline-block; }
          .total { text-align: right; font-size: 14px; font-weight: bold; background: #f9fafb; padding: 10px; border: 1px solid #eee; }
          .notes { margin-top: 15px; padding: 8px; background: #fafafa; border-left: 3px solid #4f46e5; font-size: 10px; }
          .footer { margin-top: 20px; text-align: center; font-size: 10px; color: #999; border-top: 1px solid #eee; padding-top: 10px; }
        </style>
      </head>
      <body>
        <div class="header">
          <img src="${window.location.origin}/LOGO.jpg" alt="3D2 Logo" onerror="this.style.display='none'" />
          <h1>3D2 Impresiones</h1>
          <p>Impresión 3D y Corte Láser</p>
        </div>
        
        <div class="warning">
          <strong>Documento No Fiscal</strong> - Comprobante interno de pedido para el cliente.
        </div>

        <div class="details">
          <div>
            <h3>Datos del Cliente</h3>
            <p><strong>Nombre:</strong> ${(order as any).customer?.name || (order as any).customer_name || 'N/A'}</p>
            <p><strong>Email:</strong> ${(order as any).customer?.email || (order as any).customer_email || 'N/A'}</p>
            <p><strong>Teléfono:</strong> ${(order as any).customer?.phone || (order as any).customer_phone || 'N/A'}</p>
          </div>
          <div style="text-align: right;">
            <h3>Detalles del Pedido</h3>
            <p><strong>N° de Pedido:</strong> ${order.order_number || order.id.slice(0,8)}</p>
            <p><strong>Fecha:</strong> ${new Date((order as any).timestamp || (order as any).created_at).toLocaleDateString('es-AR')}</p>
            <p><strong>Método de Pago:</strong> ${((order as any).method === 'mercadopago' || (order as any).payment_id) ? 'MercadoPago' : ((order as any).paymentMethod === 'transfer' ? 'Transferencia' : 'Otro')}</p>
            <p><strong>Estado:</strong> ${order.status.toUpperCase()}</p>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Producto</th>
              <th>Cantidad</th>
              <th>Precio Unit.</th>
              <th style="text-align: right;">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${(order.items || []).filter(item => !item.name.startsWith('[EMPAQUE]')).map(item => `
              <tr>
                <td><span class="item-name" title="${item.name}">${item.name}</span></td>
                <td>${item.quantity}</td>
                <td>$${Number(item.price).toLocaleString('es-AR')}</td>
                <td style="text-align: right;">$${Number(item.price * item.quantity).toLocaleString('es-AR')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="total">
          <p>Total a Pagar: $${Number(order.total).toLocaleString('es-AR')}</p>
        </div>

        ${order.notes ? `
        <div class="notes">
          <strong>Notas del Pedido:</strong><br/>
          ${order.notes.replace(/\n/g, '<br/>')}
        </div>
        ` : ''}

        <div class="footer">
          <p style="font-weight: bold; color: #333; margin-bottom: 5px;">¡Gracias por confiar en 3D2!</p>
          <p>Para dudas o reclamos sobre tu pedido:</p>
          <p style="margin-top: 5px;">
            <strong>Web:</strong> www.creart3d2.com &nbsp; | &nbsp; 
            <strong>WhatsApp:</strong> 11 7128-5516 &nbsp; | &nbsp; 
            <strong>Instagram:</strong> @3d2_creart
          </p>
          <div style="margin-top: 10px; font-size: 9px; color: #bbb;">
            © ${new Date().getFullYear()} 3D2 - Impresión 3D & Corte Láser
          </div>
        </div>
        
        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(receiptHtml);
    printWindow.document.close();
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

      {/* Selector de Estado de Facturación (Preparación Monotributo) */}
      <div className="flex flex-wrap gap-2 bg-slate-100 p-1 rounded-xl w-fit border border-slate-200 shadow-xs">
          <button 
            onClick={() => setBillingFilter('all')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${billingFilter === 'all' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Todas las Órdenes
          </button>
          <button 
            onClick={() => setBillingFilter('pending')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${billingFilter === 'pending' ? 'bg-white shadow-sm text-amber-600' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Pendientes Factura ({metrics.pendingInvoiceCount})
          </button>
          <button 
            onClick={() => setBillingFilter('invoiced')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${billingFilter === 'invoiced' ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Facturadas ✅ ({metrics.invoicedCount})
          </button>
      </div>

      {/* Métricas principales con Enfoque Monotributo/ARCA */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Facturado (Visión Contable) */}
        <div className="bg-linear-to-br from-indigo-600 to-indigo-700 rounded-xl p-4 sm:p-6 text-white shadow-lg relative overflow-hidden group">
           <Calculator className="absolute -bottom-2 -right-2 text-white/10 group-hover:scale-110 transition-transform" size={80} />
           <div className="flex items-center justify-between mb-2">
             <DollarSign size={20} className="opacity-80 sm:w-6 sm:h-6" />
             <CheckCircle size={16} className="text-indigo-200" />
           </div>
           <p className="text-[10px] sm:text-xs uppercase font-bold opacity-80 mb-1 tracking-wider">Total Facturado (ARCA)</p>
           <p className="text-2xl sm:text-3xl font-black">${metrics.invoicedTotal.toLocaleString('es-AR')}</p>
           <p className="text-[10px] mt-2 bg-white/10 px-2 py-0.5 rounded-full w-fit">{metrics.invoicedCount} facturas emitidas</p>
        </div>

        {/* Pendiente de Facturación (Visión Contable) */}
        <div className="bg-linear-to-br from-amber-500 to-orange-600 rounded-xl p-4 sm:p-6 text-white shadow-lg relative overflow-hidden group">
           <AlertCircle className="absolute -bottom-2 -right-2 text-white/10 group-hover:scale-110 transition-transform" size={80} />
           <div className="flex items-center justify-between mb-2">
             <Calendar size={20} className="opacity-80 sm:w-6 sm:h-6" />
             <Loader size={16} className="text-amber-200 animate-pulse" />
           </div>
           <p className="text-[10px] sm:text-xs uppercase font-bold opacity-80 mb-1 tracking-wider">Pendiente Facturar</p>
           <p className="text-2xl sm:text-3xl font-black">${metrics.pendingInvoiceTotal.toLocaleString('es-AR')}</p>
           <p className="text-[10px] mt-2 bg-black/10 px-2 py-0.5 rounded-full w-fit">{metrics.pendingInvoiceCount} ventas por registrar</p>
        </div>

        <div className="bg-linear-to-br from-indigo-500 to-indigo-600 rounded-xl p-4 sm:p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <DollarSign size={20} className="opacity-80 sm:w-6 sm:h-6" />
            <TrendingUp size={16} className="opacity-60 sm:w-5 sm:h-5" />
          </div>
          <p className="text-xs sm:text-sm opacity-90 mb-1 font-bold">Total Cobrado (Caja Real)</p>
          <p className="text-2xl sm:text-3xl font-bold">${metrics.total.toLocaleString('es-AR')}</p>
          {metrics.totalDebt > 0 && (
            <div className="text-[10px] sm:text-xs bg-black/20 px-2 py-0.5 rounded mt-2 inline-flex items-center gap-1 border border-white/10">
              <AlertCircle size={10} className="text-yellow-300" />
              <span>Pendiente: ${metrics.totalDebt.toLocaleString('es-AR')}</span>
            </div>
          )}
        </div>

        <div 
          onClick={() => setStatusFilter('all')}
          className={`bg-linear-to-br from-green-500 to-green-600 rounded-xl p-4 sm:p-6 text-white shadow-lg cursor-pointer hover:scale-[1.02] hover:shadow-xl transition-all ${statusFilter === 'all' ? 'ring-4 ring-offset-2 ring-green-400' : ''}`}
        >
          <div className="flex items-center justify-between mb-2">
            <Package size={20} className="opacity-80 sm:w-6 sm:h-6" />
          </div>
          <p className="text-xs sm:text-sm opacity-90 mb-1">Órdenes (Todas)</p>
          <p className="text-2xl sm:text-3xl font-bold">{filteredOrders.length}</p>
        </div>

        <div 
          onClick={() => setStatusFilter('processing')}
          className={`bg-linear-to-br from-blue-500 to-blue-600 rounded-xl p-4 sm:p-6 text-white shadow-lg cursor-pointer hover:scale-[1.02] hover:shadow-xl transition-all ${statusFilter === 'processing' ? 'ring-4 ring-offset-2 ring-blue-400' : ''}`}
        >
          <div className="flex items-center justify-between mb-2">
            <Clock size={20} className="opacity-80 sm:w-6 sm:h-6" />
          </div>
          <p className="text-xs sm:text-sm opacity-90 mb-1">En Proceso</p>
          <p className="text-2xl sm:text-3xl font-bold">{metrics.processing}</p>
        </div>

        <div 
          onClick={() => setStatusFilter('pending')}
          className={`bg-purple-500 rounded-xl p-4 sm:p-6 text-white shadow-lg cursor-pointer hover:scale-[1.02] hover:shadow-xl transition-all ${statusFilter === 'pending' ? 'ring-4 ring-offset-2 ring-purple-400' : ''}`}
        >
          <div className="flex items-center justify-between mb-2">
            <Calendar size={20} className="opacity-80 sm:w-6 sm:h-6" />
          </div>
          <p className="text-xs sm:text-sm opacity-90 mb-1">Pendientes</p>
          <p className="text-2xl sm:text-3xl font-bold">{metrics.pending}</p>
        </div>
      </div>

      {/* Desglose de Caja por Medio de Pago */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center gap-3">
             <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg"><Banknote size={20}/></div>
             <div>
                <p className="text-[10px] uppercase font-bold text-slate-400">Efectivo</p>
                <p className="text-lg font-bold text-slate-700">${metrics.byMethod.efectivo.toLocaleString('es-AR')}</p>
             </div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center gap-3">
             <div className="p-2 bg-blue-100 text-blue-600 rounded-lg"><Wallet size={20}/></div>
             <div>
                <p className="text-[10px] uppercase font-bold text-slate-400">Transferencia</p>
                <p className="text-lg font-bold text-slate-700">${metrics.byMethod.transferencia.toLocaleString('es-AR')}</p>
             </div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center gap-3">
             <div className="p-2 bg-yellow-100 text-yellow-600 rounded-lg"><CreditCard size={20}/></div>
             <div>
                <p className="text-[10px] uppercase font-bold text-slate-400">MercadoPago</p>
                <p className="text-lg font-bold text-slate-700">${metrics.byMethod.mercadopago.toLocaleString('es-AR')}</p>
             </div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center gap-3">
             <div className="p-2 bg-slate-100 text-slate-600 rounded-lg"><Plus size={20}/></div>
             <div>
                <p className="text-[10px] uppercase font-bold text-slate-400">Otros / Varios</p>
                <p className="text-lg font-bold text-slate-700">${metrics.byMethod.otro.toLocaleString('es-AR')}</p>
             </div>
          </div>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        
        {/* Gráfico de Ventas por Producto (Top 5) */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h4 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <TrendingUp size={20} className="text-indigo-600" />
            Top 5 Productos (Ingresos)
          </h4>
          <div className="h-64 w-full min-w-0 overflow-hidden">
            {mounted && (
              <ResponsiveContainer width="100%" height={256}>
                <BarChart data={metrics.topProducts} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorBar" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.9}/>
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.6}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(val) => val.length > 10 ? val.slice(0, 10)+'...' : val} />
                <YAxis fontSize={11} tickLine={false} axisLine={false} tickFormatter={(val) => `$${(val/1000)}k`} />
                <Tooltip 
                  cursor={{fill: '#f1f5f9'}}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: number) => [`$${value.toLocaleString('es-AR')}`, 'Ingresos']} 
                />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Gráfico de Distribución de Ingresos */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h4 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Banknote size={20} className="text-emerald-600" />
            Distribución de Ingresos
          </h4>
          <div className="h-64 w-full min-w-0 overflow-hidden">
            {(mounted && metrics.total > 0) ? (
              <ResponsiveContainer width="100%" height={256}>
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Efectivo', value: metrics.byMethod.efectivo, color: '#10b981' },
                      { name: 'Transf.', value: metrics.byMethod.transferencia, color: '#3b82f6' },
                      { name: 'MercadoPago', value: metrics.byMethod.mercadopago, color: '#eab308' },
                      { name: 'Otros', value: metrics.byMethod.otro, color: '#64748b' }
                    ].filter(d => d.value > 0)}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {[
                      { name: 'Efectivo', value: metrics.byMethod.efectivo, color: '#10b981' },
                      { name: 'Transf.', value: metrics.byMethod.transferencia, color: '#3b82f6' },
                      { name: 'MercadoPago', value: metrics.byMethod.mercadopago, color: '#eab308' },
                      { name: 'Otros', value: metrics.byMethod.otro, color: '#64748b' }
                    ].filter(d => d.value > 0).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: number) => [`$${value.toLocaleString('es-AR')}`, 'Monto']} 
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            ) : !mounted ? null : (
              <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                No hay ingresos en este período
              </div>
            )}
          </div>
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
          <div 
            onClick={() => setStatusFilter('completed')}
            className={`text-center p-4 rounded-lg border cursor-pointer hover:shadow-md hover:scale-105 transition-all ${statusFilter === 'completed' ? 'bg-green-100 border-green-500 ring-2 ring-green-400' : 'bg-green-50 border-green-200'}`}
          >
            <p className="text-2xl font-bold text-green-600">{metrics.completed}</p>
            <p className="text-sm text-slate-600 mt-1">Completadas</p>
          </div>
          <div 
            onClick={() => setStatusFilter('processing')}
            className={`text-center p-4 rounded-lg border cursor-pointer hover:shadow-md hover:scale-105 transition-all ${statusFilter === 'processing' ? 'bg-blue-100 border-blue-500 ring-2 ring-blue-400' : 'bg-blue-50 border-blue-200'}`}
          >
            <p className="text-2xl font-bold text-blue-600">{metrics.processing}</p>
            <p className="text-sm text-slate-600 mt-1">En Proceso</p>
          </div>
          <div 
            onClick={() => setStatusFilter('pending')}
            className={`text-center p-4 rounded-lg border cursor-pointer hover:shadow-md hover:scale-105 transition-all ${statusFilter === 'pending' ? 'bg-amber-100 border-amber-500 ring-2 ring-amber-400' : 'bg-amber-50 border-amber-200'}`}
          >
            <p className="text-2xl font-bold text-amber-600">{metrics.pending}</p>
            <p className="text-sm text-slate-600 mt-1">Pendientes</p>
          </div>
        </div>
      </div>

      {/* Lista detallada de órdenes */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b bg-gray-50 flex items-center justify-between">
          <div>
            <h4 className="text-lg font-bold text-slate-900">
              {statusFilter === 'all' && 'Todas las Órdenes'}
              {statusFilter === 'completed' && 'Órdenes Completadas'}
              {statusFilter === 'processing' && 'Órdenes En Proceso'}
              {statusFilter === 'pending' && 'Órdenes Pendientes'}
            </h4>
            <p className="text-sm text-slate-500 mt-1">{displayedOrders.length} órdenes mostradas</p>
          </div>
          {statusFilter !== 'all' && (
            <button 
               onClick={() => setStatusFilter('all')}
               className="text-sm text-indigo-600 hover:text-indigo-800 font-bold bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors border border-indigo-100"
            >
              Quitar Filtro
            </button>
          )}
        </div>
        <div className="divide-y">
          {displayedOrders.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              <Package size={48} className="mx-auto mb-4 opacity-30" />
              <p>No hay órdenes para mostrar</p>
            </div>
          ) : (
            displayedOrders.sort((a, b) => {
              const aTime = new Date((a as any).timestamp || (a as any).created_at).getTime();
              const bTime = new Date((b as any).timestamp || (b as any).created_at).getTime();
              return bTime - aTime;
            }).map(order => {
              const { debt, delivery } = getExtraInfo(order.notes);
              return (
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
                      
                      {/* Delivery Date Tag */}
                      {delivery && (
                         <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-bold border border-purple-200">
                            ENTREGA: {delivery}
                         </span>
                      )}
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

                    {/* Facturación / Monotributo Section */}
                    <div className={`rounded-lg p-4 mb-3 border ${order.is_invoiced ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
                      <div className="flex items-center justify-between mb-3">
                         <p className="text-sm font-bold text-slate-700 flex items-center gap-2">
                           <Calculator size={16} className={order.is_invoiced ? 'text-emerald-600' : 'text-slate-400'} />
                           Información de Facturación
                         </p>
                         {order.is_invoiced ? (
                           <span className="px-2 py-0.5 bg-emerald-600 text-white text-[10px] font-black rounded-lg shadow-sm">FACTURADO</span>
                         ) : (
                           <span className="px-2 py-0.5 bg-slate-200 text-slate-500 text-[10px] font-bold rounded-lg uppercase">Pendiente AFIP</span>
                         ) }
                      </div>

                      {editingInvoicingId === order.id ? (
                        <div className="space-y-3 p-2 bg-white rounded border border-indigo-100 shadow-sm">
                           <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase">DNI / CUIT</label>
                                <input type="text" value={billDni} onChange={e => setBillDni(e.target.value)} className="w-full p-2 text-xs border rounded font-mono" placeholder="20-30405060-7"/>
                              </div>
                              <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase">Tipo Factura</label>
                                <select value={billType} onChange={e => setBillType(e.target.value as any)} className="w-full p-2 text-xs border rounded bg-slate-50">
                                   <option value="Consumidor Final">Cons. Final</option>
                                   <option value="B">Factura B</option>
                                   <option value="C">Factura C</option>
                                   <option value="A">Factura A</option>
                                </select>
                              </div>
                           </div>
                           <div>
                              <label className="text-[10px] font-bold text-slate-400 uppercase">Nº de Comprobante / Factura</label>
                              <input type="text" value={invNum} onChange={e => setInvNum(e.target.value)} className="w-full p-2 text-xs border rounded font-mono" placeholder="00001-00000123"/>
                           </div>
                           <div className="flex gap-2 pt-1">
                             <button 
                                onClick={() => {
                                  if (onPatchOrder) {
                                    onPatchOrder(order.id, {
                                      is_invoiced: true,
                                      billing_dni_cuit: billDni,
                                      billing_type: billType,
                                      invoice_number: invNum
                                    });
                                    setEditingInvoicingId(null);
                                  }
                                }}
                                className="flex-1 py-1.5 bg-emerald-600 text-white rounded text-[10px] font-bold hover:bg-emerald-700"
                             >
                               Confirmar Facturado
                             </button>
                             <button 
                                onClick={() => setEditingInvoicingId(null)}
                                className="px-3 py-1.5 bg-slate-100 text-slate-500 rounded text-[10px] font-bold"
                             >
                               Cancelar
                             </button>
                           </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                          {order.notes?.includes('Venta automática desde MercadoLibre') ? (
                            <div className="col-span-full bg-blue-50 border border-blue-200 p-3 rounded-lg flex items-center gap-3">
                              <ShieldCheck className="text-blue-600 shrink-0" size={24} />
                              <div>
                                <p className="text-[10px] font-black text-blue-900 uppercase">Facturación Protegida</p>
                                <p className="text-[11px] text-blue-700 leading-tight">Configurada en MercadoLibre. Factura generada automáticamente.</p>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="text-slate-600">
                                 <p className="text-[9px] uppercase font-bold text-slate-400 mb-0.5">DNI/CUIT Receptor</p>
                                 <p className="font-mono text-xs">{order.billing_dni_cuit || 'No registrado'}</p>
                              </div>
                              <div className="text-slate-600">
                                 <p className="text-[9px] uppercase font-bold text-slate-400 mb-0.5">Tipo de Factura</p>
                                 <p className="font-bold text-xs">{order.billing_type || 'Pendiente'}</p>
                              </div>
                              {order.invoice_number && (
                                <div className="col-span-full bg-white p-2 rounded border border-dashed border-emerald-200 text-emerald-800">
                                   <p className="text-[9px] uppercase font-bold text-emerald-400 mb-0.5 text-center">Nº de Factura</p>
                                   <p className="font-mono text-sm font-black text-center">{order.invoice_number}</p>
                                </div>
                              )}
                              <button 
                                onClick={() => {
                                  setEditingInvoicingId(order.id);
                                  setBillDni(order.billing_dni_cuit || '');
                                  setBillType(order.billing_type || 'Consumidor Final');
                                  setInvNum(order.invoice_number || '');
                                }}
                                className="col-span-full py-2 border-2 border-dashed border-slate-300 text-slate-500 rounded-lg hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all flex items-center justify-center gap-2 text-xs font-bold"
                              >
                                 {order.is_invoiced ? <Plus size={14}/> : <Calculator size={14}/>}
                                 {order.is_invoiced ? 'Editar Datos de Factura' : 'Registrar Facturación (AFIP)'}
                              </button>
                            </>
                          )}
                        </div>
                      )}
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

                    {/* DEUDA EN ROJO */}
                    {debt > 0 && (
                      <div className="bg-red-50 border border-red-200 p-3 rounded-lg mb-3 animate-in fade-in slide-in-from-top-1">
                         <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2 text-red-700 font-bold text-sm">
                              <AlertCircle size={16} />
                              DEUDA PENDIENTE:
                            </div>
                            <div className="text-red-700 font-extrabold text-lg">
                              ${debt.toLocaleString('es-AR')}
                            </div>
                         </div>
                         
                         {/* Botón para registrar pago rápido */}
                         {onRecordPayment && recordingPaymentId !== order.id && (
                           <button 
                             onClick={() => {
                               setRecordingPaymentId(order.id);
                               setNewPayAmount(debt.toString());
                             }}
                             className="w-full py-1.5 bg-white border border-red-200 text-red-600 rounded text-xs font-bold hover:bg-red-50 transition-colors flex items-center justify-center gap-1"
                           >
                             <Plus size={14}/> Registrar Pago de esta orden
                           </button>
                         )}

                         {recordingPaymentId === order.id && (
                           <div className="bg-white p-3 rounded border border-red-100 shadow-sm mt-2 space-y-3">
                              <div className="flex items-center gap-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase">Monto a Cobrar</label>
                                <input 
                                  type="number" 
                                  value={newPayAmount} 
                                  onChange={e => setNewPayAmount(e.target.value)}
                                  className="flex-1 p-1.5 text-sm border rounded font-bold text-slate-700" 
                                />
                              </div>
                              <div className="flex gap-2">
                                {(['efectivo', 'transferencia', 'mercadopago'] as const).map(m => (
                                  <button
                                    key={m}
                                    onClick={() => setNewPayMethod(m)}
                                    className={`flex-1 py-1.5 text-[10px] font-bold rounded border transition-all ${
                                      newPayMethod === m ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 text-slate-500'
                                    }`}
                                  >
                                    {m === 'efectivo' && 'Efectivo'}
                                    {m === 'transferencia' && 'Transf.'}
                                    {m === 'mercadopago' && 'MP'}
                                  </button>
                                ))}
                              </div>
                              <div className="flex gap-2 mt-2">
                                <button 
                                  onClick={() => {
                                    if (Number(newPayAmount) > 0) {
                                      onRecordPayment(order.id, Number(newPayAmount), newPayMethod);
                                      setRecordingPaymentId(null);
                                    }
                                  }}
                                  className="flex-1 py-2 bg-green-600 text-white rounded text-xs font-bold hover:bg-green-700"
                                >
                                  Confirmar Pago
                                </button>
                                <button 
                                  onClick={() => setRecordingPaymentId(null)}
                                  className="px-3 py-2 bg-slate-100 text-slate-500 rounded text-xs font-bold"
                                >
                                  Cerrar
                                </button>
                              </div>
                           </div>
                         )}
                      </div>
                    )}

                    {/* Timeline de Pagos - NUEVO */}
                    {payments && payments.filter(p => p.order_id === order.id).length > 0 && (
                      <div className="mb-3">
                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-2 flex items-center gap-1">
                          <History size={10}/> Historial de Pagos
                        </p>
                        <div className="space-y-1">
                          {payments.filter(p => p.order_id === order.id).map(p => (
                            <div key={p.id} className="flex items-center justify-between bg-slate-50 p-2 rounded text-xs border border-dashed border-slate-200">
                               <div className="flex items-center gap-2">
                                  <span className="text-slate-400">{new Date(p.date).toLocaleDateString('es-AR')}</span>
                                  <span className="font-bold text-indigo-600 bg-indigo-50 px-1.5 rounded uppercase text-[9px]">{p.method}</span>
                               </div>
                               <div className="flex items-center gap-2">
                                 <b className="text-emerald-600 font-mono">+${p.amount.toLocaleString('es-AR')}</b>
                                 {onDeletePayment && (
                                   <button onClick={() => onDeletePayment(p.id)} className="text-slate-300 hover:text-red-500 transition-colors bg-white rounded p-1 shadow-xs border border-slate-100" title="Eliminar pago">
                                     <Trash2 size={12}/>
                                   </button>
                                 )}
                               </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

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
                      <div className="flex flex-col">
                        {order.notes?.includes('[NETO ML: $') ? (
                          <>
                            <span className="text-xs font-bold text-slate-400 uppercase">Total Bruto</span>
                            <span className="text-sm font-bold text-slate-500 line-through opacity-50">${order.total.toFixed(2)}</span>
                          </>
                        ) : (
                          <span className="text-sm font-medium text-slate-700">Total:</span>
                        )}
                      </div>
                      
                      <div className="text-right flex flex-col items-end">
                        {order.notes?.includes('[NETO ML: $') ? (
                          <>
                            <span className="text-[10px] font-bold text-indigo-400 uppercase mb-0.5">Neto Real en Mano</span>
                            <span className="text-xl font-black text-indigo-600">
                              ${order.notes.match(/\[NETO ML: \$([\d\.,\s]+)\]/i)?.[1] || order.total.toFixed(2)}
                            </span>
                          </>
                        ) : (
                          <span className="text-xl font-bold text-indigo-600">${order.total.toFixed(2)}</span>
                        )}

                        <div className="flex gap-2 mt-1">
                          {order.notes?.includes('[LIQUIDADO]') && (
                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 flex items-center gap-1 w-fit">
                              <CheckCircle size={10} /> ML LIQUIDADO
                            </span>
                          )}
                          {order.notes?.includes('[COSTOS ML:') && (
                            <span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100 flex items-center gap-1 w-fit cursor-help" title={order.notes.match(/\[COSTOS ML: (.*?)\]/)?.[1]}>
                              <Calculator size={10} /> Ver Comisiones
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2 lg:w-64">
                    
                    {/* Botón Editar - NUEVO */}
                    {onEdit && (
                       <button
                          onClick={() => onEdit(order)}
                          className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 shadow-sm"
                       >
                         <Edit size={14} />
                         Editar Venta
                       </button>
                    )}

                    <button
                      onClick={() => handlePrintReceipt(order)}
                      className="px-4 py-2 bg-slate-800 text-white rounded-md text-sm hover:bg-slate-900 transition-colors flex items-center justify-center gap-2 shadow-sm"
                    >
                      <Printer size={14} />
                      Imprimir Recibo
                    </button>

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
                              alert('No se pudo descargar la etiqueta.');
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
                            alert('Error inesperado al descargar la etiqueta.');
                          }
                        }}
                        className="px-4 py-2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md text-sm hover:bg-indigo-100 transition-colors flex items-center justify-center gap-2"
                      >
                        <Download size={14} />
                        Etiqueta ML
                      </button>
                    )}

                    {/* Botón Liquidar ML */}
                    {order.notes?.includes('Venta automática desde MercadoLibre') && !order.notes?.includes('[LIQUIDADO]') && onPatchOrder && (
                      <button
                        onClick={() => {
                          if (window.confirm('¿Confirmar que MercadoLibre ya te pagó esta venta? Esto la sacará de "Pendientes de Liquidar" en el Dashboard.')) {
                            onPatchOrder(order.id, { notes: (order.notes || '').trim() + '\n[LIQUIDADO]' });
                          }
                        }}
                        className="px-4 py-2 bg-emerald-600 text-white rounded-md text-sm hover:bg-emerald-700 shadow-sm transition-colors flex items-center justify-center gap-2"
                      >
                        <DollarSign size={14} />
                        Marcar como Liquidado
                      </button>
                    )}

                    {/* Botones de estado solo si onUpdateStatus existe */}
                    {onUpdateStatus && (
                      <>
                        {order.status === 'pending' && (
                          <button
                            onClick={() => handleStatusClick(order, 'processing')}
                            className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                          >
                            <Loader size={14} />
                            Procesar
                          </button>
                        )}
                        {order.status === 'processing' && (
                          <button
                            onClick={() => handleStatusClick(order, 'completed')}
                            className="px-4 py-2 bg-green-600 text-white rounded-md text-sm hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                          >
                            <CheckCircle size={14} />
                            Completar
                          </button>
                        )}
                        {order.status !== 'cancelled' && (
                          <button
                            onClick={() => onUpdateStatus(order.id, 'cancelled')}
                            className="px-4 py-2 bg-red-50 text-red-700 border border-red-200 rounded-md text-sm hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
                          >
                            <XCircle size={14} />
                            Cancelar
                          </button>
                        )}
                      </>
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
                </div>
              </div>
            )})
          )}
        </div>
      </div>
    </div>
  );
};

export default SalesDashboard;
