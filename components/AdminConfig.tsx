import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { getMLConfig, saveMLConfig, MLConfig } from '../services/configService';
import { Save, RefreshCw, AlertTriangle } from 'lucide-react';

const AdminConfig: React.FC = () => {
    const [config, setConfig] = useState<MLConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadConfig();
    }, []);

    const loadConfig = async () => {
        setLoading(true);
        const res = await getMLConfig();
        setConfig(res);
        setLoading(false);
    };

    const handleSave = async () => {
        if (!config) return;
        setSaving(true);
        const success = await saveMLConfig(config);
        if (success) {
            toast.success('Configuración de MercadoLibre guardada.');
            // Opcional: recargar app o notificar
        } else {
            toast.error('Error al guardar. Verificá permisos de base de datos.');
        }
        setSaving(false);
    };

    if (loading) return (
        <div className="p-8 flex justify-center items-center gap-2 text-slate-500">
            <RefreshCw className="animate-spin w-5 h-5" />
            Cargando configuración...
        </div>
    );

    if (!config) return null;

    return (
        <div className="p-4 max-w-4xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <div>
                   <h2 className="text-xl font-bold text-slate-800">Parámetros MercadoLibre</h2>
                   <p className="text-sm text-slate-500">Ajustá las comisiones y costos oficiales para el simulador.</p>
                </div>
                <button 
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors"
                >
                    {saving ? <RefreshCw className="animate-spin w-4 h-4" /> : <Save className="w-4 h-4" />}
                    Guardar Cambios
                </button>
            </div>

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
                                type="number" 
                                value={config.fixed_fee_threshold}
                                onChange={e => setConfig({...config, fixed_fee_threshold: Number(e.target.value)})}
                                className="w-full border-slate-200 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Costo Envío Estimado ($)</label>
                            <input 
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

            <div className="mt-8 bg-amber-50 border border-amber-200 p-4 rounded-xl flex gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                <div className="text-sm text-amber-800">
                    <p className="font-bold mb-1">¡Cuidado al modificar estos valores!</p>
                    <p>Estos cambios afectan a la visualización de rentabilidad de todos los productos en el administrador. Asegurate de usar puntos para los decimales (ej: 14.35) y no comas.</p>
                </div>
            </div>
        </div>
    );
};

export default AdminConfig;
