import React, { useState, useEffect, useMemo } from 'react';
import { Order, Expense, RawMaterial } from '../types';
import { 
  TrendingUp, TrendingDown, DollarSign, Calendar, Plus, Trash2, 
  AlertCircle, CheckCircle, Save, X, Filter, Download, Package 
} from 'lucide-react';
import { getExpenses, addExpense, deleteExpense, getMaterials, addMaterial, updateMaterial, deleteMaterial } from '../services/supabaseService';
import { toast } from 'sonner';

interface Props {
  orders: Order[];
}

// Categorías y Subcategorías predefinidas
const EXPENSE_CATEGORIES = {
  'Filamento': ['PLA', 'PETG', 'TPU', 'ABS', 'FLEX', 'Otros'],
  'Madera': ['MDF 3mm', 'MDF 5.5mm', 'Fibroplus Blanco', 'Fibroplus Negro', 'Otros'],
  'Insumos': ['Laca/Barniz', 'Pegamento', 'Lijas', 'Pinceles', 'Cajas/Embalaje'],
  'Mantenimiento': ['Repuestos Impresora', 'Repuestos Láser', 'Servicio Técnico', 'Limpieza'],
  'Publicidad': ['Instagram Ads', 'Google Ads', 'Folletos', 'Otros'],
  'Servicios': ['Luz', 'Internet', 'Alquiler', 'Suscripciones (Software)'],
  'Otros': ['Varios']
};

