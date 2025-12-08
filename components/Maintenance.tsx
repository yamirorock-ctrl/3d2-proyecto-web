import React from 'react';
import { Hammer } from 'lucide-react';

const Maintenance: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 text-center">
      <div className="relative mb-8 text-white">
        <div className="absolute inset-0 bg-indigo-500 blur-xl opacity-20 animate-pulse rounded-full"></div>
        <Hammer size={80} className="relative z-10 text-indigo-400" />
      </div>
      
      <h1 className="text-4xl md:text-6xl font-black text-white mb-6 tracking-tight">
        Sitio en <span className="text-indigo-400">Mantenimiento</span>
      </h1>
      
      <p className="text-slate-300 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
        Estamos trabajando para mejorar tu experiencia. 
        <br />
        <span className="font-semibold text-white">Volveremos muy pronto con novedades increíbles.</span> 🚀
      </p>

      <div className="mt-12 flex flex-col sm:flex-row gap-4 justify-center">
        <div className="px-6 py-3 rounded-full bg-slate-800/50 border border-slate-700 text-slate-400 text-sm">
          3D2 Project • Print & Laser
        </div>
      </div>
    </div>
  );
};

export default Maintenance;
