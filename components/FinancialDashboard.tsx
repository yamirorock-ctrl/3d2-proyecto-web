import React, { useState, useEffect, useMemo } from 'react';
import { Order, Expense, RawMaterial, Product } from '../types';
import { 
  TrendingUp, TrendingDown, DollarSign, Calendar, Plus, Trash2, 
  AlertCircle, CheckCircle, Save, X, Filter, Download, Package, Edit2,
  Settings, Clock
} from 'lucide-react';
import SmartImage from './SmartImage';
import { getExpenses, addExpense, updateExpense, deleteExpense, getMaterials, addMaterial, updateMaterial, deleteMaterial } from '../services/supabaseService';
import { toast } from 'sonner';

interface Props {
  orders: Order[];
  products: Product[];
  onEditProduct: (p: Product) => void;
}

const FILAMENT_BRANDS = ['Grilon', 'Printalot', '3n3', 'Elegoo', 'GST3D', 'Extrules', 'Creality', 'Otros'];
const FILAMENT_TYPES = ['PLA', 'PLA+', 'SILK', 'PETG', 'TPU', 'ABS', 'Carbono', 'ASA', 'Nylon', 'Otros'];

// Categorías y Subcategorías predefinidas (Base)
const DEFAULT_EXPENSE_CATEGORIES = {
  'Filamento': ['PLA', 'PETG', 'TPU', 'ABS', 'FLEX', 'Otros'],
  'Madera': ['MDF 3mm', 'MDF 5.5mm', 'Fibroplus Blanco', 'Fibroplus Negro', 'Otros'],
  'Insumos': [
    'Laca/Barniz', 'Pegamento', 'Lijas', 'Pinceles', 'Cajas/Embalaje',
    'Vaso Aluminio 500cc', 'Vaso Aluminio 600cc', 'Vaso Aluminio 750cc', 'Vaso Aluminio 1L',
    'Polímero Mate', 'Bombillas'
  ],
  'Mantenimiento': ['Repuestos Impresora', 'Repuestos Láser', 'Servicio Técnico', 'Limpieza'],
  'Publicidad': ['Instagram Ads', 'Google Ads', 'Folletos', 'Otros'],
  'Servicios': ['Luz', 'Internet', 'Alquiler', 'Suscripciones (Software)'],
  'Otros': ['Varios']
};

// Icono Helper
const MinusCircleIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="12" r="10"/><path d="M8 12h8"/>
  </svg>
);

