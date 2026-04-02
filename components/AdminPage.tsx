import React, { useState, useEffect } from 'react';
// Final Stabilization 22:45 - No UI/ScrollArea
import { toast } from 'sonner';
import { 
  Package, ShoppingCart, Settings, TrendingUp, 
  Bot, FileText, BarChart2
} from 'lucide-react';
import { ArcaPanel } from './ArcaPanel';
import FinancialDashboard from './FinancialDashboard';
import SalesDashboard from './SalesDashboard';
import ProductAdmin from './ProductAdmin';
import OrdersManagement from './OrdersManagement';

const AdminPage = () => {
  const [activeTab, setActiveTab] = useState('orders');

  useEffect(() => {
    console.log('🚀 Build v3.2 Ready (Full Stability)');
  }, []);

  const isPrintyOff = localStorage.getItem('printy_disabled') === 'true';

  const togglePrinty = () => {
    const nextState = !isPrintyOff;
    localStorage.setItem('printy_disabled', String(nextState));
    toast.success(`IA ${nextState ? 'Desactivada' : 'Activada'}`);
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Sidebar con scroll nativo */}
      <div className="w-full md:w-64 bg-white border-r border-slate-200 flex flex-col h-auto md:h-screen sticky top-0">
        <div className="p-6 border-b border-slate-100 flex items-center gap-2">
            <Package className="text-indigo-600" /> 
            <h1 className="text-xl font-bold text-slate-800">3D2 Admin</h1>
        </div>
        
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
            <button onClick={() => setActiveTab('orders')} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${activeTab === 'orders' ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-slate-600 hover:bg-slate-50'}`}>
              <ShoppingCart size={18} /> Pedidos
            </button>
            <button onClick={() => setActiveTab('products')} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${activeTab === 'products' ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-slate-600 hover:bg-slate-50'}`}>
              <Package size={18} /> Productos
            </button>
            <button onClick={() => setActiveTab('arca')} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${activeTab === 'arca' ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-slate-600 hover:bg-slate-50'}`}>
              <FileText size={18} /> ARCA (AFIP)
            </button>
            <button onClick={() => setActiveTab('financial')} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${activeTab === 'financial' ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-slate-600 hover:bg-slate-50'}`}>
              <TrendingUp size={18} /> Finanzas
            </button>
            <button onClick={() => setActiveTab('sales')} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${activeTab === 'sales' ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-slate-600 hover:bg-slate-50'}`}>
              <BarChart2 size={18} /> Ventas
            </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0">
          <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 flex-shrink-0">
            <h2 className="text-lg font-semibold text-slate-800 capitalize">{activeTab}</h2>
            
            <div className="flex items-center gap-3">
              <button 
                onClick={togglePrinty}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-2 text-xs font-bold transition-all shadow-sm ${isPrintyOff ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}
              >
                <Bot size={14} /> IA: {isPrintyOff ? 'OFF' : 'ON'}
              </button>
              <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg"><Settings size={20} /></button>
            </div>
          </header>

          <main className="flex-1 overflow-auto p-8 bg-slate-50">
            {activeTab === 'orders' && <OrdersManagement />}
            {activeTab === 'products' && <ProductAdmin />}
            {activeTab === 'arca' && <ArcaPanel />}
            {activeTab === 'financial' && <FinancialDashboard />}
            {activeTab === 'sales' && <SalesDashboard />}
          </main>
      </div>
    </div>
  );
};

export default AdminPage;
