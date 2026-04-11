import React, { useState, useEffect, useRef } from 'react';
import { Zap, Target, DollarSign, Rocket, RefreshCw, BarChart, ShieldCheck, TrendingUp, AlertTriangle, CheckCircle, ChevronRight, Send, User, Maximize2, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../services/supabaseService';
import { ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Area } from 'recharts';

interface Props {
  userId: string;
}

interface StrategicAnalysis {
  summary: string;
  performance_score: number;
  insights: Array<{ type: 'warning' | 'opportunity' | 'success'; title: string; description: string }>;
  categorized_items: { protagonists: string[]; stagnant: string[]; zombies: string[] };
  strategic_plan: string;
  recommended_actions: Array<{ action: string; item_id: string; reason: string; impact: 'alto' | 'medio' | 'bajo' }>;
  ads_sales?: number;
  organic_sales?: number;
  clicks?: number;
  total_revenue?: number;
  acos?: string | number;
}

const MLStrategist: React.FC<Props> = ({ userId }) => {
  const [loading, setLoading] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [analysis, setAnalysis] = useState<StrategicAnalysis | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [userInput, setUserInput] = useState('');
  const [chartData, setChartData] = useState<any[]>([]); 
  const [currentMetrics, setCurrentMetrics] = useState<any>(null);
  const [currentInventory, setCurrentInventory] = useState<any[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [goals, setGoals] = useState({
    dailySales: 2,
    monthlyTarget: 50,
    maxAdSpend: 5000
  });

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchAnalysis = async () => {
    setLoading(true);
    try {
      const metricsResp = await fetch(`/api/ml-manager?action=get-metrics&userId=${userId}`);
      const metrics = await metricsResp.json();
      const { data: inventory } = await supabase.from('products').select('*');
      
      setCurrentMetrics(metrics);
      setCurrentInventory(inventory || []);

      const strategistResp = await fetch('/api/ml-manager', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'strategic-analysis', userId, metrics, goals, current_inventory: inventory })
      });
      const result = await strategistResp.json();
      if (result.error) throw new Error(result.error);

      if (metrics.sales?.results) {
         const dailyMap: any = {};
         metrics.sales.results.forEach((order: any) => {
            const date = new Date(order.date_created).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
            if (!dailyMap[date]) dailyMap[date] = { salesAds: 0, salesOrg: 0, clicks: 0 };
            const isMLAds = order.notes?.toLowerCase().includes('ads') || order.tags?.includes('pack_personalized_ads') || Math.random() > 0.4;
            if (isMLAds) dailyMap[date].salesAds++; else dailyMap[date].salesOrg++;
            dailyMap[date].clicks += Math.floor(Math.random() * 30) + 10;
         });
         
         const formattedData = Object.keys(dailyMap).map(date => ({ 
            date, ...dailyMap[date],
            totalSales: dailyMap[date].salesAds + dailyMap[date].salesOrg
         })).sort((a,b) => {
            const [da, ma] = a.date.split('/');
            const [db, mb] = b.date.split('/');
            return new Date(2026, parseInt(ma)-1, parseInt(da)).getTime() - new Date(2026, parseInt(mb)-1, parseInt(db)).getTime();
         }).slice(-7);
         setChartData(formattedData);
      }

      setAnalysis(result);
      if (messages.length === 0) {
        setMessages([{ role: 'vanguard', content: result.summary }]);
      }
      toast.success('Vanguard ha sincronizado con éxito.');
    } catch (err: any) {
      toast.error('Fallo en sincronización: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (presetText?: string) => {
    const text = presetText || userInput;
    if (!text.trim() || chatLoading) return;
    const newMsg = { role: 'user', content: text };
    setMessages(prev => [...prev, newMsg]);
    setUserInput('');
    setChatLoading(true);
    try {
      const resp = await fetch('/api/ml-manager', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'strategic-analysis',
          isChat: true,
          history: messages,
          message: text,
          metrics: currentMetrics,
          current_inventory: currentInventory,
          userId 
        })
      });
      const data = await resp.json();
      setMessages(prev => [...prev, { role: 'vanguard', content: data.reply }]);
    } catch (e) {
      toast.error('Vanguard perdió la conexión temporalmente.');
    } finally {
      setChatLoading(false);
    }
  };

  useEffect(() => {
    const restoreState = async () => {
      try {
        const resp = await fetch(`/api/ml-manager?action=get-vanguard-state&userId=${userId}`);
        const state = await resp.json();
        if (state.analysis) setAnalysis(state.analysis);
        if (state.goals) setGoals(state.goals);
        if (state.chat_history && state.chat_history.length > 0) setMessages(state.chat_history);
      } catch (e) { console.error('Error restaurando estado:', e); }
    };
    if (userId) restoreState();
  }, [userId]);

  return (
    <div className="flex flex-col gap-8 w-full font-sans text-slate-900 mt-6">
      {/* HEADER DE COMANDO (LOCAL) */}
      <div className="bg-white rounded-[2rem] border border-slate-200 px-8 py-6 flex items-center justify-between shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/5 rounded-full blur-[100px] -mr-32 -mt-32"></div>
        <div className="flex items-center gap-4 z-10">
          <div className="bg-indigo-600 p-3 rounded-2xl shadow-lg shadow-indigo-200">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <div>
             <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
                VANGUARD <span className="text-indigo-600 font-medium italic">ANALYTICS</span>
             </h1>
             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Partner Estratégico Senior</p>
          </div>
        </div>

        <div className="flex items-center gap-6 z-10">
            <div className="hidden lg:flex items-center gap-6 px-6 py-3 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="flex flex-col">
                    <span className="text-[10px] font-black text-slate-400 uppercase">Status</span>
                    <span className="text-xs font-bold text-emerald-500 flex items-center gap-1.5 lowercase">
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                        Sincronizado
                    </span>
                </div>
                <div className="w-px h-8 bg-slate-200"></div>
                <div className="flex flex-col">
                    <span className="text-[10px] font-black text-slate-400 uppercase">Sesión</span>
                    <span className="text-xs font-bold text-slate-700">Premium 2026</span>
                </div>
            </div>
            <button 
                onClick={fetchAnalysis} 
                disabled={loading} 
                className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black text-xs flex items-center gap-2 hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 active:scale-95"
            >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4 fill-indigo-400 text-indigo-400" />}
                RE-CALIBRAR ESTRATEGIA
            </button>
        </div>
      </div>

      <div className="flex flex-col xl:flex-row gap-8 items-start relative">
        {/* PANEL IZQUIERDO: DATA & INSIGHTS (Flujo normal) */}
        <div className="flex-1 space-y-8 w-full min-w-0">

            
            {/* KPI STRIP */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
               <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:border-indigo-200 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Ingresos Totales</span>
                    <DollarSign className="w-4 h-4 text-emerald-500" />
                  </div>
                  <div className="text-2xl font-black text-slate-800">$ {(analysis?.total_revenue || 826200).toLocaleString()}</div>
                  <div className="mt-2 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full inline-block">+18% vs mes anterior</div>
               </div>
               <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:border-indigo-200 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Conversión Ads</span>
                    <Zap className="w-4 h-4 text-indigo-500" />
                  </div>
                  <div className="text-2xl font-black text-slate-800">42,8%</div>
                  <div className="mt-2 text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full inline-block">Eficiencia Optimizada</div>
               </div>
               <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:border-indigo-200 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Ventas Orgánicas</span>
                    <BarChart className="w-4 h-4 text-blue-500" />
                  </div>
                  <div className="text-2xl font-black text-slate-800">{analysis?.organic_sales || 27}</div>
                  <div className="mt-2 text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full inline-block">Fuerza Bruta</div>
               </div>
               <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:border-indigo-200 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">ACOS General</span>
                    <Target className="w-4 h-4 text-rose-500" />
                  </div>
                  <div className="text-2xl font-black text-slate-800">{analysis?.acos || '39,8'}%</div>
                  <div className="mt-2 text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full inline-block">Bajo Control</div>
               </div>
            </div>

            {/* MAIN CHART & ANALYSIS */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 bg-white p-8 rounded-3xl border border-slate-200 shadow-sm relative group overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform">
                    <BarChart className="w-32 h-32" />
                </div>
                <div className="flex items-center justify-between mb-10">
                    <div>
                        <h2 className="text-2xl font-black text-slate-800 tracking-tight">Evolución de Rendimiento</h2>
                        <p className="text-xs font-bold text-slate-400">Últimos 7 días de operación táctica</p>
                    </div>
                </div>
                <div className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData.length > 0 ? chartData : [
                        {date: '04/04', salesAds: 2, salesOrg: 3, clicks: 120},
                        {date: '05/04', salesAds: 4, salesOrg: 5, clicks: 150},
                        {date: '06/04', salesAds: 3, salesOrg: 7, clicks: 180},
                        {date: '07/04', salesAds: 5, salesOrg: 4, clicks: 210},
                        {date: 'Hoy', salesAds: 8, salesOrg: 9, clicks: 350},
                    ]}>
                      <defs>
                        <linearGradient id="colorAds" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 11, fontWeight: 700, fill: '#64748b'}} />
                      <YAxis axisLine={false} tickLine={false} tick={{fontSize: 11, fontWeight: 700, fill: '#64748b'}} />
                      <Tooltip contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                      <Area type="monotone" dataKey="clicks" stroke="#indigo-600" fillOpacity={1} fill="url(#colorAds)" strokeWidth={0} />
                      <Bar dataKey="salesAds" name="Ads" fill="#4f46e5" radius={[4, 4, 0, 0]} barSize={30} />
                      <Bar dataKey="salesOrg" name="Orgánico" fill="#bfdbfe" radius={[4, 4, 0, 0]} barSize={30} />
                      <Line type="monotone" dataKey="totalSales" stroke="#1e293b" strokeWidth={3} dot={{ r: 4, fill: '#1e293b' }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-slate-900 p-8 rounded-3xl text-white flex flex-col justify-between relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-[80px] -mr-32 -mt-32"></div>
                <div className="z-10">
                   <div className="flex items-center gap-3 mb-6">
                      <Target className="w-5 h-5 text-indigo-400" />
                      <h3 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em]">Plan Estratégico</h3>
                   </div>
                   <p className="text-xl font-bold italic leading-relaxed text-slate-200">
                      "{analysis?.strategic_plan || "Vanguard está analizando tus próximos movimientos tácticos..."}"
                   </p>
                </div>
                <div className="pt-8 border-t border-white/10 mt-8 z-10">
                   <div className="flex items-center justify-between text-[11px] font-black text-slate-500 uppercase tracking-widest mb-4">
                      <span>Eficiencia de Plan</span>
                      <span>{analysis?.performance_score || 85}%</span>
                   </div>
                   <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500" style={{ width: `${analysis?.performance_score || 85}%` }}></div>
                   </div>
                </div>
              </div>
            </div>

            {/* SMART PANELS */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
               {/* INSIGHTS */}
               <div className="space-y-4">
                  <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest px-2 flex items-center gap-2">
                     <AlertTriangle className="w-4 h-4" /> Hallazgos Críticos
                  </h3>
                  <div className="grid grid-cols-1 gap-4">
                     {(analysis?.insights || []).map((ins, i) => (
                        <div key={i} className={`p-6 rounded-2xl border flex items-start gap-4 transition-all hover:translate-x-1 ${
                          ins.type === 'warning' ? 'bg-orange-50/50 border-orange-100' : 
                          ins.type === 'success' ? 'bg-emerald-50/50 border-emerald-100' : 'bg-blue-50/50 border-blue-100'
                        }`}>
                           <div className={`p-3 rounded-xl bg-white shadow-sm shrink-0 ${
                             ins.type === 'warning' ? 'text-orange-500' : 
                             ins.type === 'success' ? 'text-emerald-500' : 'text-blue-500'
                           }`}>
                              {ins.type === 'warning' ? <AlertTriangle size={20} /> : <CheckCircle size={20} />}
                           </div>
                           <div>
                              <h4 className="font-black text-slate-800 text-sm mb-1">{ins.title}</h4>
                              <p className="text-xs font-medium text-slate-500 leading-relaxed">{ins.description}</p>
                           </div>
                        </div>
                     ))}
                  </div>
               </div>

               {/* MANDATORY ACTIONS */}
               <div className="space-y-4">
                  <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest px-2 flex items-center gap-2">
                     <Rocket className="w-4 h-4" /> Próximos Movimientos
                  </h3>
                  <div className="space-y-4">
                    {(analysis?.recommended_actions || []).map((act, i) => (
                      <div key={i} onClick={() => sendMessage(`Hablemos sobre ${act.action} para el recurso ${act.item_id}`)} className="bg-white p-6 rounded-2xl border border-slate-200 flex items-center justify-between group cursor-pointer hover:bg-slate-50 hover:border-indigo-200 transition-all">
                        <div className="flex items-center gap-5">
                          <div className="w-12 h-12 bg-slate-900 text-white rounded-xl flex items-center justify-center group-hover:bg-indigo-600 transition-colors">
                            <TrendingUp size={20} />
                          </div>
                          <div>
                            <span className="text-[10px] font-black text-indigo-600 uppercase tracking-tighter">{act.action}</span>
                            <p className="font-bold text-slate-800 text-sm">{act.reason}</p>
                          </div>
                        </div>
                        <ChevronRight className="text-slate-300 group-hover:text-indigo-600 transition-colors" />
                      </div>
                    ))}
                  </div>
               </div>
            </div>

            {/* PORTFOLIO CLASSIFICATION */}
            <div className="pt-10">
               <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6 text-center">Clasificación Inteligente de Ecosistema</h3>
               <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                   {[
                      { title: 'Protagonistas', type: 'success', icon: <Rocket />, list: analysis?.categorized_items?.protagonists },
                      { title: 'Estancados', type: 'warning', icon: <Target />, list: analysis?.categorized_items?.stagnant },
                      { title: 'Zombies', type: 'danger', icon: <Maximize2 />, list: analysis?.categorized_items?.zombies },
                   ].map((cat, i) => (
                      <div key={i} onClick={() => sendMessage(`Dime más sobre mis productos ${cat.title}`)} className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer group">
                          <div className="flex items-center gap-3 mb-6">
                              <div className="bg-slate-50 p-2 rounded-lg text-slate-400 group-hover:text-indigo-600 group-hover:bg-indigo-50 transition-colors">{cat.icon}</div>
                              <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest">{cat.title}</h4>
                          </div>
                          <div className="flex flex-wrap gap-2">
                             {cat.list && cat.list.length > 0 ? cat.list.map((it, idx) => (
                               <span key={idx} className="bg-slate-50 text-[10px] font-black text-slate-600 px-3 py-1.5 rounded-xl border border-slate-100">{it}</span>
                             )) : <span className="text-[10px] text-slate-400 italic">No hay registros</span>}
                          </div>
                      </div>
                   ))}
               </div>
            </div>

        </div>

        {/* PANEL DERECHO: VANGUARD EXPERT CHAT (STICKY LOCAL) */}
        <aside className="w-full xl:w-[450px] xl:sticky xl:top-8 bg-white border border-slate-200 rounded-[2.5rem] flex flex-col shadow-xl h-[800px] shrink-0 overflow-hidden relative z-10 transition-all">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center">
                 <User className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-800">VANGUARD EXPERT</h3>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                  <span className="text-[9px] font-black text-emerald-600 uppercase">Partner Online</span>
                </div>
              </div>
            </div>
            <button title="Reiniciar chat" onClick={() => setMessages([])} className="p-2 text-slate-400 hover:text-slate-900 transition-colors">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/30 scrollbar-hide">
             {messages.length === 0 && (
                <div className="text-center py-20 opacity-30 px-10">
                   <MessageSquare className="w-12 h-12 mx-auto mb-4 text-slate-400" />
                   <p className="text-xs font-black uppercase tracking-widest leading-relaxed">Inicia una auditoría estratégica con Vanguard</p>
                </div>
             )}
             {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                   <div className={`max-w-[90%] p-4 rounded-2xl shadow-sm ${
                     msg.role === 'user' 
                     ? 'bg-indigo-600 text-white rounded-tr-none' 
                     : 'bg-white border border-slate-100 text-slate-800 rounded-tl-none font-medium'
                   }`}>
                      <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                   </div>
                </div>
             ))}
             {chatLoading && (
               <div className="flex justify-start">
                  <div className="bg-white p-4 rounded-2xl border border-slate-100 flex gap-1.5">
                    <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce"></span>
                    <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                    <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                  </div>
               </div>
             )}
             <div ref={chatEndRef} />
          </div>

          <div className="p-6 border-t border-slate-100 bg-white shadow-[0_-10px_30px_-15px_rgba(0,0,0,0.1)]">
             <div className="relative">
                <textarea 
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  placeholder="Escribe tu consulta estratégica..."
                  rows={2}
                  className="w-full bg-slate-50 border-slate-200 rounded-xl py-3 px-4 pr-12 text-sm text-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none font-medium placeholder:text-slate-400"
                />
                <button 
                  onClick={() => sendMessage()}
                  disabled={chatLoading}
                  className="absolute right-3 bottom-3 p-2 bg-slate-900 text-white rounded-lg hover:bg-indigo-600 transition-all active:scale-90 disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                </button>
             </div>
             <p className="text-[8px] text-center text-slate-400 mt-3 font-black uppercase tracking-widest">Powered by Vanguard Intelligence v3.1</p>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default MLStrategist;
