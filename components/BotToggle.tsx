
import React, { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
// using custom UI
// Using custom HTML checkbox for now or simple buttons.

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_TOKEN
);

export default function BotToggle() {
  const [isEnabled, setIsEnabled] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    const { data, error } = await supabase
      .from("app_settings")
      .select("bot_enabled")
      .eq("id", 1)
      .single();

    if (data) {
      setIsEnabled(data.bot_enabled);
    } else {
      console.warn("Table app_settings not found or empty (run SQL script first)");
    }
  };

  const toggleBot = async () => {
    if (isEnabled === null) return;
    setLoading(true);
    const newState = !isEnabled;

    try {
      const { error } = await supabase
        .from("app_settings")
        .update({ bot_enabled: newState })
        .eq("id", 1);

      if (error) throw error;
      setIsEnabled(newState);
    } catch (err) {
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
