import { Zap, Target, DollarSign, Rocket, RefreshCw, BarChart, ShieldCheck, TrendingUp, AlertTriangle, CheckCircle, ChevronRight, Send, User } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../services/supabaseService';
import { LineChart, Line, BarChart as ReBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

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
}

const MLStrategist: React.FC<Props> = ({ userId }) => {
  const [loading, setLoading] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [analysis, setAnalysis] = useState<StrategicAnalysis | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [userInput, setUserInput] = useState('');
  const [chartData, setChartData] = useState<any[]>([]); // Data para los gráficos
  const [goals, setGoals] = useState({
    dailySales: 2,
    monthlyTarget: 50,
    maxAdSpend: 5000
  });

  const fetchAnalysis = async () => {
    setLoading(true);
    try {
      // 1. Obtener métricas reales de MELI desde el backend
      const metricsResp = await fetch('/api/ml-manager', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get-metrics', userId })
      });
      const metrics = await metricsResp.json();

      if (metrics.error) throw new Error(metrics.error);

      // 2. Obtener inventario actual para que el socio sepa qué podemos vender
      const { data: inventory } = await supabase.from('products').select('name, stock, ml_item_id');

      // 3. Consultar a VANGUARD vía el endpoint compartido (ahorro de funciones Vercel)
      const strategistResp = await fetch('/api/ml-manager', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'strategic-analysis', userId, metrics, goals, current_inventory: inventory })
      });
      const result = await strategistResp.json();
      
      if (result.error) {
        throw new Error(result.error);
      }

      // Procesar data para gráficos (ejemplo: ventas por día)
      if (metrics.sales?.results) {
         const dailyMap: any = {};
         metrics.sales.results.forEach((order: any) => {
            const date = new Date(order.date_created).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
            dailyMap[date] = (dailyMap[date] || 0) + 1;
         });
         const formattedData = Object.keys(dailyMap).map(date => ({ date, sales: dailyMap[date] })).reverse().slice(-7);
         setChartData(formattedData);
      }

      setAnalysis(result);
      setMessages([{ role: 'vanguard', content: result.summary }]);
      toast.success('Diagnóstico de Vanguard completado.');
    } catch (err: any) {
      console.error('[MLStrategist Error]:', err);
      toast.error('Vanguard falló: ' + (err.message || 'Error desconocido'));
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
          action: 'strategic-analysis', // Reusamos el mismo para ahora o creamos chat uno
          isChat: true,
          history: messages,
          message: userInput,
          userId 
        })
      });
      const data = await resp.json();
      setMessages(prev => [...prev, { role: 'vanguard', content: data.reply || data.summary }]);
    } catch (e) {
      toast.error('Error al hablar con Vanguard');
    } finally {
      setChatLoading(false);
    }
  };

  useEffect(() => {
    // Podríamos cargar el análisis automáticamente al entrar
  }, []);

  return (
    <div className="space-y-6 animate-in fade-in duration-700 pb-12">
      {/* Header Strategist */}
      <div className="bg-slate-900 text-white p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
        <div className="z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-indigo-500 p-2 rounded-xl">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-3xl font-black tracking-tight">VANGUARD <span className="text-indigo-400 font-light">SOCIO SENIOR</span></h2>
          </div>
          <p className="text-slate-400 font-medium max-w-md">Analizando métricas reales para maximizar tu rentabilidad y alcanzar tus objetivos mensuales.</p>
        </div>

        <div className="flex items-center gap-4 z-10 w-full md:w-auto">
           <button 
             onClick={fetchAnalysis}
             disabled={loading}
             className="flex-1 md:flex-none bg-white text-slate-900 px-6 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-50 transition-all shadow-lg active:scale-95 disabled:opacity-50"
           >
             {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5 fill-indigo-500" />}
             Solicitar Diagnóstico Estratégico
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Columna Izquierda: Objetivos y Metas */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white p-6 rounded-4xl shadow-sm border border-slate-100">
            <h3 className="text-lg font-bold mb-6 flex items-center gap-2 text-slate-800">
              <Target className="w-5 h-5 text-indigo-500" /> Definir Objetivos
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">Ventas por Día (Meta)</label>
                <input 
                  title="Meta de ventas diarias"
                  placeholder="Ej: 2"
                  type="number" 
                  value={goals.dailySales} 
                  onChange={(e) => setGoals({...goals, dailySales: Number(e.target.value)})}
                  className="w-full bg-slate-50 border-none rounded-xl p-3 font-bold text-slate-700" 
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">Presupuesto Diario Ads</label>
                <div className="relative">
                   <DollarSign className="absolute left-3 top-3.5 w-4 h-4 text-slate-400" />
                   <input 
                     title="Presupuesto máximo diario en Ads"
                     placeholder="Ej: 5000"
                     type="number" 
                     value={goals.maxAdSpend} 
                     onChange={(e) => setGoals({...goals, maxAdSpend: Number(e.target.value)})}
                     className="w-full bg-slate-50 border-none rounded-xl p-3 pl-10 font-bold text-slate-700" 
                   />
                </div>
              </div>
            </div>
            
            <div className="mt-8 p-4 bg-indigo-50 rounded-2xl border border-indigo-100 flex items-start gap-3">
               <Rocket className="w-8 h-8 text-indigo-500 shrink-0" />
               <p className="text-xs text-indigo-700 font-medium leading-relaxed">
                 Vanguard utilizará estos valores para calcular si tus campañas son rentables o si necesitas ajustes de precio urgentes para no desplomarte.
               </p>
            </div>
          </div>

          {analysis && (
            <div className="bg-white p-6 rounded-4xl shadow-sm border border-slate-100">
               <h3 className="text-lg font-bold mb-4 text-slate-800">Performance Score</h3>
               <div className="flex items-center gap-4">
                  <div className="relative w-24 h-24">
                     <svg className="w-full h-full" viewBox="0 0 36 36">
                        <path className="text-slate-100" strokeDasharray="100, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" />
                        <path className="text-indigo-500" strokeDasharray={`${analysis.performance_score}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                     </svg>
                     <div className="absolute inset-0 flex items-center justify-center font-black text-2xl text-slate-800">
                        {analysis.performance_score}
                     </div>
                  </div>
                  <div>
                     <p className="text-sm font-bold text-slate-700">Estado de la cuenta</p>
                     <p className="text-xs text-slate-400">Basado en cumplimiento de metas y eficiencia de Ads.</p>
                  </div>
               </div>
            </div>
          )}
        </div>

        {/* Columna Derecha: Análisis y Acciones */}
        <div className="lg:col-span-8">
          {!analysis && !loading ? (
             <div className="bg-white h-[400px] flex flex-col items-center justify-center rounded-[2.5rem] border-2 border-dashed border-slate-200 text-center p-8">
                <div className="bg-slate-50 p-8 rounded-full mb-6">
                   <BarChart className="w-16 h-16 text-slate-300" />
                </div>
                <h3 className="text-xl font-bold text-slate-500">Sin Diagnóstico Activo</h3>
                <p className="text-slate-400 max-w-sm mx-auto mt-2">Haz clic en solicitar diagnóstico para que Vanguard sincronice con MELI y analice tu situación real.</p>
             </div>
          ) : loading ? (
             <div className="bg-white h-[400px] flex flex-col items-center justify-center rounded-[2.5rem] shadow-sm text-center p-8">
                <RefreshCw className="w-12 h-12 text-indigo-500 animate-spin mb-4" />
                <h3 className="text-xl font-bold text-slate-800">Vanguard está procesando...</h3>
                <p className="text-slate-500 mt-2">Calculando rentabilidad, verificando stock y analizando la competencia.</p>
             </div>
          ) : analysis && (
             <div className="space-y-6">
                {/* Resumen Ejecutivo */}
                <div className="bg-white p-8 rounded-[2.5rem] shadow-lg border border-indigo-100">
                   <h3 className="text-sm font-black text-indigo-500 uppercase tracking-widest mb-2 font-mono">Executive Summary</h3>
                   <p className="text-xl font-medium text-slate-800 leading-relaxed italic">"{analysis.summary}"</p>
                </div>

                {/* Insights Rápidos */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                   {analysis?.insights?.map((insight, idx) => (
                     <div key={idx} className={`p-5 rounded-3xl border ${
                       insight.type === 'warning' ? 'bg-orange-50 border-orange-100' :
                       insight.type === 'success' ? 'bg-emerald-50 border-emerald-100' :
                       'bg-blue-50 border-blue-100'
                     }`}>
                        <div className="flex items-center gap-2 mb-2">
                           {insight.type === 'warning' ? <AlertTriangle className="w-5 h-5 text-orange-600" /> :
                            insight.type === 'success' ? <CheckCircle className="w-5 h-5 text-emerald-600" /> :
                            <TrendingUp className="w-5 h-5 text-blue-600" />}
                           <h4 className="font-bold text-slate-800 text-sm">{insight.title}</h4>
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed">{insight.description}</p>
                     </div>
                   ))}
                </div>

                {/* Clasificación de Productos */}
                <div className="bg-slate-50 p-6 rounded-4xl">
                   <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4">Portafolio Estratégico</h3>
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-white p-4 rounded-2xl shadow-sm">
                         <p className="text-indigo-600 font-bold text-xs mb-2">PROTAGONISTAS ({analysis?.categorized_items?.protagonists?.length || 0})</p>
                         <div className="space-y-1">
                            {analysis?.categorized_items?.protagonists?.map(id => <p key={id} className="text-[10px] font-mono text-slate-400">#{id}</p>)}
                         </div>
                      </div>
                      <div className="bg-white p-4 rounded-2xl shadow-sm">
                         <p className="text-orange-500 font-bold text-xs mb-2">ESTANCADOS ({analysis?.categorized_items?.stagnant?.length || 0})</p>
                         <div className="space-y-1">
                            {analysis?.categorized_items?.stagnant?.map(id => <p key={id} className="text-[10px] font-mono text-slate-400">#{id}</p>)}
                         </div>
                      </div>
                      <div className="bg-white p-4 rounded-2xl shadow-sm">
                         <p className="text-red-600 font-bold text-xs mb-2">ZOMBIES ({analysis?.categorized_items?.zombies?.length || 0})</p>
                         <div className="space-y-1">
                            {analysis?.categorized_items?.zombies?.map(id => <p key={id} className="text-[10px] font-mono text-slate-400">#{id}</p>)}
                         </div>
                      </div>
                   </div>
                </div>

                {/* Gráficos de Tendencia (Estilo MELI) */}
                <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h3 className="text-xl font-bold text-slate-800">Tendencia de Ventas</h3>
                            <p className="text-xs text-slate-400 font-medium tracking-wide uppercase">Sincronizado con ML Real-Time</p>
                        </div>
                        <div className="flex items-center gap-2">
                             <span className="w-3 h-3 rounded-full bg-indigo-500"></span>
                             <span className="text-[10px] font-bold text-slate-500">VENTAS DIARIAS</span>
                        </div>
                    </div>
                    
                    <div className="h-[250px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData.length > 0 ? chartData : [{date: 'No Data', sales: 0}]}>
                                <defs>
                                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis 
                                    dataKey="date" 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tick={{fontSize: 10, fontWeight: 700, fill: '#64748b'}} 
                                    dy={10}
                                />
                                <YAxis hide />
                                <Tooltip 
                                    contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 700}}
                                />
                                <Area type="monotone" dataKey="sales" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="mt-6 flex items-center justify-around border-t border-slate-50 pt-6">
                         <div className="text-center">
                             <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Total Periodo</p>
                             <p className="text-xl font-black text-slate-800">{chartData.reduce((acc, curr) => acc + curr.sales, 0)}</p>
                         </div>
                         <div className="text-center border-x border-slate-100 px-8">
                             <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Promedio Diario</p>
                             <p className="text-xl font-black text-indigo-600">{(chartData.reduce((acc, curr) => acc + curr.sales, 0) / (chartData.length || 1)).toFixed(1)}</p>
                         </div>
                         <div className="text-center">
                             <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Carga Operativa</p>
                             <p className="text-xl font-black text-emerald-500">MÍNIMA</p>
                         </div>
                    </div>
                </div>

                {/* Chat de Consultoría Estratégica */}
                <div className="bg-slate-900 rounded-[3rem] overflow-hidden shadow-2xl flex flex-col h-[600px] border border-slate-800">
                    <div className="p-6 border-b border-slate-800 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-indigo-500 rounded-2xl flex items-center justify-center">
                                <ShieldCheck className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h3 className="text-white font-bold text-sm">Sala de Consultoría Vanguard</h3>
                                <div className="flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Motor 3.1 Pro Online</span>
                                </div>
                            </div>
                        </div>
                        <button className="text-slate-500 hover:text-white transition-colors">
                            <RefreshCw className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-hide">
                        {messages.map((msg, i) => (
                            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[80%] p-4 rounded-3xl ${
                                    msg.role === 'user' 
                                    ? 'bg-indigo-600 text-white rounded-tr-sm' 
                                    : 'bg-slate-800 text-slate-200 rounded-tl-sm border border-slate-700'
                                }`}>
                                    <p className="text-sm leading-relaxed">{msg.content}</p>
                                </div>
                            </div>
                        ))}
                        {chatLoading && (
                            <div className="flex justify-start">
                                <div className="bg-slate-800 p-4 rounded-3xl rounded-tl-sm border border-slate-700 flex gap-2">
                                    <span className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce"></span>
                                    <span className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                                    <span className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="p-6 bg-slate-800/50 border-t border-slate-800">
                        <div className="relative flex items-center">
                             <input 
                                value={userInput}
                                onChange={(e) => setUserInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                                placeholder="Preguntale algo a Vanguard (ej: '¿Cómo subo las ventas del mate?')"
                                className="w-full bg-slate-900 border-none rounded-2xl p-4 pr-16 text-slate-300 placeholder:text-slate-600 font-medium focus:ring-2 focus:ring-indigo-500 transition-all"
                             />
                             <button 
                                onClick={sendMessage}
                                className="absolute right-2 p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-500 transition-all active:scale-90"
                             >
                                <Send className="w-5 h-5" />
                             </button>
                        </div>
                        <p className="text-[10px] text-center text-slate-500 mt-4 font-bold uppercase tracking-widest">
                            Vanguard tiene acceso a tus costos, stock y métricas reales de MELI
                        </p>
                    </div>
                </div>

                {/* Acciones Recomendadas (Ya existente pero ahora abajo del chat o arriba) */}

                {/* Acciones Recomendadas */}
                <div className="space-y-4">
                   <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                      <Rocket className="w-6 h-6 text-indigo-500" /> Acciones Sugeridas para vos:
                   </h3>
                   {analysis?.recommended_actions?.map((act, idx) => (
                      <div key={idx} className="bg-white p-6 rounded-[2.2rem] border border-slate-100 flex items-center justify-between group hover:shadow-xl hover:border-indigo-200 transition-all duration-300">
                         <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center group-hover:bg-indigo-500 group-hover:text-white transition-colors">
                               <TrendingUp className="w-6 h-6" />
                            </div>
                            <div>
                               <div className="flex items-center gap-2 mb-1">
                                  <span className="text-xs font-black uppercase text-indigo-500">{act.action.replace('_', ' ')}</span>
                                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                                    act.impact === 'alto' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                                  }`}>IMPACTO {act.impact}</span>
                               </div>
                               <p className="font-bold text-slate-800 text-sm">{act.reason}</p>
                               <p className="text-xs text-slate-400 font-mono mt-1">Item ID: {act.item_id}</p>
                            </div>
                         </div>
                         <button 
                            title="Ejecutar o ver más sobre esta acción"
                            className="p-3 bg-slate-50 text-slate-400 rounded-full group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-sm"
                          >
                            <ChevronRight className="w-6 h-6" />
                         </button>
                      </div>
                   ))}
                </div>
                
                {/* Plan Estratégico Largo */}
                <div className="bg-indigo-900 p-8 rounded-[3rem] text-white">
                    <h3 className="font-mono text-indigo-300 text-xs font-black mb-4 uppercase tracking-[0.2em]">Full Strategic Roadmap</h3>
                    <p className="text-lg leading-relaxed font-medium text-indigo-50 opacity-90">{analysis.strategic_plan}</p>
                </div>
             </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MLStrategist;
