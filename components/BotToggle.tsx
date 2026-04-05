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
      // Cast to any to bypass strict TS check on NEW table
      const { data, error } = await (supabase
        .from("app_settings") as any)
        .select("bot_enabled")
        .eq("id", 1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setIsEnabled(data.bot_enabled);
      } else {
        console.warn("Fila id=1 no encontrada. Creando...");
        await (supabase.from("app_settings") as any).insert({ id: 1, bot_enabled: false });
        setIsEnabled(false);
      }
    } catch (err: any) {
      console.error("Error al obtener estado:", err);
      setIsEnabled(false);
    }
  };

  const toggleBot = async () => {
    setLoading(true);
    const newState = !isEnabled;

    try {
      const { error } = await (supabase
        .from("app_settings") as any)
        .update({ 
          bot_enabled: newState,
          updated_at: new Date().toISOString()
        })
        .eq("id", 1);

      if (error) throw error;
      
      setIsEnabled(newState);
      toast.success(`Printy ${newState ? 'ENCENDIDO' : 'APAGADO'}`);
    } catch (err: any) {
      console.error("Failed to toggle bot:", err);
      toast.error("Error de sincronización: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (isEnabled === null) {
      return (
          <div className="flex items-center gap-2 text-slate-400 text-sm italic">
              <RefreshCw size={14} className="animate-spin" /> Sincronizando...
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
        <div className={`p-2 rounded-lg ${isEnabled ? "bg-emerald-100 text-emerald-600" : "bg-slate-200 text-slate-500"}`}>
            <Bot size={20} />
        </div>
        <div>
            <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase text-slate-400">Printy IA</span>
                <span className={`w-2 h-2 rounded-full ${isEnabled ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`} />
            </div>
            <p className="text-sm font-bold text-slate-700">
                {isEnabled ? "ACTIVADO 🟢" : "APAGADO 🔴"}
            </p>
        </div>
      </div>
      
      <button
        onClick={toggleBot}
        disabled={loading}
        className={`px-4 py-2 rounded-lg text-xs font-black uppercase flex items-center gap-2 transition-all shadow-md transform active:scale-95 ${
          isEnabled
            ? "bg-rose-500 text-white hover:bg-rose-600"
            : "bg-indigo-600 text-white hover:bg-indigo-700"
        } ${loading ? "opacity-50" : ""}`}
      >
        <Power size={14} />
        {loading ? "..." : isEnabled ? "Apagar🛑" : "Encender⚡"}
      </button>
    </div>
  );
}
