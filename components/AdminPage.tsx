import React, { useState, useEffect } from 'react';
// Final Layout Protection 22:48
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
    // Forzamos que el body no tenga scrolls raros del layout principal
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'auto'; };
  }, []);

  const isPrintyOff = localStorage.getItem('printy_disabled') === 'true';

  const togglePrinty = () => {
    const nextState = !isPrintyOff;
    localStorage.setItem('printy_disabled', String(nextState));
    toast.success(`IA ${nextState ? 'Desactivada' : 'Activada'}`);
    window.location.reload();
  };

  return (
    // CONTENEDOR DE PROTECCIÓN: Este div ocupa toda la pantalla y tapa cualquier Navbar externo
    <div className="fixed inset-0 z-[9999] bg-white flex flex-col md:flex-row overflow-hidden font-sans">
      
      {/* Sidebar Fiel al Estilo 3D2 Admin */}
      <aside className="w-full md:w-64 bg-slate-900 text-slate-300 flex flex-col h-auto md:h-screen flex-shrink-0">
        <div className="p-6 border-b border-slate-800 flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                <Package className="text-white" size={20} />
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">3D2 Admin</h1>
        </div>
        
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
            <button onClick={() => setActiveTab('orders')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'orders' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20' : 'hover:bg-slate-800 hover:text-white'}`}>
              <ShoppingCart size={18} /> Pedidos
            </button>
            <button onClick={() => setActiveTab('products')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'products' ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-800 hover:text-white' && activeTab === 'products' ? 'bg-indigo-600 text-white' : 'text-slate-400' }` && activeTab === 'products' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800'}>
              <Package size={18} /> Productos
            </button>
            <button onClick={() => setActiveTab('arca')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'arca' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20' : 'hover:bg-slate-800 hover:text-white'}`}>
              <FileText size={18} /> ARCA (AFIP)
            </button>
            <button onClick={() => setActiveTab('financial')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'financial' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20' : 'hover:bg-slate-800 hover:text-white'}`}>
              <TrendingUp size={18} /> Finanzas
            </button>
            <button onClick={() => setActiveTab('sales')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'sales' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20' : 'hover:bg-slate-800 hover:text-white'}`}>
              <BarChart2 size={18} /> Ventas
            </button>
        </nav>

        <div className="p-4 border-t border-slate-800">
            <div className="flex items-center gap-3 px-4 py-3 bg-slate-800/50 rounded-xl">
                <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold text-xs">AD</div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">Admin 3D2</p>
                    <p className="text-xs text-slate-500 truncate">Soporte Técnico</p>
                </div>
            </div>
        </div>
      </aside>

      {/* Area de Contenido - Independiente */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-50">
          <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-10 flex-shrink-0">
            <div>
                <p className="text-sm text-slate-500 font-medium">Panel de Control</p>
                <h2 className="text-2xl font-bold text-slate-800 capitalize">{activeTab}</h2>
            </div>
            
            <div className="flex items-center gap-4">
              <button 
                onClick={togglePrinty}
                className={`px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-bold transition-all shadow-sm ${isPrintyOff ? 'bg-rose-50 text-rose-600 border border-rose-200' : 'bg-emerald-50 text-emerald-600 border border-emerald-200'}`}
              >
                <Bot size={18} /> IA: {isPrintyOff ? 'OFF' : 'ON'}
              </button>
              <button className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all">
                <Settings size={22} />
              </button>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto p-10">
            <div className="max-w-[1600px] mx-auto">
                {activeTab === 'orders' && <OrdersManagement />}
                {activeTab === 'products' && <ProductAdmin />}
                {activeTab === 'arca' && <ArcaPanel />}
                {activeTab === 'financial' && <FinancialDashboard />}
                {activeTab === 'sales' && <SalesDashboard />}
            </div>
          </main>
      </div>
    </div>
  );
};

export default AdminPage;
