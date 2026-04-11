import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { getMLConfig, saveMLConfig, MLConfig, getFiscalConfig, saveFiscalConfig, FiscalConfig } from '../services/configService';
import { Save, RefreshCw, AlertTriangle, Link2, ArrowUpRight, ShieldCheck } from 'lucide-react';
import { bulkSyncStocks, autoLinkMLIds } from '../services/mlService';
import { useProducts } from '../context/ProductContext';
import { useAuth } from '../context/AuthContext';

const AdminConfig: React.FC = () => {
    const [config, setConfig] = useState<MLConfig | null>(null);
    const [afipStatus, setAfipStatus] = useState<'idle' | 'loading' | 'online' | 'error'>('idle');
    const [fiscal, setFiscal] = useState<FiscalConfig | null>(null);
    const [activeTab, setActiveTab] = useState<'ml' | 'fiscal'>('ml');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [syncing, setSyncing] = useState(false);
    
    const { products, refreshProducts } = useProducts();
    const { user } = useAuth();

    useEffect(() => {
        loadConfig();
    }, []);

    const loadConfig = async () => {
        setLoading(true);
        const [mlRes, fiscalRes] = await Promise.all([getMLConfig(), getFiscalConfig()]);
        setConfig(mlRes);
        setFiscal(fiscalRes);
        setLoading(false);
    };

    const handleSave = async () => {
        if (!config || !fiscal) return;
        setSaving(true);
        
        const [mlOk, fiscalOk] = await Promise.all([
            saveMLConfig(config),
            saveFiscalConfig(fiscal)
        ]);

        if (mlOk && fiscalOk) {
            toast.success('Configuración guardada exitosamente.');
        } else {
            toast.error('Error al guardar algunos parámetros.');
        }
        setSaving(false);
    };

    const handleBulkSync = async () => {
        if (!user) {
            toast.error('Debes estar autenticado como admin.');
            return;
        }
        
        const linkedCount = (products || []).filter(p => p && !!p.ml_item_id).length;
        if (linkedCount === 0) {
            toast.error('No hay productos vinculados con MercadoLibre para sincronizar.');
            return;
        }

        if (!confirm(`Se enviará el stock local de ${linkedCount} productos a MercadoLibre. ¿Continuar?`)) return;

        setSyncing(true);
        try {
            const res = await bulkSyncStocks(user.id, []);
            if (res.ok) {
                toast.success(`Sincronización completada: ${res.data.summary.success} ítems actualizados.`);
            } else {
                toast.error('Error en la sincronización: ' + (res.data.error || 'Servidor no responde'));
            }
        } catch (e) {
            toast.error('Error inesperado.');
        } finally {
            setSyncing(false);
        }
    };

    const handleAutoLink = async () => {
        if (!user) return;
        if (!confirm('Este proceso intentará vincular productos de ML con los locales por nombre. ¿Continuar?')) return;
        
        setSyncing(true);
        try {
            const res = await autoLinkMLIds(user.id);
            if (res.ok) {
                toast.success('Auto-vinculación completada. Recargando productos...');
                await refreshProducts();
            } else {
                toast.error('Error: ' + res.data.error);
            }
        } catch (e) {
            toast.error('Error.');
        } finally {
            setSyncing(false);
        }
    };

    if (loading) return (
        <div className="p-8 flex justify-center items-center gap-2 text-slate-500">
            <RefreshCw className="animate-spin w-5 h-5" />
            Cargando configuración...
        </div>
    );

    if (!config || !fiscal) return null;

    return (
        <div className="p-4 max-w-4xl mx-auto">
            <div className="flex justify-between items-start mb-6">
                <div>
                   <h2 className="text-xl font-black text-slate-800 tracking-tight">Configuración del Sistema</h2>
                   <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Gestión centralizada de parámetros y sincronización</p>
                   
                   <div className="flex gap-4 mt-4">
                      <button 
                        onClick={() => setActiveTab('ml')}
                        className={`text-xs font-bold uppercase tracking-widest pb-1 border-b-2 transition-all ${activeTab === 'ml' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400'}`}
                      >
                        MercadoLibre
                      </button>
                      <button 
                        onClick={() => setActiveTab('fiscal')}
                        className={`text-xs font-bold uppercase tracking-widest pb-1 border-b-2 transition-all ${activeTab === 'fiscal' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-slate-400'}`}
                      >
                        Monotributo / Fiscal
                      </button>
                   </div>
                </div>
                <button 
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-slate-900 hover:bg-black text-white px-6 py-2.5 rounded-xl flex items-center gap-2 font-bold shadow-lg transition-all active:scale-95 disabled:opacity-50"
                >
                    {saving ? <RefreshCw className="animate-spin w-4 h-4" /> : <Save className="w-4 h-4" />}
                    Guardar Cambios
                </button>
            </div>

            {activeTab === 'ml' && (
                <div className="animate-in fade-in slide-in-from-left-2 duration-300 space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Comisiones Base */}
                        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                            <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2 border-b pb-2">
                                <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                                Comisiones Base (Clásico)
                            </h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Cargo por vender (%)</label>
                                    <input 
                                        title="Cargo por vender (%)"
                                        type="number" 
                                        step="0.0001"
                                        value={config.classic_fee * 100}
                                        onChange={e => setConfig({...config, classic_fee: Number(e.target.value) / 100})}
                                        className="w-full border-slate-200 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                                    />
                                    <p className="text-[10px] text-slate-400 mt-1">Ej: 14.35 para representar 0.1435</p>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Costo Fijo Unitario ($)</label>
                                    <input 
                                        title="Costo Fijo Unitario ($)"
                                        type="number" 
                                        value={config.fixed_fee_unit}
                                        onChange={e => setConfig({...config, fixed_fee_unit: Number(e.target.value)})}
                                        className="w-full border-slate-200 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Envío y Umbrales */}
                        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                            <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2 border-b pb-2">
                                <span className="w-2 h-2 bg-indigo-500 rounded-full"></span>
                                Envío y Umbrales
                            </h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Umbral Envío Gratis ($)</label>
                                    <input 
                                        title="Umbral Envío Gratis ($)"
                                        type="number" 
                                        value={config.fixed_fee_threshold}
                                        onChange={e => setConfig({...config, fixed_fee_threshold: Number(e.target.value)})}
                                        className="w-full border-slate-200 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Costo Envío Estimado ($)</label>
                                    <input 
                                        title="Costo Envío Estimado ($)"
                                        type="number" 
                                        value={config.shipping_cost}
                                        onChange={e => setConfig({...config, shipping_cost: Number(e.target.value)})}
                                        className="w-full border-slate-200 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                                    />
                                    <p className="text-[10px] text-slate-400 mt-1">Se aplica cuando el precio supera el umbral.</p>
                                </div>
                            </div>
                        </div>

                        {/* Tasas de Cuotas */}
                        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm md:col-span-2">
                            <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2 border-b pb-2">
                                <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
                                Recargos por Cuotas (Extra sobre Clásico)
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">3 Cuotas (%)</label>
                                    <input 
                                        title="Recargo 3 Cuotas (%)"
                                        type="number" 
                                        step="0.01"
                                        value={config.installment_3 * 100}
                                        onChange={e => setConfig({...config, installment_3: Number(e.target.value) / 100})}
                                        className="w-full border-slate-200 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">6 Cuotas (%)</label>
                                    <input 
                                        title="Recargo 6 Cuotas (%)"
                                        type="number" 
                                        step="0.01"
                                        value={config.installment_6 * 100}
                                        onChange={e => setConfig({...config, installment_6: Number(e.target.value) / 100})}
                                        className="w-full border-slate-200 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">9 Cuotas (%)</label>
                                    <input 
                                        title="Recargo 9 Cuotas (%)"
                                        type="number" 
                                        step="0.01"
                                        value={config.installment_9 * 100}
                                        onChange={e => setConfig({...config, installment_9: Number(e.target.value) / 100})}
                                        className="w-full border-slate-200 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">12 Cuotas (%)</label>
                                    <input 
                                        title="Recargo 12 Cuotas (%)"
                                        type="number" 
                                        step="0.01"
                                        value={config.installment_12 * 100}
                                        onChange={e => setConfig({...config, installment_12: Number(e.target.value) / 100})}
                                        className="w-full border-slate-200 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex gap-3">
                        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                        <div className="text-sm text-amber-800">
                            <p className="font-bold mb-1">¡Cuidado al modificar estos valores!</p>
                            <p>Estos cambios afectan a la visualización de rentabilidad de todos los productos en el administrador. Asegurate de usar puntos para los decimales (ej: 14.35) y no comas.</p>
                        </div>
                    </div>

                    {/* Herramientas de Sincronización */}
                    <div className="pt-8 border-t border-slate-200">
                         <h2 className="text-xl font-bold text-slate-800 mb-2">Herramientas de Sincronización</h2>
                         <p className="text-sm text-slate-500 mb-6 font-medium">Forzá la integración de stock y vinculación manual/automática.</p>
                         
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 hover:border-blue-200 transition-colors group">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="p-2 bg-blue-100 text-blue-600 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                        <ArrowUpRight size={20} />
                                    </div>
                                    <h3 className="font-bold text-slate-800">Forzar Stock Local → ML</h3>
                                </div>
                                <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                                    Envía el stock actual de tu inventario local a todas las publicaciones sincronizadas de MercadoLibre. Útil para resolver desvíos de inventario.
                                </p>
                                <button 
                                    disabled={syncing}
                                    onClick={handleBulkSync}
                                    className="w-full py-2 bg-white border border-slate-200 text-slate-700 font-bold rounded-lg hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {syncing ? <RefreshCw size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                                    Sincronizar Stock Completo
                                </button>
                            </div>

                            <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 hover:border-emerald-200 transition-colors group">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                                        <Link2 size={20} />
                                    </div>
                                    <h3 className="font-bold text-slate-800">Auto-Vincular Ítems ML</h3>
                                </div>
                                <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                                    Busca publicaciones en tu cuenta de ML que coincidan en nombre con tus productos locales y guarda el ID para futuras sincronizaciones.
                                </p>
                                <button 
                                    disabled={syncing}
                                    onClick={handleAutoLink}
                                    className="w-full py-2 bg-white border border-slate-200 text-slate-700 font-bold rounded-lg hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {syncing ? <RefreshCw size={16} className="animate-spin" /> : <Link2 size={16} />}
                                    Auto-Vincular IDs de ML
                                </button>
                            </div>
                         </div>
                    </div>
                </div>
            )}

            {activeTab === 'fiscal' && fiscal && (
                <div className="animate-in fade-in slide-in-from-right-2 duration-300 space-y-6">
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                        <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                            <ShieldCheck className="text-emerald-600" /> Parámetros del Monotributo
                        </h3>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Categoría Actual</label>
                                    <select 
                                        title="Categoría del Monotributo"
                                        value={fiscal.monotributo_category}
                                        onChange={e => setFiscal({...fiscal, monotributo_category: e.target.value})}
                                        className="w-full bg-slate-50 border-slate-200 rounded-xl font-bold text-slate-700 focus:ring-emerald-500 focus:border-emerald-500"
                                    >
                                        {['A','B','C','D','E','F','G','H','I','J','K'].map(cat => (
                                            <option key={cat} value={cat}>Categoría {cat}</option>
                                        ))}
                                    </select>
                                    <p className="text-[10px] text-slate-400 mt-2">Seleccioná tu categoría vigente para que el sistema use los topes correctos.</p>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Límite Mensual de Facturación ($)</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                                        <input 
                                            title="Límite Mensual ($)"
                                            type="number" 
                                            value={fiscal.monthly_limit}
                                            onChange={e => setFiscal({...fiscal, monthly_limit: Number(e.target.value)})}
                                            className="w-full pl-8 bg-slate-50 border-slate-200 rounded-xl font-bold text-slate-700 focus:ring-emerald-500 focus:border-emerald-500"
                                        />
                                    </div>
                                    <p className="text-[10px] text-slate-400 mt-2">Ej: $537.500 para Cat. A. Este valor se usa para la barra de progreso en Finanzas.</p>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Fecha Inicio Facturación</label>
                                    <input 
                                        title="Fecha Inicio Facturación"
                                        type="date" 
                                        value={fiscal.start_date || '2026-04-01'}
                                        onChange={e => setFiscal({...fiscal, start_date: e.target.value})}
                                        className="w-full bg-slate-50 border-slate-200 rounded-xl font-bold text-slate-700 focus:ring-emerald-500 focus:border-emerald-500"
                                    />
                                    <p className="text-[10px] text-slate-400 mt-2">Sólo las ventas desde esta fecha sumarán para el progreso del Monotributo.</p>
                                </div>

                                <div className="border-t border-slate-100 pt-6 mt-4">
                                    <label className="block text-sm font-black text-slate-800 uppercase mb-4 tracking-tighter">Facturación Electrónica (Web Service)</label>
                                    
                                    <div className="flex flex-col gap-3">
                                        <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-3 h-3 rounded-full ${afipStatus === 'online' ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : afipStatus === 'error' ? 'bg-rose-500' : 'bg-slate-300'} animate-pulse`}></div>
                                                <span className="text-xs font-bold text-slate-600">
                                                    Estado: {afipStatus === 'online' ? 'Conectado' : afipStatus === 'error' ? 'Error AFIP' : 'Desconectado'}
                                                </span>
                                            </div>
                                            <button 
                                                onClick={async () => {
                                                    const { toast } = await import('sonner');
                                                    setAfipStatus('loading');
                                                    toast.info('Probando conexión con AFIP...');
                                                    
                                                    try {
                                                        const response = await fetch('/api/afip-status');
                                                        const data = await response.json();
                                                        
                                                        if (data.online) {
                                                            setAfipStatus('online');
                                                            toast.success('¡Conectado exitosamente con AFIP!');
                                                        } else {
                                                            setAfipStatus('error');
                                                            toast.error(`Error: ${data.message || 'No se pudo conectar'}`);
                                                        }
                                                    } catch (e) {
                                                        setAfipStatus('error');
                                                        toast.error('Error de servidor al intentar conectar.');
                                                    }
                                                }}
                                                disabled={afipStatus === 'loading'}
                                                className={`text-[10px] ${afipStatus === 'online' ? 'bg-emerald-600' : 'bg-slate-600'} hover:opacity-90 text-white font-black px-3 py-1.5 rounded-lg transition-all disabled:opacity-50`}
                                            >
                                                {afipStatus === 'loading' ? 'CARGANDO...' : 'PROBAR API'}
                                            </button>
                                        </div>
                                        <p className="text-[10px] text-slate-400 uppercase leading-relaxed font-semibold">
                                            Modo: <strong className="text-slate-600 mr-2">Homologación (Pruebas)</strong>
                                            Punto de Venta: <strong className="text-slate-600">00002</strong>
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100 flex flex-col justify-center">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="p-2 bg-white rounded-lg text-emerald-600 shadow-sm">
                                        <AlertTriangle size={20} />
                                    </div>
                                    <h4 className="font-bold text-emerald-900">Consejo Fiscal</h4>
                                </div>
                                <p className="text-xs text-emerald-800 leading-relaxed">
                                    Recordá que los topes del Monotributo suelen actualizarse semestralmente por ARCA (ex AFIP). 
                                    <br/><br/>
                                    Si notas que la barra de progreso en tu tablero financiero no coincide con los valores oficiales, simplemente ajustá el <b>Límite Mensual</b> aquí arriba.
                                </p>
                            </div>
                        </div>

                        <div className="mt-8 pt-8 border-t border-slate-100">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h4 className="font-bold text-slate-800">Estado del Monitoreo</h4>
                                    <p className="text-xs text-slate-400">Habilitar o deshabilitar las alertas visuales de facturación.</p>
                                </div>
                                <button 
                                    title={fiscal.is_active ? "Desactivar Monitoreo" : "Activar Monitoreo"}
                                    onClick={() => setFiscal({...fiscal, is_active: !fiscal.is_active})}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${fiscal.is_active ? 'bg-emerald-600' : 'bg-slate-300'}`}
                                >
                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${fiscal.is_active ? 'translate-x-6' : 'translate-x-1'}`} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminConfig;
