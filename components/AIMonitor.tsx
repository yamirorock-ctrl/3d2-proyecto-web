import React, { useState, useEffect } from 'react';
import { getAIQuestions } from '../services/supabaseService';
import { Bot, MessageSquare, AlertTriangle, CheckCircle, Clock, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface AIQuestion {
  id: string;
  item_id: string;
  question_text: string;
  answer_text: string;
  status: 'pending' | 'answered' | 'error' | 'ignored';
  created_at: string;
  ai_model: string;
}

const AIMonitor: React.FC = () => {
  const [questions, setQuestions] = useState<AIQuestion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadQuestions();
  }, []);

  const loadQuestions = async () => {
    setLoading(true);
    const { data, error } = await getAIQuestions();
    if (error) {
      toast.error('Error cargando historial de IA');
    } else {
      setQuestions(data as AIQuestion[]);
    }
    setLoading(false);
  };

  const pendingCount = questions.filter(q => q.status === 'pending').length;
  const answeredCount = questions.filter(q => q.status === 'answered').length;
  const errorCount = questions.filter(q => q.status === 'error').length;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-center bg-white p-6 rounded-xl border border-indigo-100 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Bot className="text-indigo-600" /> Monitor de Respuestas IA
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Supervisa en tiempo real cómo 'Printy' responde a tus clientes en MercadoLibre.
          </p>
        </div>
        <button 
          onClick={loadQuestions}
          className="mt-4 sm:mt-0 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors flex items-center gap-2 text-sm font-medium"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          Actualizar
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl flex items-center gap-4">
          <div className="p-3 bg-emerald-100 text-emerald-600 rounded-lg">
            <CheckCircle size={24} />
          </div>
          <div>
            <p className="text-sm text-emerald-800 font-medium">Respondidas Exitosamente</p>
            <p className="text-2xl font-bold text-emerald-900">{answeredCount}</p>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl flex items-center gap-4">
          <div className="p-3 bg-amber-100 text-amber-600 rounded-lg">
            <Clock size={24} />
          </div>
          <div>
            <p className="text-sm text-amber-800 font-medium">Pendientes de Procesar</p>
            <p className="text-2xl font-bold text-amber-900">{pendingCount}</p>
          </div>
        </div>

        <div className="bg-rose-50 border border-rose-100 p-4 rounded-xl flex items-center gap-4">
          <div className="p-3 bg-rose-100 text-rose-600 rounded-lg">
            <AlertTriangle size={24} />
          </div>
          <div>
            <p className="text-sm text-rose-800 font-medium">Errores / Fallidos</p>
            <p className="text-2xl font-bold text-rose-900">{errorCount}</p>
          </div>
        </div>
      </div>

      {/* Questions List */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 font-medium text-slate-700 flex items-center gap-2">
            <MessageSquare size={18}/> Últimas Interacciones
        </div>
        
        {questions.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
                <Bot size={48} className="mx-auto mb-4 opacity-20" />
                <p>Aún no hay preguntas registradas.</p>
                <p className="text-xs mt-2">Las preguntas de MercadoLibre aparecerán aquí automáticamente.</p>
            </div>
        ) : (
            <div className="divide-y divide-slate-100">
                {questions.map((q) => (
                    <div key={q.id} className="p-6 hover:bg-slate-50 transition-colors group">
                        <div className="flex justify-between items-start mb-3">
                            <span className={`px-2 py-1 rounded text-xs font-bold uppercase tracking-wider ${
                                q.status === 'answered' ? 'bg-emerald-100 text-emerald-700' :
                                q.status === 'error' ? 'bg-rose-100 text-rose-700' :
                                q.status === 'ignored' ? 'bg-gray-100 text-gray-500' :
                                'bg-amber-100 text-amber-700'
                            }`}>
                                {q.status === 'answered' ? 'Respondida' : 
                                 q.status === 'error' ? 'Error' : 
                                 q.status === 'ignored' ? 'Omitida' : 'Pendiente'}
                            </span>
                            <span className="text-xs text-slate-400 font-mono">
                                {new Date(q.created_at).toLocaleString('es-AR')}
                            </span>
                        </div>

                        <div className="space-y-4">
                            {/* User Question */}
                            <div className="flex gap-3">
                                <div className="mt-1 w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 shrink-0">
                                    <span className="text-xs font-bold">👤</span>
                                </div>
                                <div className="p-3 bg-slate-100 rounded-lg rounded-tl-none text-slate-700 text-sm">
                                    <p>{q.question_text}</p>
                                    <p className="text-[10px] text-slate-400 mt-1 font-mono">Item ID: {q.item_id}</p>
                                </div>
                            </div>

                            {/* AI Answer */}
                            {q.answer_text && (
                                <div className="flex gap-3 justify-end">
                                    <div className={`p-3 rounded-lg rounded-tr-none text-sm max-w-[85%] shadow-sm ${
                                        q.status === 'error' 
                                            ? 'bg-rose-50 border border-rose-100 text-rose-800' 
                                            : 'bg-indigo-50 border border-indigo-100 text-indigo-900'
                                    }`}>
                                        <p className="whitespace-pre-wrap">{q.answer_text}</p>
                                        <p className="text-[10px] opacity-60 mt-2 flex justify-end gap-1">
                                            <span>🤖 {q.ai_model || 'AI'}</span>
                                        </p>
                                    </div>
                                    <div className="mt-1 w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                                        <Bot size={16} />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        )}
      </div>
    </div>
  );
};

export default AIMonitor;
