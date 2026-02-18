
import React, { useState, useEffect } from 'react';
import { getAIQuestions } from '../services/supabaseService';
import { Bot, MessageSquare, AlertTriangle, CheckCircle, Clock, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import BotToggle from './BotToggle';

interface AIQuestion {
  id: string;
  item_id: string;
  question_text: string;
  answer_text: string;
  status: 'pending' | 'answered' | 'error' | 'ignored';
  created_at: string;
  ai_model: string;
}

interface AIMonitorProps {
  onSwitchToBrain?: () => void;
}

const AIMonitor: React.FC<AIMonitorProps> = ({ onSwitchToBrain }) => {
  const [questions, setQuestions] = useState<AIQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [groupedQuestions, setGroupedQuestions] = useState<AIQuestion[]>([]);

  useEffect(() => {
    loadQuestions();
  }, []);

  const loadQuestions = async () => {
    setLoading(true);
    const { data, error } = await getAIQuestions();
    if (error) {
      toast.error('Error cargando historial de IA');
    } else {
      const rawQuestions = data as AIQuestion[];
      setQuestions(rawQuestions);
      
      const uniqueMap = new Map<string, AIQuestion>();
      rawQuestions.forEach(q => {
        const key = `${q.item_id}-${q.question_text.trim()}`;
        if (!uniqueMap.has(key)) {
            uniqueMap.set(key, q);
        }
      });
      setGroupedQuestions(Array.from(uniqueMap.values()));
    }
    setLoading(false);
  };

  const pendingCount = groupedQuestions.filter(q => q.status === 'pending').length;
  const answeredCount = questions.filter(q => q.status === 'answered').length;
  const errorCount = groupedQuestions.filter(q => q.status === 'error').length;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-center bg-white p-6 rounded-xl border border-indigo-100 shadow-sm gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Bot className="text-indigo-600" /> Monitor de Respuestas IA
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Supervisa y controla el asistente Printy (MercadoLibre).
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
            <BotToggle />
            
            <div className="h-8 w-px bg-slate-200 mx-2 hidden sm:block"></div>

            {onSwitchToBrain && (
                <button 
                  onClick={onSwitchToBrain}
                  className="px-4 py-2 bg-white border border-indigo-200 text-indigo-700 rounded-lg hover:bg-indigo-50 transition-colors flex items-center gap-2 text-sm font-medium shadow-sm whitespace-nowrap"
                >
                  <Bot size={16} />
                  Cerebro
                </button>
            )}
            <button 
              onClick={loadQuestions}
              className="px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors flex items-center gap-2 text-sm font-medium whitespace-nowrap"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl flex items-center gap-4">
          <div className="p-3 bg-emerald-100 text-emerald-600 rounded-lg">
            <CheckCircle size={24} />
          </div>
          <div>
            <p className="text-sm text-emerald-800 font-medium">Respondidas (Total)</p>
            <p className="text-2xl font-bold text-emerald-900">{answeredCount}</p>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl flex items-center gap-4">
          <div className="p-3 bg-amber-100 text-amber-600 rounded-lg">
            <Clock size={24} />
          </div>
          <div>
            <p className="text-sm text-amber-800 font-medium">Pendientes</p>
            <p className="text-2xl font-bold text-amber-900">{pendingCount}</p>
          </div>
        </div>

        <div className="bg-rose-50 border border-rose-100 p-4 rounded-xl flex items-center gap-4">
          <div className="p-3 bg-rose-100 text-rose-600 rounded-lg">
            <AlertTriangle size={24} />
          </div>
          <div>
            <p className="text-sm text-rose-800 font-medium">Errores Actuales</p>
            <p className="text-2xl font-bold text-rose-900">{errorCount}</p>
          </div>
        </div>
      </div>

      {/* Questions List (Grouped) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 font-medium text-slate-700 flex items-center gap-2">
            <MessageSquare size={18}/> Últimas Interacciones (Agrupadas)
        </div>
        
        {groupedQuestions.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
                <Bot size={48} className="mx-auto mb-4 opacity-20" />
                <p>Aún no hay preguntas registradas.</p>
            </div>
        ) : (
            <div className="divide-y divide-slate-100">
                {groupedQuestions.map((q) => (
                    <div key={q.id} className="p-4 hover:bg-slate-50 transition-colors group">
                        <div className="flex flex-col sm:flex-row gap-4">
                            
                            {/* Status Badge */}
                            <div className="w-full sm:w-32 shrink-0 flex flex-col gap-2">
                                <span className={`px-2 py-1 rounded text-xs font-bold uppercase tracking-wider text-center ${
                                    q.status === 'answered' ? 'bg-emerald-100 text-emerald-700' :
                                    q.status === 'error' ? 'bg-rose-100 text-rose-700' :
                                    q.status === 'ignored' ? 'bg-gray-100 text-gray-500' :
                                    'bg-amber-100 text-amber-700'
                                }`}>
                                    {q.status === 'answered' ? 'Respondida' : 
                                     q.status === 'error' ? 'Fallido' : 
                                     q.status === 'ignored' ? 'Omitida' : 'Pendiente'}
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono text-center">
                                    {new Date(q.created_at).toLocaleString('es-AR', { 
                                        hour: '2-digit', minute:'2-digit', day: '2-digit', month: '2-digit' 
                                    })}
                                </span>
                            </div>

                            {/* Content */}
                            <div className="flex-1 space-y-3">
                                {/* Pregunta */}
                                <div className="flex gap-2">
                                    <span className="text-lg">👤</span>
                                    <div className="bg-slate-50 p-3 rounded-lg w-full">
                                        <p className="font-medium text-slate-800">{q.question_text}</p>
                                        <p className="text-[10px] text-slate-400 mt-1 font-mono">Item: {q.item_id}</p>
                                    </div>
                                </div>

                                {/* Respuesta o Error */}
                                {q.answer_text && (
                                    <div className="flex gap-2 justify-end">
                                        <div className={`p-3 rounded-lg w-full text-sm relative ${
                                            q.status === 'error' 
                                                ? 'bg-rose-50 text-rose-800 border-l-4 border-rose-400' 
                                                : 'bg-indigo-50 text-indigo-900 border-l-4 border-indigo-400'
                                        }`}>
                                            {q.status === 'error' ? (
                                                <div className="flex flex-col gap-1">
                                                    <div className="flex items-center gap-2 font-bold mb-1">
                                                        <AlertTriangle size={14} /> Error al responder
                                                    </div>
                                                    <div className="opacity-90 font-mono text-xs bg-white/50 p-2 rounded max-h-20 overflow-auto">
                                                        {q.answer_text.length > 200 ? q.answer_text.slice(0, 200) + '...' : q.answer_text}
                                                    </div>
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="font-bold flex items-center gap-2 mb-1 text-indigo-700">
                                                        <Bot size={14} /> Printy
                                                    </div>
                                                    <p className="whitespace-pre-wrap">{q.answer_text}</p>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
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
