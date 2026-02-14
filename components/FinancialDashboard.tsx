import React, { useState, useEffect, useMemo } from 'react';
import { Order, Expense } from '../types';
import { 
  TrendingUp, TrendingDown, DollarSign, Calendar, Plus, Trash2, 
  AlertCircle, CheckCircle, Save, X, Filter 
} from 'lucide-react';
import { getExpenses, addExpense, deleteExpense } from '../services/supabaseService';
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
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  
  // Estado para el formulario de nuevo gasto
  const [isAdding, setIsAdding] = useState(false);
  const [newExpense, setNewExpense] = useState<Partial<Expense>>({
    date: new Date().toISOString().split('T')[0],
    category: 'Filamento',
    subcategory: 'PLA',
    amount: 0,
    description: ''
  });

  // Cargar gastos al iniciar
  useEffect(() => {
    loadExpenses();
  }, []);

  const loadExpenses = async () => {
    setLoading(true);
    const { data, error } = await getExpenses();
    if (error) {
      console.error('Error cargando gastos:', error);
      toast.error('No se pudieron cargar los gastos');
    } else {
      setExpenses(data as Expense[] || []);
    }
    setLoading(false);
  };

  // Filtrar datos por mes seleccionado
  const { monthlyOrders, monthlyExpenses } = useMemo(() => {
    const startOfMonth = new Date(selectedYear, selectedMonth, 1);
    const endOfMonth = new Date(selectedYear, selectedMonth + 1, 0); // Último día del mes

    const filteredOrders = orders.filter(o => {
      const date = new Date((o as any).timestamp || (o as any).created_at); // Usar timestamp o created_at
      return date >= startOfMonth && date <= endOfMonth && o.status !== 'cancelled';
    });

    const filteredExpenses = expenses.filter(e => {
      const date = new Date(e.date);
      // Ajuste de zona horaria simple: tomamos la fecha tal cual viene del string YYYY-MM-DD
      // Para comparar mes y año, usamos substring o componentes UTC para evitar lios de timezone
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

  // Manejo del formulario
  const handleAddExpense = async () => {
    if (!newExpense.amount || !newExpense.category || !newExpense.date) {
      toast.error('Completa los campos obligatorios');
      return;
    }

    try {
      const { error } = await addExpense(newExpense);
      if (error) throw error;
      
      toast.success('Gasto registrado correctamente');
      setIsAdding(false);
      setNewExpense({
        date: new Date().toISOString().split('T')[0],
        category: 'Filamento',
        subcategory: 'PLA',
        amount: 0,
        description: ''
      });
      loadExpenses(); // Recargar lista
    } catch (e) {
      console.error(e);
      toast.error('Error al guardar el gasto');
    }
  };

  const handleDeleteExpense = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este gasto?')) return;
    try {
      const { error } = await deleteExpense(id);
      if (error) throw error;
      toast.success('Gasto eliminado');
      loadExpenses();
    } catch (e) {
      toast.error('Error al eliminar');
    }
  };

  const currentYear = new Date().getFullYear();
  const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* 1. Header y Filtros */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <DollarSign className="text-emerald-600" /> Finanzas & Control
          </h2>
          <p className="text-sm text-slate-500">Balance mensual de ingresos y egresos</p>
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
          <button onClick={loadExpenses} className="p-2 hover:bg-gray-100 rounded-lg text-slate-600">
            <Filter size={20} />
          </button>
        </div>
      </div>

      {/* 2. Tarjetas de Resumen (KPIs) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Ingresos */}
        <div className="p-6 rounded-xl bg-linear-to-br from-emerald-500 to-emerald-600 text-white shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-20"><TrendingUp size={48} /></div>
          <p className="text-emerald-100 text-sm font-medium mb-1">Ingresos (Ventas)</p>
          <h3 className="text-3xl font-bold">${financials.income.toLocaleString('es-AR')}</h3>
          <p className="text-xs mt-2 opacity-80">{monthlyOrders.length} ventas registradas</p>
        </div>

        {/* Egresos */}
        <div className="p-6 rounded-xl bg-linear-to-br from-rose-500 to-rose-600 text-white shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-20"><TrendingDown size={48} /></div>
          <p className="text-rose-100 text-sm font-medium mb-1">Gastos Operativos</p>
          <h3 className="text-3xl font-bold">${financials.outcome.toLocaleString('es-AR')}</h3>
          <p className="text-xs mt-2 opacity-80">{monthlyExpenses.length} movimientos</p>
        </div>

        {/* Ganancia Neta */}
        <div className={`p-6 rounded-xl text-white shadow-lg relative overflow-hidden ${financials.profit >= 0 ? 'bg-linear-to-br from-indigo-500 to-indigo-600' : 'bg-linear-to-br from-orange-500 to-orange-600'}`}>
          <div className="absolute top-0 right-0 p-4 opacity-20"><DollarSign size={48} /></div>
          <p className="text-indigo-100 text-sm font-medium mb-1">Ganancia Neta (Profit)</p>
          <h3 className="text-3xl font-bold">${financials.profit.toLocaleString('es-AR')}</h3>
          <div className="flex items-center gap-2 mt-2">
            <span className={`px-2 py-0.5 rounded text-xs font-bold ${financials.profit >= 0 ? 'bg-emerald-400 text-emerald-900' : 'bg-red-400 text-red-900'}`}>
              {financials.margin.toFixed(1)}% Margen
            </span>
          </div>
        </div>
      </div>

      {/* 3. Área de Gestión */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Formulario de Carga */}
        <div className="lg:col-span-1">
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm sticky top-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-slate-800">Registrar Gasto</h3>
              <button 
                onClick={() => setIsAdding(!isAdding)}
                className="text-indigo-600 text-sm hover:underline"
              >
                {isAdding ? 'Cancelar' : 'Nuevo'}
              </button>
            </div>

            {isAdding ? (
              <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                <div>
                  <label className="text-xs font-medium text-slate-500">Fecha</label>
                  <input 
                    type="date"
                    value={newExpense.date}
                    onChange={e => setNewExpense({...newExpense, date: e.target.value})}
                    className="w-full p-2 border rounded-lg text-sm"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-medium text-slate-500">Monto</label>
                    <div className="relative">
                      <span className="absolute left-2 top-2 text-slate-400">$</span>
                      <input 
                        type="number"
                        placeholder="0.00"
                        value={newExpense.amount || ''}
                        onChange={e => setNewExpense({...newExpense, amount: Number(e.target.value)})}
                        className="w-full p-2 pl-6 border rounded-lg text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-500">Categoría</label>
                    <select 
                      value={newExpense.category}
                      onChange={e => setNewExpense({
                        ...newExpense, 
                        category: e.target.value as any, 
                        subcategory: EXPENSE_CATEGORIES[e.target.value as keyof typeof EXPENSE_CATEGORIES][0]
                      })}
                      className="w-full p-2 border rounded-lg text-sm"
                    >
                      {Object.keys(EXPENSE_CATEGORIES).map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-500">Subcategoría (Tipo)</label>
                  <select 
                    value={newExpense.subcategory}
                    onChange={e => setNewExpense({...newExpense, subcategory: e.target.value})}
                    className="w-full p-2 border rounded-lg text-sm bg-gray-50"
                  >
                    {EXPENSE_CATEGORIES[newExpense.category as keyof typeof EXPENSE_CATEGORIES]?.map(sub => (
                      <option key={sub} value={sub}>{sub}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-500">Descripción (Opcional)</label>
                  <input 
                    type="text"
                    placeholder="Ej: 5 rollos Grilon, Pago luz febrero..."
                    value={newExpense.description || ''}
                    onChange={e => setNewExpense({...newExpense, description: e.target.value})}
                    className="w-full p-2 border rounded-lg text-sm"
                  />
                </div>

                <button 
                  onClick={handleAddExpense}
                  className="w-full py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 flex items-center justify-center gap-2 mt-2 transition-colors"
                >
                  <Save size={16} /> Guardar Gasto
                </button>
              </div>
            ) : (
              <div 
                onClick={() => setIsAdding(true)}
                className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center cursor-pointer hover:border-indigo-300 hover:bg-indigo-50 transition-all group"
              >
                <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-2 text-indigo-600 group-hover:scale-110 transition-transform">
                  <Plus size={20} />
                </div>
                <p className="text-sm font-medium text-slate-600">Agregar nuevo movimiento</p>
              </div>
            )}
          </div>
        </div>

        {/* Lista de Gastos */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
              <h3 className="font-bold text-slate-800">Detalle de Gastos ({months[selectedMonth]})</h3>
              <span className="text-xs font-mono bg-white border px-2 py-1 rounded text-slate-500">
                {monthlyExpenses.length} registros
              </span>
            </div>
            
            <div className="max-h-[500px] overflow-y-auto">
              {monthlyExpenses.length === 0 ? (
                <div className="p-8 text-center text-slate-400">
                  <p>No hay gastos registrados en este mes.</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-slate-500 text-xs uppercase sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-left">Fecha</th>
                      <th className="px-4 py-3 text-left">Concepto</th>
                      <th className="px-4 py-3 text-right">Monto</th>
                      <th className="px-4 py-3 text-center">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {monthlyExpenses.map(expense => (
                      <tr key={expense.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                          {new Date(expense.date).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col">
                            <span className="font-medium text-slate-700">{expense.category} - {expense.subcategory}</span>
                            {expense.description && (
                              <span className="text-xs text-slate-400">{expense.description}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-rose-600">
                          - ${expense.amount.toLocaleString('es-AR')}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button 
                            onClick={() => handleDeleteExpense(expense.id)}
                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default FinancialDashboard;
