import React, { useState, useEffect } from 'react';
// Forced rebuild v3 - 22:40
import { toast } from 'sonner';
import { Product, Order } from '../types';
import { CustomOrder } from './CustomOrderForm';
import { 
  Package, ShoppingCart, Users, Settings, Plus, Search, 
  Trash2, Edit2, CheckCircle, Clock, AlertCircle, TrendingUp, 
  ChevronRight, Calendar, DollarSign, MessageCircle, Bot,
  CreditCard, FileText
} from 'lucide-react';
import { ScrollArea } from './ui/scroll-area';
import { supabase } from '../lib/supabase';
import ProductForm from './ProductForm';
import OrderDetails from './OrderDetails';
import FinancialDashboard from './FinancialDashboard';
import ArcaPanel from './ArcaPanel';
import SocialInbox from './SocialInbox';

const AdminPage = () => {
  const [activeTab, setActiveTab] = useState('orders');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // EFECTO LIMPIO SIN APP_SETTINGS
  useEffect(() => {
    console.log('🚀 Build v3 Ready: 22:40');
    // Carga inicial básica
    const init = async () => {
      setLoading(false);
    };
    init();
  }, []);

  // Lógica del Bot (Printy) simplificada al máximo
  const isPrintyOff = localStorage.getItem('printy_disabled') === 'true';

  const togglePrinty = () => {
    const nextState = !isPrintyOff;
    localStorage.setItem('printy_disabled', String(nextState));
    toast.success(`IA ${nextState ? 'Desactivada' : 'Activada'}`);
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Sidebar simplified for diagnostic */}
      <div className="w-full md:w-64 bg-white border-b md:border-r border-slate-200 flex flex-col h-auto md:h-screen sticky top-0">
        <div className="p-6 border-b border-slate-100">
            <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Package className="text-indigo-600" /> Admin Panel
            </h1>
        </div>
        
        <ScrollArea className="flex-1 px-3 py-4">
          <nav className="space-y-1">
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
            <button onClick={() => setActiveTab('social')} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${activeTab === 'social' ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-slate-600 hover:bg-slate-50'}`}>
              <MessageCircle size={18} /> Social Inbox
            </button>
          </nav>
        </ScrollArea>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 h-screen">
          {/* Header */}
          <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-8 flex-shrink-0 sticky top-0 z-10">
            <h2 className="text-lg font-semibold text-slate-800 capitalize">{activeTab.replace('-', ' ')}</h2>
            
            <div className="flex items-center gap-3">
              <button 
                onClick={togglePrinty}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-2 text-xs font-bold transition-all ${isPrintyOff ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}
              >
                <Bot size={14} /> IA: {isPrintyOff ? 'OFF' : 'ON'}
              </button>
              <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg"><Settings size={20} /></button>
            </div>
          </header>

          <main className="flex-1 overflow-auto p-4 sm:p-8 bg-slate-50">
            {activeTab === 'orders' && <div className="text-slate-500">Listado de pedidos está cargando...</div>}
            {activeTab === 'arca' && <ArcaPanel />}
            {activeTab === 'financial' && <FinancialDashboard />}
            {activeTab === 'social' && <SocialInbox />}
          </main>
      </div>
    </div>
  );
};

export default AdminPage;