const FinancialDashboard: React.FC<Props> = ({ orders }) => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [materials, setMaterials] = useState<RawMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  
  // Estado para formularios
  const [isAddingExpense, setIsAddingExpense] = useState(false);
  const [isAddingMaterial, setIsAddingMaterial] = useState(false);
  
  const [newExpense, setNewExpense] = useState<Partial<Expense>>({
    date: new Date().toISOString().split('T')[0],
    category: 'Filamento',
    subcategory: 'PLA',
    amount: 0,
    description: ''
  });

  const [newMaterial, setNewMaterial] = useState<Partial<RawMaterial>>({
    name: '',
    category: 'Filamento',
    quantity: 0,
    unit: 'unidades',
    min_threshold: 1
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [expensesRes, materialsRes] = await Promise.all([getExpenses(), getMaterials()]);
    
    if (expensesRes.error) toast.error('Error cargando gastos');
    else setExpenses(expensesRes.data as Expense[] || []);

    if (materialsRes.error) toast.error('Error cargando stock');
    else setMaterials(materialsRes.data as RawMaterial[] || []);
    
    setLoading(false);
  };

  // Filtrar datos por mes seleccionado
  const { monthlyOrders, monthlyExpenses } = useMemo(() => {
    const startOfMonth = new Date(selectedYear, selectedMonth, 1);
    const endOfMonth = new Date(selectedYear, selectedMonth + 1, 0);

    const filteredOrders = orders.filter(o => {
      const date = new Date((o as any).timestamp || (o as any).created_at);
      return date >= startOfMonth && date <= endOfMonth && o.status !== 'cancelled';
    });

    const filteredExpenses = expenses.filter(e => {
      const [y, m] = e.date.split('-').map(Number);
      return y === selectedYear && (m - 1) === selectedMonth;
    });

    return { monthlyOrders: filteredOrders, monthlyExpenses: filteredExpenses };
  }, [orders, expenses, selectedMonth, selectedYear]);

  // Cálculos Financieros
  const financials = useMemo(() => {
    const income = monthlyOrders.reduce((sum, o) => sum + (o.total || 0), 0);
    const outcome = monthlyExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const profit = income - outcome;
    const margin = income > 0 ? ((profit / income) * 100) : 0;

    return { income, outcome, profit, margin };
  }, [monthlyOrders, monthlyExpenses]);

  // Handlers Gastos
  const handleAddExpense = async () => {
    if (!newExpense.amount || !newExpense.category || !newExpense.date) {
      toast.error('Completa los campos obligatorios');
      return;
    }
    try {
      const { error } = await addExpense(newExpense);
      if (error) throw error;
      toast.success('Gasto registrado');
      setIsAddingExpense(false);
      setNewExpense({ ...newExpense, amount: 0, description: '' }); // Reset parcial
      loadData();
    } catch (e) {
      toast.error('Error al guardar');
    }
  };

  const handleDeleteExpense = async (id: string) => {
    if (!confirm('¿Eliminar gasto?')) return;
    const { error } = await deleteExpense(id);
    if (!error) loadData();
  };

  // Handlers Materiales
  const handleAddMaterial = async () => {
    if (!newMaterial.name) return toast.error('Nombre requerido');
    try {
      const { error } = await addMaterial(newMaterial);
      if (error) throw error;
      toast.success('Insumo agregado');
      setIsAddingMaterial(false);
      setNewMaterial({ name: '', category: 'Filamento', quantity: 0, unit: 'unidades', min_threshold: 1 });
      loadData();
    } catch (e) {
      toast.error('Error al guardar insumo');
    }
  };

  const handleUpdateStock = async (id: string, current: number, delta: number) => {
    const newQty = Math.max(0, current + delta);
    const { error } = await updateMaterial(id, { quantity: newQty });
    if (!error) {
        // Optimistic update
        setMaterials(prev => prev.map(m => m.id === id ? { ...m, quantity: newQty } : m));
    }
  };

  const handleDeleteMaterial = async (id: string) => {
    if (!confirm('¿Borrar insumo del inventario?')) return;
    const { error } = await deleteMaterial(id);
    if (!error) loadData();
  };

  // Exportar Excel (CSV)
  const handleExportCSV = () => {
    const monthName = months[selectedMonth];
    const headers = ['Fecha', 'Tipo', 'Categoría', 'Detalle', 'Ingreso', 'Egreso'];
    const rows: (string)[][] = [];

    // Agregar Ingresos
    monthlyOrders.forEach(o => {
      rows.push([
        new Date((o as any).timestamp || (o as any).created_at).toLocaleDateString('es-AR'),
        'Venta',
        'Productos',
        `Orden #${o.id.slice(0,8)}`,
        o.total.toFixed(2),
        '0'
      ]);
    });

    // Agregar Gastos
    monthlyExpenses.forEach(e => {
      rows.push([
        new Date(e.date).toLocaleDateString('es-AR'),
        'Gasto',
        e.category,
        `${e.subcategory} - ${e.description || ''}`,
        '0',
        e.amount.toFixed(2)
      ]);
    });

    // Agregar Balance Final
    rows.push(['', '', '', '', '', '']);
    rows.push(['TOTALES', '', '', '', financials.income.toFixed(2), financials.outcome.toFixed(2)]);
    rows.push(['PROFIT', '', '', '', (financials.income - financials.outcome).toFixed(2), '']);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Reporte_Mensual_${monthName}_${selectedYear}.csv`;
    link.click();
  };

  const currentYear = new Date().getFullYear();
  const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12">
      
      {/* 1. Header y Filtros */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100 sticky top-0 z-10">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <DollarSign className="text-emerald-600" /> Finanzas & Stock
          </h2>
          <p className="text-sm text-slate-500">
            {months[selectedMonth]} {selectedYear}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <select 
            value={selectedMonth} 
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="p-2 border rounded-lg bg-gray-50 text-sm font-medium focus:ring-2 focus:ring-indigo-500"
          >
            {months.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>
          <select 
            value={selectedYear} 
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="p-2 border rounded-lg bg-gray-50 text-sm font-medium focus:ring-2 focus:ring-indigo-500"
          >
            {[currentYear - 1, currentYear, currentYear + 1].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          
          <button 
            onClick={handleExportCSV}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg flex items-center gap-2 hover:bg-emerald-700 transition-colors shadow-sm"
          >
            <Download size={18} />
            <span className="hidden sm:inline">Exportar Mes</span>
          </button>
        </div>
      </div>

      {/* 2. Tarjetas de Finanzas (KPIs) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-6 rounded-xl bg-linear-to-br from-emerald-500 to-emerald-600 text-white shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-20"><TrendingUp size={48} /></div>
          <p className="text-emerald-100 text-sm font-medium mb-1">Ingresos</p>
          <h3 className="text-3xl font-bold">${financials.income.toLocaleString('es-AR')}</h3>
        </div>

        <div className="p-6 rounded-xl bg-linear-to-br from-rose-500 to-rose-600 text-white shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-20"><TrendingDown size={48} /></div>
          <p className="text-rose-100 text-sm font-medium mb-1">Gastos</p>
          <h3 className="text-3xl font-bold">${financials.outcome.toLocaleString('es-AR')}</h3>
        </div>

        <div className={`p-6 rounded-xl text-white shadow-lg relative overflow-hidden ${financials.profit >= 0 ? 'bg-linear-to-br from-indigo-500 to-indigo-600' : 'bg-linear-to-br from-orange-500 to-orange-600'}`}>
          <div className="absolute top-0 right-0 p-4 opacity-20"><DollarSign size={48} /></div>
          <p className="text-indigo-100 text-sm font-medium mb-1">Ganancia Neta</p>
          <h3 className="text-3xl font-bold">${financials.profit.toLocaleString('es-AR')}</h3>
          <span className="text-xs bg-white/20 px-2 py-0.5 rounded mt-2 inline-block">Margen: {financials.margin.toFixed(1)}%</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* COLUMNA IZQUIERDA: GESTIÓN DE GASTOS */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <MinusCircleIcon className="text-rose-500" /> Registrar Gasto
              </h3>
              <button onClick={() => setIsAddingExpense(!isAddingExpense)} className="text-indigo-600 text-sm hover:underline">{isAddingExpense ? 'Cancelar' : 'Nuevo'}</button>
            </div>

            {isAddingExpense ? (
              <div className="space-y-3 animate-in fade-in slide-in-from-top-2 bg-slate-50 p-4 rounded-lg">
                <input type="date" value={newExpense.date} onChange={e => setNewExpense({...newExpense, date: e.target.value})} className="w-full p-2 border rounded text-sm"/>
                <div className="grid grid-cols-2 gap-2">
                  <div className="relative">
                    <span className="absolute left-2 top-2 text-slate-400">$</span>
                    <input type="number" placeholder="0.00" value={newExpense.amount || ''} onChange={e => setNewExpense({...newExpense, amount: Number(e.target.value)})} className="w-full p-2 pl-6 border rounded text-sm"/>
                  </div>
                  <select value={newExpense.category} onChange={e => setNewExpense({...newExpense, category: e.target.value as any, subcategory: EXPENSE_CATEGORIES[e.target.value as keyof typeof EXPENSE_CATEGORIES][0]})} className="w-full p-2 border rounded text-sm">
                    {Object.keys(EXPENSE_CATEGORIES).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>
                <select value={newExpense.subcategory} onChange={e => setNewExpense({...newExpense, subcategory: e.target.value})} className="w-full p-2 border rounded text-sm">
                    {EXPENSE_CATEGORIES[newExpense.category as keyof typeof EXPENSE_CATEGORIES]?.map(sub => <option key={sub} value={sub}>{sub}</option>)}
                </select>
                <input type="text" placeholder="Descripción..." value={newExpense.description || ''} onChange={e => setNewExpense({...newExpense, description: e.target.value})} className="w-full p-2 border rounded text-sm"/>
                <button onClick={handleAddExpense} className="w-full py-2 bg-rose-600 text-white rounded font-medium hover:bg-rose-700">Guardar Gasto</button>
              </div>
            ) : (
              <div className="text-center p-4 border-2 border-dashed border-gray-200 rounded-lg text-slate-400 hover:border-rose-300 hover:bg-rose-50 cursor-pointer transition-all" onClick={() => setIsAddingExpense(true)}>
                <Plus className="mx-auto mb-1" />
                <span className="text-sm">Nuevo Gasto</span>
              </div>
            )}

            {/* Mini Lista de Gastos Recientes */}
            <div className="mt-6">
              <h4 className="text-xs font-bold text-slate-400 uppercase mb-3">Últimos Movimientos</h4>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {monthlyExpenses.map(e => (
                  <div key={e.id} className="flex justify-between items-center text-sm p-2 hover:bg-gray-50 rounded border border-transparent hover:border-gray-100 group">
                    <div>
                      <p className="font-medium text-slate-700">{e.subcategory}</p>
                      <p className="text-xs text-slate-400">{new Date(e.date).toLocaleDateString('es-AR', {day: '2-digit', month:'2-digit'})}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-rose-600">-${e.amount}</span>
                      <button onClick={() => handleDeleteExpense(e.id)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={14}/></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* COLUMNA DERECHA: STOCK DE INSUMOS */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b bg-gray-50 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <Package className="text-indigo-600" /> Stock de Insumos
                </h3>
                <p className="text-xs text-slate-500">Control de materia prima</p>
              </div>
              <button onClick={() => setIsAddingMaterial(true)} className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded hover:bg-indigo-700 flex items-center gap-1">
                <Plus size={14} /> Agregar
              </button>
            </div>

            {/* Formulario Agregar Material (Modal/Inline) */}
            {isAddingMaterial && (
              <div className="p-4 bg-indigo-50 border-b border-indigo-100 animate-in fade-in">
                <div className="flex flex-wrap gap-2 items-end">
                  <div className="flex-1 min-w-[150px]">
                    <label className="text-xs text-indigo-800 font-bold">Nombre</label>
                    <input type="text" placeholder="Ej: Grilon PLA Blanco" value={newMaterial.name} onChange={e => setNewMaterial({...newMaterial, name: e.target.value})} className="w-full p-2 text-sm border rounded" />
                  </div>
                  <div className="w-32">
                    <label className="text-xs text-indigo-800 font-bold">Categoría</label>
                    <select value={newMaterial.category} onChange={e => setNewMaterial({...newMaterial, category: e.target.value as any})} className="w-full p-2 text-sm border rounded">
                      <option value="Filamento">Filamento</option>
                      <option value="Madera">Madera</option>
                      <option value="Insumos">Insumos</option>
                      <option value="Otros">Otros</option>
                    </select>
                  </div>
                  <div className="w-24">
                    <label className="text-xs text-indigo-800 font-bold">Cantidad</label>
                    <input type="number" value={newMaterial.quantity} onChange={e => setNewMaterial({...newMaterial, quantity: Number(e.target.value)})} className="w-full p-2 text-sm border rounded" />
                  </div>
                  <div className="w-24">
                    <label className="text-xs text-indigo-800 font-bold">Unidad</label>
                    <select value={newMaterial.unit} onChange={e => setNewMaterial({...newMaterial, unit: e.target.value})} className="w-full p-2 text-sm border rounded">
                      <option value="unidades">Unidades</option>
                      <option value="kg">Kg</option>
                      <option value="rollos">Rollos</option>
                      <option value="placas">Placas</option>
                      <option value="litros">Litros</option>
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleAddMaterial} className="px-4 py-2 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700">Guardar</button>
                    <button onClick={() => setIsAddingMaterial(false)} className="px-3 py-2 bg-white text-slate-600 border rounded text-sm hover:bg-gray-50">Cancelar</button>
                  </div>
                </div>
              </div>
            )}

            {/* Tabla de Stock */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-slate-500 text-xs uppercase">
                  <tr>
                    <th className="px-4 py-3 text-left">Insumo</th>
                    <th className="px-4 py-3 text-left">Categoría</th>
                    <th className="px-4 py-3 text-center">Cantidad</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {materials.map(m => (
                    <tr key={m.id} className="hover:bg-gray-50 group">
                      <td className="px-4 py-3 font-medium text-slate-700">
                        {m.name}
                        {m.quantity <= m.min_threshold && (
                          <span className="ml-2 inline-flex items-center gap-1 text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-100">
                            <AlertCircle size={10} /> Bajo Stock
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-500">{m.category}</td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => handleUpdateStock(m.id, m.quantity, -1)} className="w-6 h-6 rounded bg-gray-100 text-slate-600 hover:bg-gray-200 flex items-center justify-center">-</button>
                          <span className={`w-12 text-center font-bold ${m.quantity <= m.min_threshold ? 'text-red-600' : 'text-slate-700'}`}>
                            {m.quantity} {m.unit}
                          </span>
                          <button onClick={() => handleUpdateStock(m.id, m.quantity, 1)} className="w-6 h-6 rounded bg-gray-100 text-slate-600 hover:bg-gray-200 flex items-center justify-center">+</button>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => handleDeleteMaterial(m.id)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors">
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {materials.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-slate-400">
                        No hay insumos cargados. ¡Agrega tu primer material!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

// Icono Helper
const MinusCircleIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="12" r="10"/><path d="M8 12h8"/>
  </svg>
);

export default FinancialDashboard;