const FinancialDashboard: React.FC<Props> = ({ orders, products, onEditProduct }) => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [materials, setMaterials] = useState<RawMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  
  // Estado para formularios
  const [isAddingExpense, setIsAddingExpense] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [isAddingMaterial, setIsAddingMaterial] = useState(false);
  const [editingMaterialId, setEditingMaterialId] = useState<string | null>(null);
  
  const [activeView, setActiveView] = useState<'manager' | 'calculator'>('manager');
  const [costConfig, setCostConfig] = useState({
    kwhPrice: 175,
    machineHourCost: 200,
    kwhConsumption: 0.12,
    genericFilamentPrice: 21000,
  });
  
  const [addToInventory, setAddToInventory] = useState(false);
  const [quantityToAdd, setQuantityToAdd] = useState(1);

  // Estados para Filamentos estructurados
  const [filBrand, setFilBrand] = useState('Grilon');
  const [filType, setFilType] = useState('PLA');
  const [filColor, setFilColor] = useState('');

  // Estados para Madera estructurada
  const [woodType, setWoodType] = useState('MDF 3mm');
  const [woodExtraCount, setWoodExtraCount] = useState(0);

  // Sincronizar nombre de material filamento automáticamente
  useEffect(() => {
    if (newMaterial.category === 'Filamento' && !editingMaterialId) {
      setNewMaterial(prev => ({
        ...prev,
        name: `${filBrand} ${filType} ${filColor}`.trim()
      }));
    }
  }, [filBrand, filType, filColor]);

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

  const [customCategories, setCustomCategories] = useState<Record<string, string[]>>(() => {
    try {
      const saved = localStorage.getItem('customCategories');
      return saved ? JSON.parse(saved) : DEFAULT_EXPENSE_CATEGORIES;
    } catch {
      return DEFAULT_EXPENSE_CATEGORIES;
    }
  });

  const handleAddPredeterminado = (cat: string | undefined, value: string | undefined) => {
    const cleanCat = cat || 'Otros';
    const cleanValue = (value || '').trim();
    if (!cleanValue) return toast.error('Nombre inválido');
    
    setCustomCategories(prev => {
       const existingList = prev[cleanCat] || [];
       if (existingList.includes(cleanValue)) {
         toast.error('Ya existe en la lista predeterminada');
         return prev;
       }
       const nextCat = [...existingList, cleanValue];
       const nextState = { ...prev, [cleanCat]: nextCat };
       localStorage.setItem('customCategories', JSON.stringify(nextState));
       toast.success(`Guardado: ${cleanValue}`);
       return nextState;
    });
  };

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

  // Helper para extraer deuda de las notas
  const getDebt = (notes?: string | null) => {
    if (!notes) return 0;
    // Busca variaciones de RESTA: $5000, RESTA: $ 5.000, etc.
    const match = notes.match(/RESTA:\s*\$([\d\.,\s]+)/i);
    if (match) {
       // Limpiar puntos y comas para parsear número
       const cleanNumber = match[1].replace(/\./g, '').replace(',', '.').replace(/\s/g, '');
       return parseFloat(cleanNumber) || 0;
    }
    return 0;
  };

  // Cálculos Financieros
  const financials = useMemo(() => {
    let salesTotal = 0; // Lo facturado total
    let debtTotal = 0;  // Lo que falta cobrar
    let mlPending = 0;  // A liquidar en ML
    let totalHours = 0; // Total de horas máquina del mes
    
    monthlyOrders.forEach(o => {
        salesTotal += (o.total || 0);

        // Si es venta automática de ML, la plata siempre está "a liquidar" y no físicamente en caja inmediata.
        if (o.notes && o.notes.includes('Venta automática desde MercadoLibre')) {
           mlPending += (o.total || 0);
        } else {
           debtTotal += getDebt(o.notes);
        }

        // Calcular horas máquina consumidas por esta orden
        if (o.items && Array.isArray(o.items)) {
          o.items.forEach(item => {
            // Buscamos el producto por ID (numeric o string)
            const prod = products.find(p => p.id.toString() === item.product_id?.toString());
            if (prod && prod.printingTime) {
                totalHours += prod.printingTime * (item.quantity || 1);
            }
          });
        }
    });

    const income = salesTotal - debtTotal - mlPending; // Ingreso Real Fisico (Caja)
    // El profit lo calculamos con TODAS las ventas netas del mes (Caja + ML a liquidar)
    const netRevenue = salesTotal - debtTotal; 
    const outcome = monthlyExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const profit = netRevenue - outcome;
    const margin = netRevenue > 0 ? ((profit / netRevenue) * 100) : 0;

    return { salesTotal, debtTotal, mlPending, income, outcome, profit, margin, totalHours };
  }, [monthlyOrders, monthlyExpenses, products]);

  // Handlers Gastos
  const handleAddExpense = async () => {
    if (!newExpense.amount || !newExpense.category || !newExpense.date) {
      toast.error('Completa los campos obligatorios');
      return;
    }
    try {
      if (editingExpenseId) {
          // Actualizar Gasto Existente
          const { error } = await updateExpense(editingExpenseId, newExpense);
          if (error) throw error;
          toast.success('Gasto actualizado');
      } else {
          // 1. Guardar Nuevo Gasto
          const { error } = await addExpense(newExpense);
          if (error) throw error;

          // 2. Si se marcó "Pasar al Inventario", actualizar/crear material
          if (addToInventory) {
            let materialName = newExpense.subcategory;
            let secondaryMaterialName = ''; // For extra cuts
            let secondaryQuantity = 0;
            
            // Si es filamento, usamos el nombre estructurado
            if (newExpense.category === 'Filamento') {
                materialName = `${filBrand} ${filType} ${filColor}`.trim();
            } else if (newExpense.category === 'Madera') {
                // Si es madera desde el formulario complejo
                if (woodType) {
                   materialName = `${woodType} 40x40`;
                   if (woodExtraCount > 0) {
                      secondaryMaterialName = `${woodType} 40x17`;
                      secondaryQuantity = woodExtraCount;
                   }
                }
            }

            if (!materialName) {
                toast.error('Nombre de material principal inválido para el inventario');
                return;
            }

            // --- Guardar Material Principal ---
            const existingMaterial = materials.find(m => m.name === materialName);
            let primaryCost = (newExpense.amount || 0) / (quantityToAdd + secondaryQuantity); // Aproximado parejo de costo

            if (existingMaterial) {
              await updateMaterial(existingMaterial.id, { 
                quantity: Number(existingMaterial.quantity) + Number(quantityToAdd),
                last_cost: primaryCost
              });
            } else {
              let unitToSave = newExpense.category === 'Filamento' ? 'kg' : (newExpense.category === 'Madera' ? 'placas' : 'unidades');
              await addMaterial({
                name: materialName,
                category: newExpense.category === 'Filamento' ? 'Filamento' : (newExpense.category === 'Madera' ? 'Madera' : (newExpense.category === 'Insumos' ? 'Insumos' : 'Otros')),
                quantity: quantityToAdd,
                unit: unitToSave,
                min_threshold: 1,
                last_cost: primaryCost
              });
            }

            // --- Guardar Material Secundario (Retazos) si existen ---
            if (secondaryMaterialName && secondaryQuantity > 0) {
                const existingSecondary = materials.find(m => m.name === secondaryMaterialName);
                if (existingSecondary) {
                   await updateMaterial(existingSecondary.id, {
                      quantity: Number(existingSecondary.quantity) + Number(secondaryQuantity),
                      last_cost: primaryCost
                   });
                } else {
                   await addMaterial({
                      name: secondaryMaterialName,
                      category: 'Madera',
                      quantity: secondaryQuantity,
                      unit: 'placas',
                      min_threshold: 1,
                      last_cost: primaryCost
                   });
                }
                toast.success('Materiales cortados registrados por separado');
            } else {
                toast.success('Stock actualizado en inventario');
            }
          }
          toast.success('Gasto registrado');
      }

      setIsAddingExpense(false);
      setEditingExpenseId(null);
      setNewExpense({ ...newExpense, amount: 0, description: '' }); // Reset parcial
      setAddToInventory(false);
      setQuantityToAdd(1);
      setWoodExtraCount(0);
      loadData();
    } catch (e) {
      toast.error('Error al guardar');
    }
  };

  const startEditExpense = (e: Expense) => {
      setNewExpense({
          date: e.date,
          category: e.category,
          subcategory: e.subcategory,
          amount: e.amount,
          description: e.description || ''
      });
      setEditingExpenseId(e.id);
      setIsAddingExpense(true);
      setAddToInventory(false);
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
      if (editingMaterialId) {
         const { error } = await updateMaterial(editingMaterialId, newMaterial);
         if (error) throw error;
         toast.success('Insumo actualizado');
      } else {
         const { error } = await addMaterial(newMaterial);
         if (error) throw error;
         toast.success('Insumo agregado');
      }
      setIsAddingMaterial(false);
      setEditingMaterialId(null);
      setNewMaterial({ name: '', category: 'Filamento', quantity: 0, unit: 'unidades', min_threshold: 1 });
      loadData();
    } catch (e) {
      toast.error('Error al guardar insumo');
    }
  };

  const startEditMaterial = (m: RawMaterial) => {
      setNewMaterial({
          name: m.name,
          category: m.category,
          quantity: m.quantity,
          unit: m.unit,
          min_threshold: m.min_threshold,
          last_cost: m.last_cost
      });
      setEditingMaterialId(m.id);
      setIsAddingMaterial(true);
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
        <div className="flex flex-col">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <DollarSign className="text-emerald-600" /> Finanzas & Stock
          </h2>
          <div className="flex gap-4 mt-2">
              <button 
                onClick={() => setActiveView('manager')}
                className={`text-xs font-bold uppercase tracking-wider pb-1 border-b-2 transition-all ${activeView === 'manager' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400'}`}
              >
                Gestión General
              </button>
              <button 
                onClick={() => setActiveView('calculator')}
                className={`text-xs font-bold uppercase tracking-wider pb-1 border-b-2 transition-all ${activeView === 'calculator' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400'}`}
              >
                Calculadora Escandallo
              </button>
          </div>
        </div>  <p className="text-sm text-slate-500">
            {months[selectedMonth]} {selectedYear}
          </p>
        
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

      {activeView === 'manager' && (
      <>
      {/* 2. Tarjetas de Finanzas (KPIs) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-6 rounded-xl bg-linear-to-br from-emerald-500 to-emerald-600 text-white shadow-lg relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 right-0 p-4 opacity-20"><TrendingUp size={48} /></div>
          <div>
              <p className="text-emerald-100 text-sm font-medium mb-1">Ingresos (Caja Real)</p>
              <h3 className="text-3xl font-bold">${financials.income.toLocaleString('es-AR')}</h3>
          </div>
          
          <div className="flex flex-col gap-1 mt-3">
              {financials.debtTotal > 0 && (
                <div className="text-xs bg-black/20 px-2 py-1 rounded inline-flex items-center gap-1 w-max">
                  <AlertCircle size={10} className="text-yellow-300" />
                  <span>Por Cobrar (Fiado): ${financials.debtTotal.toLocaleString('es-AR')}</span>
                </div>
              )}
              {financials.mlPending > 0 && (
                <div className="text-xs bg-blue-900/40 px-2 py-1 rounded inline-flex items-center gap-1 w-max border border-blue-500/30">
                  <Package size={10} className="text-blue-200" />
                  <span>A Liquidar ML: ${financials.mlPending.toLocaleString('es-AR')}</span>
                </div>
              )}
          </div>
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

        <div className="p-6 rounded-xl bg-linear-to-br from-indigo-700 to-purple-800 text-white shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-20"><Clock size={48} /></div>
          <p className="text-indigo-100 text-sm font-medium mb-1">Carga de Trabajo</p>
          <h3 className="text-3xl font-bold">{Math.round(financials.totalHours)} <span className="text-lg font-normal">hs</span></h3>
          <span className="text-xs bg-black/20 px-2 py-0.5 rounded mt-2 inline-block">Producidas este mes</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* COLUMNA IZQUIERDA: GESTIÓN DE GASTOS */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <MinusCircleIcon className="text-rose-500" /> {editingExpenseId ? 'Editar Gasto' : 'Registrar Gasto'}
              </h3>
              <button onClick={() => { setIsAddingExpense(!isAddingExpense); setEditingExpenseId(null); setNewExpense({ ...newExpense, amount: 0, description: '' }); }} className="text-indigo-600 text-sm hover:underline">
                {isAddingExpense ? 'Cancelar' : 'Nuevo'}
              </button>
            </div>

            {isAddingExpense ? (
              <div className="space-y-3 animate-in fade-in slide-in-from-top-2 bg-slate-50 p-4 rounded-lg">
                <input type="date" value={newExpense.date} onChange={e => setNewExpense({...newExpense, date: e.target.value})} className="w-full p-2 border rounded text-sm"/>
                <div className="grid grid-cols-2 gap-2">
                  <div className="relative">
                    <span className="absolute left-2 top-2 text-slate-400">$</span>
                    <input type="number" placeholder="0.00" value={newExpense.amount || ''} onChange={e => setNewExpense({...newExpense, amount: Number(e.target.value)})} className="w-full p-2 pl-6 border rounded text-sm"/>
                  </div>
                  <select value={newExpense.category} onChange={e => setNewExpense({...newExpense, category: e.target.value as any, subcategory: customCategories[e.target.value]?.[0] || ''})} className="w-full p-2 border rounded text-sm">
                    {Object.keys(customCategories).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>
                {/* Input con datalist dinámico y botón para agregar nuevo */}
                <div className="flex gap-2 items-center">
                  <div className="relative flex-1">
                    <input 
                       list={`subcat-list-${newExpense.category}`}
                       value={newExpense.subcategory || ''} 
                       onChange={e => setNewExpense({...newExpense, subcategory: e.target.value})} 
                       className="w-full p-2 border rounded text-sm bg-white"
                       placeholder="Elegir o escribir nuevo..."
                    />
                    <datalist id={`subcat-list-${newExpense.category}`}>
                        {customCategories[newExpense.category || 'Otros']?.map(sub => <option key={sub} value={sub} />)}
                    </datalist>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => handleAddPredeterminado(newExpense.category, newExpense.subcategory)}
                    className="px-3 py-2 bg-indigo-50 text-indigo-700 text-xs rounded border border-indigo-200 hover:bg-indigo-100 font-bold whitespace-nowrap"
                    title="Guardar término predeterminado en el navegador"
                  >
                    + Guardar
                  </button>
                </div>
                <input type="text" placeholder="Descripción..." value={newExpense.description || ''} onChange={e => setNewExpense({...newExpense, description: e.target.value})} className="w-full p-2 border rounded text-sm"/>
                
                {/* Opción Agregar a Stock (Solo CREACIÓN) */}
                {!editingExpenseId && (
                <div className="flex items-center gap-2 bg-indigo-50 p-2 rounded border border-indigo-100">
                  <input 
                    type="checkbox" 
                    id="addToStack"
                    checked={addToInventory}
                    onChange={e => setAddToInventory(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500" 
                  />
                  <label htmlFor="addToStack" className="text-xs font-bold text-indigo-700 cursor-pointer select-none flex-1">
                    Pasar al Inventario
                  </label>
                  
                  {addToInventory && (
                    <div className="mt-3 bg-slate-50 p-3 rounded-md border border-slate-200 animate-in slide-in-from-left-2">
                       {newExpense.category === 'Filamento' && (
                         <div className="grid grid-cols-2 gap-2 mb-3 bg-white p-2 rounded border border-indigo-100">
                            <div className="col-span-2 text-[10px] font-bold text-indigo-600 uppercase mb-1 flex items-center gap-1">
                               <Package size={10}/> Detalles del Filamento (Stock)
                            </div>
                            <div>
                               <label className="text-[10px] font-bold text-slate-500 uppercase">Marca</label>
                               <select value={filBrand} onChange={e => setFilBrand(e.target.value)} className="w-full p-1 text-xs border rounded bg-slate-50">
                                  {FILAMENT_BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
                               </select>
                            </div>
                            <div>
                               <label className="text-[10px] font-bold text-slate-500 uppercase">Tipo</label>
                               <select value={filType} onChange={e => setFilType(e.target.value)} className="w-full p-1 text-xs border rounded bg-slate-50">
                                  {FILAMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                               </select>
                            </div>
                            <div className="col-span-2">
                               <label className="text-[10px] font-bold text-slate-500 uppercase">Color</label>
                               <input 
                                  list="color-suggestions"
                                  type="text" 
                                  placeholder="Ej: Rojo" 
                                  className="w-full p-1 text-xs border rounded"
                                  value={filColor}
                                  onChange={e => setFilColor(e.target.value)}
                               />
                            </div>
                            <div className="col-span-2 mt-1 border-t pt-1">
                               <p className="text-[10px] text-slate-400">Se registrará como: <b className="text-indigo-600">{(filBrand + ' ' + filType + ' ' + filColor).trim() || '(Vacío)'}</b></p>
                             </div>
                          </div>
                       )}

                       {newExpense.category === 'Madera' && (
                         <div className="grid grid-cols-2 gap-2 mb-3 bg-amber-50 p-2 rounded border border-amber-200">
                             <div className="col-span-2 text-[10px] font-bold text-amber-800 uppercase mb-1 flex items-center gap-1">
                                <Package size={10}/> Despiece de Placa
                             </div>
                             <div className="col-span-2">
                                <label className="text-[10px] font-bold text-amber-700 uppercase">Tipo de Madera</label>
                                <select value={woodType} onChange={e => setWoodType(e.target.value)} className="w-full p-1 text-xs border border-amber-300 rounded bg-white">
                                   {(DEFAULT_EXPENSE_CATEGORIES['Madera'] as string[]).map(w => <option key={w} value={w}>{w}</option>)}
                                </select>
                             </div>
                             <div>
                                <label className="text-[10px] font-bold text-amber-700 uppercase">Placas (40x40)</label>
                                <input type="number" value={quantityToAdd} onChange={e => setQuantityToAdd(Number(e.target.value))} className="w-full p-1 text-xs border border-amber-300 rounded text-center" min="0"/>
                             </div>
                             <div>
                                <label className="text-[10px] font-bold text-amber-700 uppercase">Recortes (40x17)</label>
                                <input type="number" value={woodExtraCount} onChange={e => setWoodExtraCount(Number(e.target.value))} className="w-full p-1 text-xs border border-amber-300 rounded text-center" min="0"/>
                             </div>
                             
                             <div className="col-span-2 mt-1 border-t border-amber-200 pt-1">
                                <p className="text-[10px] text-amber-700">El costo se dividirá equitativamente para <b>{quantityToAdd + woodExtraCount}</b> piezas totales.</p>
                             </div>
                         </div>
                       )}

                       {newExpense.category !== 'Madera' && (
                         <div className="flex justify-between items-center mb-2">
                             <label className="text-xs font-bold text-slate-600">Cantidad Comprada:</label>
                             <div className="flex items-center gap-1">
                                 <input 
                                  type="number" 
                                  value={quantityToAdd} 
                                  onChange={e => setQuantityToAdd(Number(e.target.value))}
                                  className="w-20 p-1 text-sm border rounded text-center font-bold bg-white focus:ring-2 focus:ring-indigo-500"
                                  min="1"
                                 />
                                  <span className="text-xs text-slate-400">
                                    {newExpense.category === 'Filamento' ? 'kg' : newExpense.category === 'Madera' ? 'placas' : 'unidades'}
                                  </span>
                             </div>
                         </div>
                       )}
                       
                       {/* Estimación de Costo Unitario */}
                       {(newExpense.amount || 0) > 0 && (quantityToAdd > 0 || woodExtraCount > 0) && (
                           <div className="bg-white p-2 rounded border border-indigo-100 shadow-sm text-xs">
                               <div className="flex justify-between items-center mb-1">
                                  <span className="text-slate-500">Costo Unitario (Calculado):</span>
                                  <b className="text-indigo-700 text-sm font-mono">
                                    ${((newExpense.amount || 0) / (newExpense.category === 'Madera' ? (quantityToAdd + woodExtraCount) : quantityToAdd)).toFixed(2)}
                                  </b>
                               </div>
                               
                               {/* Comparación de Precio */}
                               {(() => {
                                   const targetName = newExpense.category === 'Filamento' 
                                      ? `${filBrand} ${filType} ${filColor}`.trim() 
                                      : newExpense.subcategory;
                                   const mat = materials.find(m => m.name === targetName);
                                   if (mat && mat.last_cost) {
                                   const current = (newExpense.amount || 0) / (newExpense.category === 'Madera' ? (quantityToAdd + woodExtraCount) : quantityToAdd);
                                       const diff = current - mat.last_cost;
                                       const percent = ((diff / mat.last_cost) * 100).toFixed(1);
                                       
                                       if (diff > 0.01) return (
                                          <div className="flex items-center justify-end gap-1 text-red-600 font-bold bg-red-50 py-1 px-2 rounded mt-1">
                                            <TrendingUp size={12}/> 
                                            Subió {percent}% (Antes: ${mat.last_cost})
                                          </div>
                                       );
                                       if (diff < -0.01) return (
                                          <div className="flex items-center justify-end gap-1 text-emerald-600 font-bold bg-emerald-50 py-1 px-2 rounded mt-1">
                                            <TrendingDown size={12}/> 
                                            Bajó {Math.abs(Number(percent))}% (Antes: ${mat.last_cost})
                                          </div>
                                       );
                                       return <div className="text-right text-slate-400 mt-1 flex items-center justify-end gap-1 bg-gray-50 px-2 py-0.5 rounded"><CheckCircle size={10}/> Mismo precio</div>;
                                   }
                                   if (mat && !mat.last_cost) {
                                       return <div className="text-right text-indigo-400 mt-1 italic">* Se registrará costo inicial</div>;
                                   }
                                   return <div className="text-right text-emerald-500 mt-1 italic">* Nuevo insumo</div>;
                               })()}
                           </div>
                       )}
                    </div>
                  )}
                </div>
                )}

                <button onClick={handleAddExpense} className="w-full py-2 bg-rose-600 text-white rounded font-medium hover:bg-rose-700">{editingExpenseId ? 'Actualizar Gasto' : 'Guardar Gasto'}</button>
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
                      <button onClick={() => startEditExpense(e)} className="text-slate-300 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity p-1"><Edit2 size={13}/></button>
                      <button onClick={() => handleDeleteExpense(e.id)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1"><Trash2 size={13}/></button>
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
            {/* Formulario Agregar/Editar Material */}
            {isAddingMaterial && (
              <div className="p-4 bg-indigo-50 border-b border-indigo-100 animate-in fade-in">
                <div className="flex justify-between items-center mb-2">
                    <h4 className="text-sm font-bold text-indigo-800">{editingMaterialId ? 'Editar Insumo' : 'Nuevo Insumo'}</h4>
                </div>
                <div className="flex flex-wrap gap-2 items-end">
                  <div className="flex-1 min-w-[150px]">
                    <label className="text-xs text-indigo-800 font-bold flex justify-between items-end">
                       <span>Nombre / Identificador</span>
                       {newMaterial.category !== 'Filamento' && !editingMaterialId && (
                         <button 
                             type="button" 
                             onClick={() => handleAddPredeterminado(newMaterial.category, newMaterial.name)} 
                             className="text-[10px] text-indigo-600 hover:underline"
                             title="Guardarlo para que aparezca sugerido la próxima vez"
                         >
                           + Predeterminado
                         </button>
                       )}
                    </label>
                    <input 
                      type="text" 
                      list={newMaterial.category !== 'Filamento' ? `mat-names-${newMaterial.category}` : undefined}
                      placeholder="Ej: MDF 3mm" 
                      value={newMaterial.name} 
                      onChange={e => setNewMaterial({...newMaterial, name: e.target.value})} 
                      className="w-full p-2 text-sm border rounded bg-white font-medium mt-1" 
                      readOnly={newMaterial.category === 'Filamento' && !editingMaterialId}
                    />
                    {newMaterial.category !== 'Filamento' && (
                       <datalist id={`mat-names-${newMaterial.category}`}>
                          {(customCategories[newMaterial.category || 'Otros'] || []).map(item => <option key={item} value={item} />)}
                       </datalist>
                    )}
                    {newMaterial.category === 'Filamento' && !editingMaterialId && (
                      <p className="text-[10px] text-slate-400 mt-1 italic">Nombre generado automáticamente</p>
                    )}
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

                  {newMaterial.category === 'Filamento' && (
                    <>
                      <div className="w-28">
                        <label className="text-xs text-indigo-800 font-bold">Marca</label>
                        <select value={filBrand} onChange={e => setFilBrand(e.target.value)} className="w-full p-2 text-sm border rounded bg-white">
                          {FILAMENT_BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
                        </select>
                      </div>
                      <div className="w-24">
                        <label className="text-xs text-indigo-800 font-bold">Tipo</label>
                        <select value={filType} onChange={e => setFilType(e.target.value)} className="w-full p-2 text-sm border rounded bg-white">
                          {FILAMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                      <div className="w-28">
                        <label className="text-xs text-indigo-800 font-bold">Color</label>
                        <input 
                          list="color-suggestions"
                          type="text" 
                          placeholder="Ej: Rojo" 
                          value={filColor} 
                          onChange={e => setFilColor(e.target.value)} 
                          className="w-full p-2 text-sm border rounded" 
                        />
                        <datalist id="color-suggestions">
                          <option value="Blanco" /><option value="Negro" /><option value="Gris" />
                          <option value="Rojo" /><option value="Azul" /><option value="Verde" />
                          <option value="Amarillo" /><option value="Naranja" /><option value="Violeta" />
                          <option value="Rosa" /><option value="Piel" /><option value="Cobre" />
                          <option value="Oro" /><option value="Plata" /><option value="Bronce" />
                        </datalist>
                      </div>
                    </>
                  )}

                  <div className="w-20">
                    <label className="text-xs text-indigo-800 font-bold">Cant.</label>
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
                  <div className="w-24">
                    <label className="text-xs text-indigo-800 font-bold">Costo Unit.</label>
                    <input type="number" placeholder="0.00" value={newMaterial.last_cost || ''} onChange={e => setNewMaterial({...newMaterial, last_cost: Number(e.target.value)})} className="w-full p-2 text-sm border rounded" />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleAddMaterial} className="px-4 py-2 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700 font-bold">{editingMaterialId ? 'Actualizar' : 'Guardar'}</button>
                    <button onClick={() => { setIsAddingMaterial(false); setEditingMaterialId(null); setNewMaterial({ name: '', category: 'Filamento', quantity: 0, unit: 'unidades', min_threshold: 1 }); }} className="px-3 py-2 bg-white text-slate-600 border rounded text-sm hover:bg-gray-50">Cancelar</button>
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
                    <th className="px-4 py-3 text-right">Costo Unit.</th>
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
                      <td className="px-4 py-3 text-right font-medium text-slate-600">
                           {m.last_cost ? `$${m.last_cost.toLocaleString('es-AR')}` : '-'}
                      </td>
                      <td className="px-4 py-3 text-right flex items-center justify-end gap-1">
                        <button onClick={() => startEditMaterial(m)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                          <Edit2 size={16} />
                        </button>
                        <button onClick={() => handleDeleteMaterial(m.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                {materials.length === 0 && (
                  <tbody className="divide-y divide-gray-100">
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-400">
                        No hay insumos cargados. ¡Agrega tu primer material!
                      </td>
                    </tr>
                  </tbody>
                )}
              </table>
            </div>
          </div>
        </div>

      </div>
      </>
      )}

      {activeView === 'calculator' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Configuración de Costos Globales */}
          <div className="bg-white p-6 rounded-xl border border-indigo-100 shadow-md">
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Settings className="text-indigo-600" /> Configuración de Costos Base (Argentina)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                <label className="block text-xs font-bold text-blue-800 uppercase mb-2">Precio kWh (Edesur + Imp)</label>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-blue-600">$</span>
                  <input 
                    type="number" 
                    value={costConfig.kwhPrice} 
                    onChange={e => setCostConfig({...costConfig, kwhPrice: Number(e.target.value)})}
                    className="w-full bg-white border rounded-md p-2 font-mono text-lg"
                  />
                </div>
                <p className="text-[10px] text-blue-400 mt-1 italic">Factor real con impuestos: ~$175</p>
              </div>

              <div className="p-4 bg-purple-50 rounded-lg border border-purple-100">
                <label className="block text-xs font-bold text-purple-800 uppercase mb-2">Amortización / Hora Máquina</label>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-purple-600">$</span>
                  <input 
                    type="number" 
                    value={costConfig.machineHourCost} 
                    onChange={e => setCostConfig({...costConfig, machineHourCost: Number(e.target.value)})}
                    className="w-full bg-white border rounded-md p-2 font-mono text-lg"
                  />
                </div>
                <p className="text-[10px] text-purple-400 mt-1 italic">Depreciación, repuestos y ahorro</p>
              </div>

              <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-100">
                <label className="block text-xs font-bold text-emerald-800 uppercase mb-2">Consumo Máquina (kW/h)</label>
                <div className="flex items-center gap-2">
                  <input 
                    type="number" 
                    step="0.01"
                    value={costConfig.kwhConsumption} 
                    onChange={e => setCostConfig({...costConfig, kwhConsumption: Number(e.target.value)})}
                    className="w-full bg-white border rounded-md p-2 font-mono text-lg"
                  />
                  <span className="text-sm font-bold text-emerald-600">kW</span>
                </div>
                <p className="text-[10px] text-emerald-400 mt-1 italic">Promedio: 0.12 - 0.15 kW</p>
              </div>

              <div className="p-4 bg-orange-50 rounded-lg border border-orange-100">
                <label className="block text-xs font-bold text-orange-800 uppercase mb-2">Costo PETG/PLA Promedio (kg)</label>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-orange-600">$</span>
                  <input 
                    type="number" 
                    value={costConfig.genericFilamentPrice} 
                    onChange={e => setCostConfig({...costConfig, genericFilamentPrice: Number(e.target.value)})}
                    className="w-full bg-white border rounded-md p-2 font-mono text-lg"
                  />
                </div>
                <p className="text-[10px] text-orange-400 mt-1 italic">Válido si no hay precio o usás cualquier marca</p>
              </div>
            </div>
          </div>

          {/* Tabla de Escandallo de Productos */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="flex justify-between items-center p-5 border-b bg-gray-50">
               <div>
                  <h3 className="font-bold text-slate-800">Rentabilidad por Producto</h3>
                  <p className="text-xs text-slate-500">¿Cuánto te deja cada venta realmente?</p>
               </div>
               <div className="flex items-center gap-2 bg-indigo-100 px-3 py-1.5 rounded-full text-indigo-700 text-xs font-bold">
                  <TrendingUp size={14}/> {products.length} Productos Analizados
               </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-100 text-slate-500 text-[10px] uppercase font-bold tracking-wider">
                  <tr>
                    <th className="px-4 py-3 text-left">Producto</th>
                    <th className="px-4 py-3 text-center">Peso / Tiempo</th>
                    <th className="px-4 py-3 text-right">Costo Fab.</th>
                    <th className="px-4 py-3 text-right">Precio Venta</th>
                    <th className="px-4 py-3 text-right">Ganancia</th>
                    <th className="px-4 py-3 text-center">Margen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {products.map(p => {
                    // CÁLCULO DE COSTOS
                    
                    // 1. Costo Filamento / Plástico
                    let materialCost = 0;
                    let totalMaterialWeight = 0;
                    
                    if (p.colorPercentage && Array.isArray(p.colorPercentage)) {
                        p.colorPercentage.forEach(cp => {
                            const mat = materials.find(m => m.name.toLowerCase() === cp.color.toLowerCase());
                            
                            // Lógica de precio por gramo más robusta
                            let pricePerGram = 0;
                            if (mat && mat.last_cost) {
                                const unit = mat.unit?.toLowerCase() || '';
                                // Si es filamento (estamos en colorPercentage), y el precio es alto (>1000), 
                                // es casi seguro que el precio es por rollo/kg aunque diga "unidad"
                                const isBulkUnit = ['kg', 'kilos', 'kilogramos', 'rollos', 'bobina', 'bobinas', 'unidad', 'unidades'].some(u => unit.includes(u));
                                
                                if (isBulkUnit && mat.last_cost > 1000) {
                                    pricePerGram = mat.last_cost / 1000;
                                } else if (['kg', 'kilos', 'kilogramos', 'rollos', 'bobina', 'bobinas'].some(u => unit.includes(u))) {
                                    pricePerGram = mat.last_cost / 1000;
                                } else {
                                    pricePerGram = mat.last_cost;
                                }
                            }

                            // FALLBACK: Si no hay precio para este material específico, buscamos uno del mismo tipo o usamos el genérico
                            if (pricePerGram === 0) {
                                // Buscamos cualquier material que contenga el tipo (PETG, PLA) y tenga precio
                                const matType = cp.color.toUpperCase().includes('PETG') ? 'PETG' : cp.color.toUpperCase().includes('PLA') ? 'PLA' : null;
                                if (matType) {
                                    const similarMat = materials.find(m => m.name.toUpperCase().includes(matType) && m.last_cost);
                                    if (similarMat && similarMat.last_cost) {
                                        const unit = similarMat.unit?.toLowerCase() || '';
                                        pricePerGram = (['kg', 'rollos', 'unid'].some(u => unit.includes(u)) && similarMat.last_cost > 1000) 
                                            ? similarMat.last_cost / 1000 
                                            : similarMat.last_cost;
                                    }
                                }
                                
                                // Si sigue siendo 0, usamos el costo genérico configurado arriba
                                if (pricePerGram === 0) {
                                    pricePerGram = costConfig.genericFilamentPrice / 1000;
                                }
                            }
                            
                            let grams = 0;
                            if (cp.grams) {
                                grams = cp.grams;
                            } else if (cp.percentage) {
                                // Priorizamos netWeight si existe para el cálculo de filamento
                                const baseWeight = p.netWeight || p.weight || 0;
                                grams = (baseWeight * cp.percentage) / 100;
                            }
                            
                            materialCost += grams * pricePerGram;
                            totalMaterialWeight += grams;
                        });
                    }

                    // 2. Costo Insumos Fijos
                    let fixedInputsCost = 0;
                    if (p.consumables && Array.isArray(p.consumables)) {
                        p.consumables.forEach(c => {
                            const mat = materials.find(m => m.name.toLowerCase() === c.material.toLowerCase());
                            if (mat && mat.last_cost) {
                                fixedInputsCost += mat.last_cost * c.quantity;
                            }
                        });
                    }

                    // 3. Costo Operativo (Luz + Amortización)
                    const time = p.printingTime || 0;
                    const electricityCost = time * costConfig.kwhConsumption * costConfig.kwhPrice;
                    const wearCost = time * costConfig.machineHourCost;

                    const totalCost = materialCost + fixedInputsCost + electricityCost + wearCost;
                    const profit = p.price - totalCost;
                    const margin = p.price > 0 ? (profit / p.price) * 100 : 0;

                    return (
                      <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <SmartImage src={p.images?.[0]?.url || p.image} alt={p.name} className="w-10 h-10 object-cover rounded shadow-sm" />
                            <div>
                                <p className="font-bold text-slate-800">{p.name}</p>
                                <p className="text-[10px] text-slate-400 uppercase font-medium">{p.category}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <div className="flex flex-col items-center">
                              <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 rounded" title="Peso neto de filamento">
                                {totalMaterialWeight > 0 ? totalMaterialWeight.toFixed(1) : p.weight || 0}g
                              </span>
                              <span className="text-[10px] text-slate-400 font-bold mt-1 flex items-center gap-1">
                                <Clock size={10}/> {p.printingTime || 0} hs
                              </span>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <div className="flex flex-col items-end">
                            <span className="font-mono font-bold text-slate-700">${totalCost.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span>
                            <div className="flex gap-1 text-[8px] text-slate-400 uppercase font-bold">
                                {materialCost > 0 && <span title="Mat." className="bg-rose-50 px-1 rounded">M</span>}
                                {fixedInputsCost > 0 && <span title="Ins." className="bg-blue-50 px-1 rounded">I</span>}
                                {time > 0 && <span title="Op." className="bg-amber-50 px-1 rounded">O</span>}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <div className="inline-flex items-center gap-1 bg-white border border-gray-200 px-2 py-1 rounded font-bold text-slate-800 shadow-sm">
                            <span className="text-slate-400 text-[10px]">$</span>
                            {p.price.toLocaleString('es-AR')}
                            <button onClick={() => onEditProduct(p)} className="p-1 hover:text-indigo-600">
                                <Edit2 size={12}/>
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <span className={`font-bold ${profit > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                            ${profit.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <div className="flex flex-col items-center">
                            <div className="w-16 bg-gray-100 h-1.5 rounded-full overflow-hidden mb-1">
                                <div 
                                    className={`h-full rounded-full transition-all duration-1000 ${margin > 60 ? 'bg-emerald-500' : margin > 30 ? 'bg-amber-400' : 'bg-red-500'}`}
                                    style={{ width: `${Math.min(100, Math.max(0, margin))}%` }}
                                />
                            </div>
                            <span className={`text-[10px] font-bold ${margin > 60 ? 'text-emerald-600' : margin > 30 ? 'text-amber-500' : 'text-red-600'}`}>
                                {margin.toFixed(0)}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {products.length === 0 && (
                <div className="p-12 text-center text-slate-400 italic">
                    No hay productos cargados para analizar.
                </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default FinancialDashboard;
