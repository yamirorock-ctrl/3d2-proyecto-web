
import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseService';
import { Save, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

interface AIPrompt {
  id: string;
  role: string;
  description: string;
  system_instructions: string;
  temperature: number;
  active: boolean;
  updated_at: string;
}

const AdminPromptEditor: React.FC = () => {
  const [prompt, setPrompt] = useState<AIPrompt | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editedText, setEditedText] = useState('');

  // Cargar el Prompt Actual
  const fetchPrompt = async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase
        .from('ai_prompts') as any)
        .select('*')
        .eq('role', 'printy_ml_assistant')
        .single();

      if (error) throw error;

      if (data) {
        setPrompt(data);
        setEditedText(data.system_instructions);
      }
    } catch (error: any) {
      console.error('Error fetching prompt:', error);
      toast.error('Error al cargar el cerebro de la IA');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrompt();
  }, []);

  // Guardar Cambios
  const handleSave = async () => {
    if (!prompt) return;
    setSaving(true);

    try {
      const { error } = await (supabase
        .from('ai_prompts') as any)
        .update({
            system_instructions: editedText,
            updated_at: new Date().toISOString()
        })
        .eq('id', prompt.id);

      if (error) throw error;

      toast.success('¡Cerebro actualizado! Printy ya piensa diferente. 🧠✨');
      setPrompt({ ...prompt, system_instructions: editedText });
    } catch (error: any) {
      console.error('Error saving prompt:', error);
      toast.error('Error al guardar cambios');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Cargando cerebro... 🧠</div>;

  if (!prompt) return (
    <div className="p-8 text-center text-red-500 flex flex-col items-center gap-4">
        <AlertTriangle size={48} />
        <p>No se encontró la configuración de la IA. (Tabla vacía o rol incorrecto)</p>
        <button onClick={fetchPrompt} className="text-blue-500 underline">Reintentar</button>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
                🧠 Cerebro de Printy (IA)
            </h1>
            <p className="text-gray-500 text-sm mt-1">
                Edita las instrucciones base del asistente de MercadoLibre.
                <br />
                <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full">
                    ⚠️ Cambios impactan inmediatamente en las respuestas
                </span>
            </p>
        </div>
        
        <div className="flex gap-2">
            <button 
                onClick={fetchPrompt} 
                className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                title="Recargar"
            >
                <RefreshCw size={20} />
            </button>
            <button
                onClick={handleSave}
                disabled={saving || editedText === prompt.system_instructions}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                    saving || editedText === prompt.system_instructions
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        : 'bg-primary text-white hover:bg-primary/90 shadow-lg hover:shadow-xl'
                }`}
            >
                {saving ? (
                    <RefreshCw className="animate-spin" size={20} />
                ) : (
                    <Save size={20} />
                )}
                {saving ? 'Guardando...' : 'Guardar Cambios'}
            </button>
        </div>
      </div>

      <div className="grid gap-6">
        {/* Editor Principal */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-[600px]">
            <div className="bg-gray-50 border-b border-gray-200 px-4 py-2 flex items-center justify-between">
                <span className="text-xs font-mono text-gray-500 uppercase">System Prompt</span>
                <span className="text-xs text-gray-400">
                    {editedText.length} caracteres
                </span>
            </div>
            <textarea
                value={editedText}
                onChange={(e) => setEditedText(e.target.value)}
                className="flex-1 p-4 font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="Escribe aquí las instrucciones..."
                spellCheck={false}
            />
        </div>

        {/* Guía Rápida */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-800">
            <h3 className="font-bold flex items-center gap-2 mb-2">
                <CheckCircle2 size={16} /> Variables Dinámicas Disponibles:
            </h3>
            <ul className="grid grid-cols-2 gap-2 list-disc list-inside opacity-80">
                <li><code>{'{TITLE}'}</code>: Título del Producto</li>
                <li><code>{'{PRICE}'}</code>: Precio Actual</li>
                <li><code>{'{CURRENCY}'}</code>: Moneda (ARS)</li>
                <li><code>{'{STOCK}'}</code>: Stock Real Disponible</li>
                <li><code>{'{DESCRIPTION}'}</code>: Descripción completa</li>
                <li><code>{'{ATTRIBUTES}'}</code>: Ficha Técnica</li>
            </ul>
        </div>
      </div>
    </div>
  );
};

export default AdminPromptEditor;
