import React, { useState } from 'react';
import { RefreshCw, ShieldCheck, Database, FileText } from 'lucide-react';
import { toast } from 'sonner';

export const ArcaPanel: React.FC = () => {
  const [status, setStatus] = useState<'idle' | 'checking' | 'online' | 'offline'>('idle');
  const [message, setMessage] = useState('Verifica el estado del servidor de AFIP.');

  const testHandshake = async () => {
    setStatus('checking');
    try {
      const res = await fetch('/api/afip-status');
      const data = await res.json();
      if (data.online) {
        setStatus('online');
        setMessage(data.message || 'Conexión Exitosa con AFIP');
        toast.success('¡ARCA Conectado!');
      } else {
        setStatus('offline');
        setMessage(data.detail || data.message || 'Fallo la conexión');
        toast.error('AFIP no responde');
      }
    } catch (err) {
      setStatus('offline');
      setMessage('Error de Servidor (API)');
      toast.error('Fallo el endpoint de la API');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header Premium */}
      <div className="bg-linear-to-br from-amber-50 to-orange-50 border border-amber-100 rounded-2xl p-6 md:p-8 flex flex-col md:flex-row items-center gap-6 shadow-xs">
        <div className="h-20 w-20 bg-white rounded-2xl shadow-md flex items-center justify-center border border-amber-200">
          <img src="https://www.afip.gob.ar/favicon.ico" alt="AFIP" className="w-12 h-12 grayscale opacity-70" />
        </div>
        <div className="flex-1 text-center md:text-left">
          <h2 className="text-xl md:text-2xl font-bold text-slate-800 mb-2">Monitor Fiscal ARCA</h2>
          <p className="text-slate-600 max-w-lg mb-4">Gestión de facturación electrónica. Asegurate de tener los secretos blindados en Vercel.</p>
          
          <div className="flex flex-wrap justify-center md:justify-start gap-3">
             <div className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-semibold shadow-sm transition-all ${
               status === 'idle' ? 'bg-white border-slate-200 text-slate-400' :
               status === 'checking' ? 'bg-white border-blue-200 text-blue-500 animate-pulse' :
               status === 'online' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
               'bg-red-50 border-red-200 text-red-700'
             }`}>
               <div className={`w-2 h-2 rounded-full ${
                 status === 'online' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' :
                 status === 'offline' ? 'bg-red-500' :
                 status === 'checking' ? 'bg-blue-400' :
                 'bg-slate-300'
               }`}></div>
               {status === 'idle' ? 'Estado Desconocido' : 
                status === 'checking' ? 'Conectando...' :
                status === 'online' ? 'Sistema Operativo' : 'Sistema Fuera de Línea'}
             </div>

             <button 
               onClick={testHandshake}
               disabled={status === 'checking'}
               className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-2 disabled:opacity-50"
             >
               {status === 'checking' ? <RefreshCw className="animate-spin" size={16} /> : <RefreshCw size={16} />}
               RE-CONECTAR
             </button>
          </div>
        </div>
      </div>

      {/* Grid de Datos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-slate-100 rounded-xl p-5 shadow-xs hover:shadow-md transition-all">
          <h4 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Talonario</h4>
          <div className="text-xl font-bold text-slate-800">Punto Venta 001</div>
          <p className="text-slate-500 text-xs mt-1">Sincronizado</p>
        </div>
        <div className="bg-white border border-slate-100 rounded-xl p-5 shadow-xs hover:shadow-md transition-all">
          <h4 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Régimen</h4>
          <div className="text-xl font-bold text-slate-800">Monotributista</div>
          <p className="text-slate-500 text-xs mt-1">Categoría: ---</p>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 opacity-60">
           <div className="flex items-center justify-between mb-2">
             <h4 className="text-slate-400 text-xs font-bold uppercase tracking-wider">Facturas</h4>
             <Database size={14} className="text-slate-300" />
           </div>
           <div className="text-xl font-bold text-slate-400">0 Emitidas</div>
        </div>
      </div>

      {/* Visualizer Vacío */}
      <div className="bg-white border border-dashed border-slate-200 rounded-2xl p-12 text-center flex flex-col items-center">
        <div className="bg-slate-50 h-16 w-16 rounded-full flex items-center justify-center mb-4">
          <FileText size={32} className="text-slate-300" />
        </div>
        <h3 className="text-slate-800 font-bold text-lg mb-2">Sin Facturas Recientes</h3>
        <p className="text-slate-500 max-w-sm">Una vez que logres el handshake, tus facturas emitidas por WSFE aparecerán en este historial.</p>
      </div>
    </div>
  );
};
