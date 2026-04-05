import React, { useEffect, useState } from "react";
import { supabase } from "../services/supabaseService";
import { Bot, Power, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

export default function BotToggle() {
  const [isEnabled, setIsEnabled] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      const { data, error } = await supabase
        .from("app_settings")
        .select("bot_enabled")
        .eq("id", 1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setIsEnabled(data.bot_enabled);
      } else {
        // Si no hay fila 1, crearla por defecto apagada
        console.warn("Fila id=1 no encontrada en app_settings. Creando...");
        await supabase.from("app_settings").insert({ id: 1, bot_enabled: false });
        setIsEnabled(false);
      }
    } catch (err: any) {
      console.error("Error al obtener estado del bot:", err);
      // Fallback local por si Supabase falla
      setIsEnabled(false);
    }
  };

  const toggleBot = async () => {
    setLoading(true);
    const newState = !isEnabled;

    try {
      const { error } = await supabase
        .from("app_settings")
        .update({ 
          bot_enabled: newState,
          updated_at: new Date().toISOString()
        })
        .eq("id", 1);

      if (error) throw error;
      
      setIsEnabled(newState);
      toast.success(`Printy ${newState ? 'ENCENDIDO' : 'APAGADO'} correctamente`);
    } catch (err: any) {
      console.error("Failed to toggle bot:", err);
      toast.error("Error al sincronizar con la nube: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (isEnabled === null) {
      return (
          <div className="flex items-center gap-2 text-slate-400 text-sm italic">
              <RefreshCw size={14} className="animate-spin" /> Sincronizando Printy...
          </div>
      );
  }

  return (
    <div className={`flex items-center gap-4 px-4 py-3 rounded-xl border transition-all duration-300 ${
        isEnabled 
          ? "bg-emerald-50 border-emerald-100 shadow-sm" 
          : "bg-slate-50 border-slate-200"
    }`}>
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${isEnabled ? "bg-emerald-100 text-emerald-600 shadow-inner" : "bg-slate-200 text-slate-500"}`}>
            <Bot size={20} />
        </div>
        <div>
            <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Printy (ML)</span>
                <span className={`w-2 h-2 rounded-full ${isEnabled ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`} />
            </div>
            <p className="text-sm font-bold text-slate-700">
                {isEnabled ? "ACTIVADO 🛰️" : "APAGADO 💤"}
            </p>
        </div>
      </div>
      
      <button
        onClick={toggleBot}
        disabled={loading}
        className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-tractive flex items-center gap-2 transition-all shadow-md transform active:scale-95 ${
          isEnabled
            ? "bg-rose-500 text-white hover:bg-rose-600 shadow-rose-200"
            : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200"
        } ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        <Power size={14} />
        {loading ? "Sincronizando..." : isEnabled ? "Apagar IA 🛑" : "Encender IA ⚡"}
      </button>
    </div>
  );
}
