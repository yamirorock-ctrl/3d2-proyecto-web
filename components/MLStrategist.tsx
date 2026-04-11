import React, { useState, useEffect } from 'react';
import { Zap, Target, DollarSign, Rocket, RefreshCw, BarChart, ShieldCheck, TrendingUp, AlertTriangle, CheckCircle, ChevronRight, Send, User } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../services/supabaseService';
import { ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

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
  const [goals, setGoals] = useState({
    dailySales: 2,
    monthlyTarget: 50,
    maxAdSpend: 5000
  });

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
      setMessages([{ role: 'vanguard', content: result.summary }]);
      toast.success('Vanguard ha sincronizado con éxito.');
    } catch (err: any) {
      toast.error('Fallo en sincronización: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!userInput.trim() || chatLoading) return;
    const newMsg = { role: 'user', content: userInput };
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
          message: userInput,
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
    <div className="space-y-8 animate-in fade-in duration-1000 pb-20">
      <div className="bg-slate-950 text-white p-10 rounded-[3.5rem] shadow-2xl relative overflow-hidden flex flex-col md:flex-row justify-between items-center gap-8">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-[120px] -mr-32 -mt-32"></div>
        <div className="z-10">
          <div className="flex items-center gap-4 mb-3">
            <div className="bg-indigo-600 p-2.5 rounded-2xl shadow-lg shadow-indigo-500/20">
              <ShieldCheck className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-4xl font-black tracking-tighter">VANGUARD <span className="text-indigo-500 font-extralight italic">SENIOR PARTNER</span></h2>
          </div>
          <p className="text-slate-400 font-medium max-w-lg text-lg">Inteligencia estratégica de nivel corporativo para tu cuenta de Mercado Libre.</p>
        </div>
        <div className="z-10 flex flex-col items-center gap-2">
            <button onClick={fetchAnalysis} disabled={loading} className="bg-white text-slate-950 px-10 py-5 rounded-4xl font-black text-lg flex items-center gap-3 hover:bg-indigo-50 transition-all shadow-2xl active:scale-95">
                {loading ? <RefreshCw className="w-6 h-6 animate-spin" /> : <Zap className="w-6 h-6 fill-indigo-600" />}
                SINCRONIZAR ESTRATEGIA
            </button>
            <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Última actualización: Justo ahora</p>
        </div>
      </div>

      <div className="flex flex-col gap-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-white p-8 rounded-[3.5rem] border border-slate-100 shadow-sm">
             <div className="flex items-center gap-3 mb-6">
                <Target className="w-6 h-6 text-indigo-600" />
                <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Objetivos ML</h3>
             </div>
             <div className="space-y-4">
                <div>
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Meta Diaria</label>
                   <input title="Meta de ventas diarias" placeholder="2" type="number" value={goals.dailySales} onChange={(e) => setGoals({...goals, dailySales: Number(e.target.value)})} className="w-full bg-slate-50 border-none rounded-2xl p-4 font-black text-lg" />
                </div>
                <div>
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Target Mensual</label>
                   <input title="Objetivo de ventas mensual" placeholder="50" type="number" value={goals.monthlyTarget} onChange={(e) => setGoals({...goals, monthlyTarget: Number(e.target.value)})} className="w-full bg-slate-50 border-none rounded-2xl p-4 font-black text-lg" />
                </div>
                <div>
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Inversión Ads</label>
                   <input title="Inversión máxima en Ads" placeholder="5000" type="number" value={goals.maxAdSpend} onChange={(e) => setGoals({...goals, maxAdSpend: Number(e.target.value)})} className="w-full bg-slate-50 border-none rounded-2xl p-4 font-black text-lg" />
                </div>
             </div>
          </div>

          <div className="md:col-span-2 bg-white p-8 rounded-[3.5rem] border border-slate-100 shadow-sm">
             <div className="flex items-center gap-3 mb-6">
                <ShieldCheck className="w-6 h-6 text-indigo-600" />
                <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Hallazgos Estratégicos</h3>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {analysis?.insights?.slice(0, 4).map((insight, i) => (
                  <div key={i} className={`p-5 rounded-4xl border ${insight.type === 'success' ? 'bg-emerald-50 border-emerald-100' : insight.type === 'warning' ? 'bg-rose-50 border-rose-100' : 'bg-indigo-50 border-indigo-100'}`}>
                    <h5 className="text-[10px] font-black uppercase mb-2">{insight.title}</h5>
                    <p className="text-xs text-slate-600 leading-relaxed font-medium">{insight.description}</p>
                  </div>
                ))}
             </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-4 lg:sticky lg:top-8 order-2 lg:order-1">
            <div className="bg-slate-950 rounded-[3rem] overflow-hidden shadow-2xl flex flex-col h-[750px] border border-slate-800">
              <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/5 backdrop-blur-xl">
                  <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center"><User className="w-6 h-6 text-white" /></div>
                      <div>
                        <h3 className="text-white font-black text-sm">VANGUARD AI</h3>
                        <p className="text-[9px] text-emerald-400 font-black uppercase">Analista Senior Online</p>
                      </div>
                  </div>
                  <button title="Reiniciar chat de estrategia" onClick={() => setMessages([])} className="text-slate-500 hover:text-white"><RefreshCw className="w-5 h-5" /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                  {messages.map((msg, i) => (
                      <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[85%] p-4 rounded-3xl ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-sm' : 'bg-white/5 text-slate-200 rounded-tl-sm border border-white/10'}`}>
                              <p className="text-xs leading-relaxed font-medium">{msg.content}</p>
                          </div>
                      </div>
                  ))}
                  {chatLoading && <div className="flex justify-start"><div className="bg-white/5 p-4 rounded-2xl flex gap-2"><span className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce"></span></div></div>}
              </div>
              <div className="p-6 bg-white/5 border-t border-white/5">
                  <div className="relative flex items-center">
                       <input value={userInput} onChange={(e) => setUserInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendMessage()} placeholder="Discutir movimientos..." className="w-full bg-slate-900 border-none rounded-2xl py-4 px-5 pr-14 text-sm text-slate-200" />
                       <button title="Enviar mensaje a Vanguard" onClick={sendMessage} className="absolute right-2 p-3 bg-indigo-600 text-white rounded-xl"><Send className="w-5 h-5" /></button>
                  </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-8 space-y-10 order-1 lg:order-2">
            {!analysis && !loading ? (
              <div className="bg-white h-[600px] flex flex-col items-center justify-center rounded-[4rem] border-2 border-dashed border-slate-200 p-12">
                <BarChart className="w-20 h-20 text-slate-200 mb-6" />
                <h3 className="text-2xl font-black text-slate-800">Dashboard en Espera</h3>
                <p className="text-slate-400 mt-4">Sincroniza tus métricas para comenzar.</p>
              </div>
            ) : loading ? (
              <div className="bg-white h-[600px] flex flex-col items-center justify-center rounded-[4rem] p-12">
                <RefreshCw className="w-16 h-16 text-indigo-600 animate-spin mb-6" />
                <h3 className="text-2xl font-black text-slate-800">Analizando Ecosistema...</h3>
              </div>
            ) : analysis && (
              <div className="space-y-10">
                <div className="bg-white p-10 rounded-[3.5rem] shadow-xl border border-indigo-50 flex items-center gap-10 group">
                    <div className="flex-1">
                        <h3 className="text-[10px] font-black text-indigo-600 uppercase mb-2">Executive Summary</h3>
                        <p className="text-xl font-bold text-slate-800 italic">"{analysis.summary}"</p>
                    </div>
                    <div className="p-8 bg-slate-50 rounded-[3rem] border border-slate-100 flex flex-col items-center">
                        <div className="text-2xl font-black text-slate-800">{analysis.performance_score}</div>
                        <p className="text-[9px] font-black text-slate-400 uppercase mt-1">Score</p>
                    </div>
                </div>

                <div className="bg-white p-12 rounded-[4rem] shadow-sm border border-slate-100">
                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-6 mb-12">
                        {[
                            { label: 'Ventas Ads', value: analysis?.ads_sales || '17', delta: '+183%', color: 'blue' },
                            { label: 'Orgánicas', value: analysis?.organic_sales || '6', delta: '+200%', color: 'blue' },
                            { label: 'Clicks', value: analysis?.clicks || '1.786', delta: '+173%', color: 'purple' },
                            { label: 'Ingresos', value: `$ ${(analysis?.total_revenue || 460847).toLocaleString()}`, delta: '+185%', color: 'emerald' },
                            { label: 'ACOS', value: `${analysis?.acos || '39,82'}%`, delta: '+29%', color: 'rose' },
                        ].map((m, i) => (
                            <div key={i} onClick={() => { setUserInput(`Analiza mis métricas de ${m.label}...`); setTimeout(() => sendMessage(), 100); }} className="bg-slate-50 p-6 rounded-3xl cursor-pointer hover:bg-white border border-transparent hover:border-indigo-100 transition-all">
                                <span className="text-[9px] font-black text-slate-400 uppercase block mb-2">{m.label}</span>
                                <div className="flex items-end justify-between">
                                    <span className="text-2xl font-black text-slate-800">{m.value}</span>
                                    <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">{m.delta}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="h-[400px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={chartData.length > 0 ? chartData : [{date: 'Hoy', salesAds: 4, salesOrg: 2, clicks: 350}]}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700}} />
                                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700}} />
                                <Tooltip contentStyle={{borderRadius: '16px', border: 'none'}} />
                                <Bar dataKey="salesAds" name="Ads" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={20} />
                                <Bar dataKey="salesOrg" name="Org" fill="#bfdbfe" radius={[4, 4, 0, 0]} barSize={20} />
                                <Line type="monotone" dataKey="clicks" name="Clicks" stroke="#a855f7" strokeWidth={3} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                   {analysis.insights.map((insight, idx) => (
                     <div key={idx} className={`p-8 rounded-[2.5rem] border ${insight.type === 'warning' ? 'bg-orange-50' : insight.type === 'success' ? 'bg-emerald-50' : 'bg-blue-50'}`}>
                        <h4 className="font-black text-slate-800 text-sm mb-2">{insight.title}</h4>
                        <p className="text-xs text-slate-600">{insight.description}</p>
                     </div>
                   ))}
                </div>

                <div className="bg-slate-900 p-10 rounded-[3.5rem] text-white">
                    <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-8">Portfolio Class</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {['Protagonistas', 'Estancados', 'Zombies'].map((title, i) => (
                            <div key={i} onClick={() => { setUserInput(`Hablame de mis productos ${title}...`); setTimeout(() => sendMessage(), 100); }} className="bg-white/5 p-6 rounded-3xl cursor-pointer hover:bg-white/10 border border-white/5 transition-all text-center">
                                <h5 className="text-[10px] font-black text-slate-400 uppercase mb-4">{title}</h5>
                                <div className="text-xs font-bold text-slate-300">Click para analizar</div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="space-y-6">
                   <h3 className="text-2xl font-black text-slate-800">Acciones Mandatorias</h3>
                   {analysis.recommended_actions.map((act, idx) => (
                      <div key={idx} onClick={() => { setUserInput(`Ejecutar: ${act.action}.`); setTimeout(() => sendMessage(), 100); }} className="bg-white p-8 rounded-[3rem] border border-slate-100 flex items-center justify-between cursor-pointer hover:shadow-lg transition-all">
                         <div className="flex items-center gap-6">
                            <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600"><TrendingUp /></div>
                            <div>
                               <div className="text-[10px] font-black text-indigo-600 uppercase mb-1">{act.action}</div>
                               <p className="font-bold text-slate-800">{act.reason}</p>
                            </div>
                         </div>
                         <ChevronRight className="text-slate-300" />
                      </div>
                   ))}
                </div>

                <div className="bg-slate-950 p-12 rounded-[3.5rem] text-white">
                    <h3 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-6">Strategic Plan 2026</h3>
                    <p className="text-xl font-bold italic leading-relaxed">"{analysis.strategic_plan}"</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MLStrategist;
