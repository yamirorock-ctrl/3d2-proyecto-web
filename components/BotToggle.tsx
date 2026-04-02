import React, { useEffect, useState } from "react";
import { supabase } from "../services/supabaseService";
// using custom UI

export default function BotToggle() {
  const [isEnabled, setIsEnabled] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    const { data, error } = await (supabase.from("app_settings") as any)
      .select("value")
      .eq("key", "bot_enabled")
      .single();

    if (data && data.value) {
      setIsEnabled(data.value.enabled);
    } else {
      console.warn("Conf 'bot_enabled' no encontrada en app_settings. Se asume APAGADO por defecto.");
      setIsEnabled(false);
    }
  };

  const toggleBot = async () => {
    if (isEnabled === null) return;
    setLoading(true);
    const newState = !isEnabled;

    try {
      // Upsert para asegurar que la fila existe si no estaba
      const { error } = await (supabase.from("app_settings") as any)
        .upsert({ 
          key: "bot_enabled", 
          value: { enabled: newState },
          updated_at: new Date().toISOString()
        }, { onConflict: 'key' });

      if (error) throw error;
      setIsEnabled(newState);
    } catch (err: any) {
      console.error("Failed to toggle bot:", err);
      alert("Error al cambiar estado: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (isEnabled === null) return <div className="text-gray-500 text-sm">Cargando estado del Bot...</div>;

  return (
    <div className="flex items-center gap-4 p-4 bg-white/5 rounded-lg border border-white/10">
      <div className="flex items-center gap-2">
        <div className={`w-3 h-3 rounded-full ${isEnabled ? "bg-green-500 animate-pulse" : "bg-red-500"}`} />
        <span className="font-medium text-white">
          Printy (IA) está: <strong className={isEnabled ? "text-green-400" : "text-red-400"}>
            {isEnabled ? "ACTIVADO 🟢" : "APAGADO 🔴"}
          </strong>
        </span>
      </div>
      
      <button
        onClick={toggleBot}
        disabled={loading}
        className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${
          isEnabled
            ? "bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/50"
            : "bg-green-500/20 text-green-400 hover:bg-green-500/30 border border-green-500/50"
        } ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        {loading ? "Guardando..." : isEnabled ? "Apagar IA 🛑" : "Encender IA ⚡"}
      </button>
    </div>
  );
}
