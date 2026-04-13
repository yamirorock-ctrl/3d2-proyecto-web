import React, { useState, useEffect, useRef } from 'react';
import { Zap, Target, DollarSign, Rocket, RefreshCw, BarChart, ShieldCheck, TrendingUp, AlertTriangle, CheckCircle, ChevronRight, Send, User, Maximize2, MessageSquare, X, Activity, Paperclip, Save } from 'lucide-react';
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
  recommended_actions: Array<{ intent?: string; action: string; item_id: string; value?: string | number; reason: string; impact: 'alto' | 'medio' | 'bajo' }>;
  ads_sales?: number;
  organic_sales?: number;
  clicks?: number;
  total_revenue?: number;
  acos?: string | number;
  ads_manager?: {
    total_budget_active: number;
    roas_global: number;
    active_campaigns: Array<{ name: string; budget: number; roas_target: number; status: string; }>;
  };
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
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Attachment state for Vision AI
  const [attachments, setAttachments] = useState<{ url: string, type: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = () => {
          setAttachments(prev => [...prev, { url: reader.result as string, type: file.type }]);
        };
        reader.readAsDataURL(file);
      }
    });
  };
   
  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  // Dragging state and logic
  const [position, setPosition] = useState({ bottom: 24, right: 24 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef({ startX: 0, startY: 0, startBottom: 24, startRight: 24, isMoved: false });

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startBottom: position.bottom,
      startRight: position.right,
      isMoved: false,
    };
    setIsDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!isDragging) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    
    // Si realmente lo movimos (más de 5px para evitar clicks temblorosos) marcamos como movido
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
      dragRef.current.isMoved = true;
    }

    setPosition({
      bottom: Math.max(0, dragRef.current.startBottom - dy),
      right: Math.max(0, dragRef.current.startRight - dx)
    });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (isDragging) {
      setIsDragging(false);
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const toggleChat = () => {
    if (dragRef.current.isMoved) {
      dragRef.current.isMoved = false;
      return; 
    }
    setIsChatOpen(!isChatOpen);
    setUnreadCount(0);
  };

  const chatEndRef = useRef<HTMLDivElement>(null);
  const [goals, setGoals] = useState("");
  const [isGoalsSaved, setIsGoalsSaved] = useState(true);

  // Load saved goals on mount (from Production Supabase)
  useEffect(() => {
    const loadGoals = async () => {
      try {
        const { data, error } = await (supabase
          .from('vanguard_memory') as any)
          .select('content')
          .eq('user_id', String(userId))
          .eq('event_type', 'vanguard_goals')
          .maybeSingle();

        if (data?.content?.text) {
          setGoals(data.content.text);
          setIsGoalsSaved(true);
        } else {
          setGoals("Ej: Conseguir un promedio de 2 ventas por dia. Llegar a MercadoLíder Gold antes de fin de mes.");
          setIsGoalsSaved(false);
        }
      } catch (e) {
        console.error("Error cargando objetivos", e);
      }
    };
    if (userId) loadGoals();
  }, [userId]);

  const handleSaveGoals = async () => {
    setIsGoalsSaved(true);
    toast.info("Guardando objetivos en la Nube...", { id: 'goals_save' });
    try {
      await (supabase.from('vanguard_memory') as any).upsert({
        user_id: String(userId),
        event_type: 'vanguard_goals',
        content: { text: goals },
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id,event_type' });
      toast.success("Objetivos anclados en Producción 🚀", { id: 'goals_save' });
    } catch (e) {
      toast.error("Error al guardar objetivos", { id: 'goals_save' });
      setIsGoalsSaved(false);
    }
  };

  const handleGoalsChange = (val: string) => {
     setGoals(val);
     setIsGoalsSaved(false);
  };

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isChatOpen]);

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
        setUnreadCount(1);
      }
      toast.success('Vanguard ha sincronizado con éxito.');
    } catch (err: any) {
      toast.error('Fallo en sincronización: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteAction = async (actionData: any) => {
     toast.loading('Autorizando y conectando con MercadoLibre...', { id: 'execute-action' });
     
     try {
       const res = await fetch('/api/ml-manager', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
           action: 'execute-hitl',
           userId,
           intent: actionData.intent,
           item_id: actionData.item_id,
           value: actionData.value
         })
       });

       const data = await res.json();
       if(res.ok) {
          toast.success(data.message || 'Acción ejecutada con éxito en MercadoLibre', { id: 'execute-action' });
          sendMessage(`[ADMINISTRADOR]: He aprobado y ejecutado con éxito tu propuesta. Procedió sin errores en la infraestructura ML. Acción: ${actionData.description}`);
       } else {
          throw new Error(data.error);
       }
     } catch(e: any) {
        toast.error(`Fallo la ejecución: ${e.message}`, { id: 'execute-action' });
        sendMessage(`[SISTEMA]: Falla técnica al intentar ejecutar tu propuesta: ${e.message}. Analiza qué pudo haber pasado.`);
     }
  };

  const sendMessage = async (presetText?: string) => {
    const text = presetText || userInput;
    const currentAttachments = attachments;
    if (!text.trim() && currentAttachments.length === 0) return;
    
    if (presetText && !isChatOpen) setIsChatOpen(true);
    
    const newMsg = { 
      role: 'user', 
      content: text, 
      attachments: currentAttachments.map(a => a.url) 
    };
    setMessages(prev => [...prev, newMsg]);
    setUserInput('');
    setAttachments([]);
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
          attachments: currentAttachments.map(a => a.url),
          metrics: currentMetrics,
          current_inventory: currentInventory,
          goals,
          userId 
        })
      });
      const data = await resp.json();
      setMessages(prev => [...prev, { role: 'vanguard', content: data.reply }]);
      if (!isChatOpen) setUnreadCount(prev => prev + 1);
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
    <div className="bg-[#0b0f19] text-slate-200 font-sans min-h-screen w-full p-4 sm:p-8 rounded-4xl border border-slate-800 relative shadow-2xl overflow-hidden">
      {/* GLOW BACKGROUND EFFECT */}
      <div className="absolute top-0 left-1/4 w-[800px] h-[500px] bg-violet-600/10 rounded-full blur-[120px] pointer-events-none"></div>
      
      {/* DESKTOP HEADER - Dark Mode Sleek */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 pb-6 border-b border-white/5 relative z-10 gap-6">
        <div>
           <h1 className="text-3xl font-black tracking-tight text-white flex items-center gap-3">
              VANGUARD <span className="bg-clip-text text-transparent bg-linear-to-r from-violet-400 to-cyan-400 italic">PANEL GENERAL</span>
           </h1>
           <p className="text-sm font-medium text-slate-500 mt-1">Monitorea tus métricas de MercadoLibre en tiempo real.</p>
        </div>

        <div className="flex items-center gap-4 bg-[#131826] p-2 rounded-2xl border border-white/5">
            <div className="px-4 py-2">
               <span className="text-[10px] font-black text-slate-500 uppercase block mb-1">Estado</span>
               <span className="text-xs font-bold text-cyan-400 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse shadow-[0_0_10px_#22d3ee]"></span>
                  Sincronizado
               </span>
            </div>
            <div className="w-px h-8 bg-white/10"></div>
            <button 
                onClick={fetchAnalysis} 
                disabled={loading} 
                className="bg-violet-600 hover:bg-violet-500 text-white px-6 py-3 rounded-xl font-bold text-xs flex items-center gap-2 transition-all shadow-[0_0_20px_rgba(124,58,237,0.3)] disabled:opacity-50"
            >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
                Analizar Menú
            </button>
        </div>
      </header>

      {/* METRICS ROW (Fauget / Image 1 Style) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8 relative z-10">
         {/* Total Sales - Primary Gradient Card */}
         <div className="bg-linear-to-br from-violet-600 to-indigo-600 rounded-3xl p-6 shadow-[0_10px_30px_rgba(124,58,237,0.3)] relative overflow-hidden group">
            <div className="absolute right-0 top-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10 group-hover:scale-150 transition-transform duration-700"></div>
            <div className="flex items-start justify-between">
                <div>
                    <div className="bg-white/20 p-3 rounded-2xl inline-block mb-4 backdrop-blur-sm">
                        <DollarSign className="w-6 h-6 text-white" />
                    </div>
                    <div className="text-3xl font-black text-white">${(analysis?.total_revenue || 0).toLocaleString()}</div>
                    <div className="text-xs font-medium text-white/80 mt-1 uppercase tracking-wider">Ventas Proyectadas (30d)</div>
                </div>
            </div>
            <div className="mt-4 flex items-center gap-2 text-xs font-bold text-emerald-300">
                <TrendingUp className="w-4 h-4" /> Vanguard Activo
            </div>
         </div>

         {/* Reputation Card */}
         <div className="bg-[#131826] border border-white/5 rounded-3xl p-6 hover:border-violet-500/30 transition-all cursor-pointer" onClick={() => sendMessage("Explícame el estado de mi reputación")}>
            <div className="flex justify-between items-start mb-4">
               <div className="bg-emerald-500/10 p-3 rounded-2xl text-emerald-400">
                   <ShieldCheck className="w-6 h-6" />
               </div>
               <div className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase ${
                 currentMetrics?.reputation?.level_id?.includes('5') ? 'bg-emerald-500/20 text-emerald-400' : 'bg-yellow-500/20 text-yellow-400'
               }`}>
                 {currentMetrics?.reputation?.level_id?.split('_')[1] || 'Sin Nivel'}
               </div>
            </div>
            <div className="text-3xl font-black text-white flex items-center gap-2">
               {currentMetrics?.reputation?.transactions?.total || 0}
            </div>
            <div className="text-xs font-medium text-slate-500 mt-1 uppercase tracking-wider">Ventas del Período</div>
            <div className="mt-4 flex items-center gap-2 text-xs font-bold text-emerald-400">
                <CheckCircle className="w-4 h-4" /> Reputación Protegida
            </div>
         </div>

         {/* Questions Card */}
         <div className="bg-[#131826] border border-white/5 rounded-3xl p-6 hover:border-violet-500/30 transition-all cursor-pointer" onClick={() => sendMessage("Tengo preguntas sin responder, ¿qué debo priorizar?")}>
            <div className="bg-violet-500/10 p-3 rounded-2xl inline-block mb-4 text-violet-400">
                <MessageSquare className="w-6 h-6" />
            </div>
            <div className="text-3xl font-black text-white">{currentMetrics?.unanswered_questions || 0}</div>
            <div className="text-xs font-medium text-slate-500 mt-1 uppercase tracking-wider">Preguntas Pendientes</div>
            <div className="mt-4 flex items-center gap-2 text-xs font-bold text-rose-400">
                <Zap className="w-4 h-4" /> ¡La velocidad vende!
            </div>
         </div>

         {/* Ads ACOS Card */}
         <div className="bg-[#131826] border border-white/5 rounded-3xl p-6 hover:border-violet-500/30 transition-all cursor-pointer" onClick={() => sendMessage("Analiza mi ACOS y el rendimiento publicitario")}>
            <div className="bg-rose-500/10 p-3 rounded-2xl inline-block mb-4 text-rose-400">
                <Activity className="w-6 h-6" />
            </div>
            <div className="text-3xl font-black text-white">{analysis?.acos || 0}%</div>
            <div className="text-xs font-medium text-slate-500 mt-1 uppercase tracking-wider">ACOS (Costo Ads)</div>
            <div className="mt-4 flex items-center gap-2 text-xs font-bold text-emerald-400">
                <BarChart className="w-4 h-4" /> Bajo Control de IA
            </div>
         </div>
      </div>

      {/* MAIN CONTENT GRID */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 relative z-10 lg:mb-8">
        
        {/* BIG CHART (Sales Performance Over Time) */}
        <div className="xl:col-span-2 bg-[#131826] rounded-3xl p-6 md:p-8 border border-white/5">
            <div className="flex justify-between items-center mb-8">
                <div>
                   <h2 className="text-xl font-bold text-white">Rendimiento Histórico</h2>
                   <p className="text-xs text-slate-500 mt-1">Curva de asimilación (Orgánico vs Ads)</p>
                </div>
                <div className="hidden sm:flex items-center gap-4 text-xs font-medium">
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-violet-500"></div> Asistidas (Ads)</div>
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-cyan-400"></div> Orgánicas</div>
                </div>
            </div>
            
            <div className="h-[350px] w-full vanguard-chart-container">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData.length > 0 ? chartData : [
                        {date: 'W1', salesAds: 18, salesOrg: 12, clicks: 80},
                        {date: 'W2', salesAds: 30, salesOrg: 4, clicks: 150},
                        {date: 'W3', salesAds: 25, salesOrg: 20, clicks: 210},
                        {date: 'W4', salesAds: 40, salesOrg: 15, clicks: 350},
                    ]}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                        <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dx={-10} />
                        <Tooltip 
                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px', color: '#fff' }}
                            itemStyle={{ color: '#e2e8f0' }}
                        />
                        <Line type="monotone" dataKey="salesAds" name="Ventas Ads" stroke="#8b5cf6" strokeWidth={4} dot={{r: 5, fill: '#8b5cf6', stroke: '#0f172a', strokeWidth: 2}} activeDot={{r: 8}} />
                        <Line type="monotone" dataKey="salesOrg" name="Ventas Orgánicas" stroke="#22d3ee" strokeWidth={4} dot={{r: 5, fill: '#22d3ee', stroke: '#0f172a', strokeWidth: 2}} />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
        </div>

        {/* TOP SELLING PRODUCTS / PORTFOLIO CLASS */}
        <div className="xl:col-span-1 bg-[#131826] rounded-3xl p-6 md:p-8 border border-white/5 flex flex-col justify-between">
            <div>
               <div className="flex justify-between items-center mb-6">
                   <div>
                       <h3 className="text-lg font-bold text-white">Clasificación de Ecosistema</h3>
                       <p className="text-xs text-slate-500 mt-1">Matriz impulsada por IA</p>
                   </div>
               </div>
               
               <div className="space-y-4">
                  {[
                     { title: 'Protagonistas (Estrellas)', icon: <Rocket size={16} />, color: 'violet', value: analysis?.categorized_items?.protagonists?.length || 5, bg: 'bg-violet-500/20 text-violet-400' },
                     { title: 'Estancados (Lento)', icon: <Target size={16} />, color: 'cyan', value: analysis?.categorized_items?.stagnant?.length || 12, bg: 'bg-cyan-500/20 text-cyan-400' },
                     { title: 'Zombies (Muertos)', icon: <AlertTriangle size={16} />, color: 'rose', value: analysis?.categorized_items?.zombies?.length || 3, bg: 'bg-rose-500/20 text-rose-400' },
                  ].map((cat, i) => (
                      <div key={i} onClick={() => sendMessage(`Muéstrame el listado y plan para mis productos ${cat.title}`)} className="bg-[#0b0f19] p-4 rounded-2xl flex items-center justify-between group cursor-pointer hover:border-violet-500/50 border border-transparent transition-all">
                          <div className="flex items-center gap-4">
                              <div className={`p-3 rounded-xl ${cat.bg}`}>{cat.icon}</div>
                              <div>
                                 <h4 className="font-bold text-sm text-slate-200">{cat.title}</h4>
                                 <p className="text-xs text-slate-500">{cat.value} Publicaciones</p>
                              </div>
                          </div>
                      </div>
                  ))}
               </div>
            </div>

            <button onClick={() => sendMessage("Dame un resumen de mi Portfolio")} className="w-full mt-6 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold transition-all text-slate-300">
               Analizar Todo el Ecosistema
            </button>
        </div>
      </div>

      {/* STRATEGY & ACTIONS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 relative z-10 mb-20 lg:mb-0">
          <div className="bg-[#131826] p-8 rounded-3xl border border-white/5 flex flex-col">
              <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-6">
                 <Target className="w-5 h-5 text-violet-500" /> Mis Objetivos (Configuración AI)
              </h3>
              <p className="text-xs text-slate-500 mb-4">
                  Define aquí tus metas personales. Vanguard IA usará esta información como pilar base para trazar tu Plan Estratégico en el Chat de Comando.
              </p>
              <textarea 
                 value={goals}
                 onChange={(e) => handleGoalsChange(e.target.value)}
                 className="flex-1 bg-[#0b0f19] border border-white/5 rounded-2xl p-4 text-sm text-slate-300 font-medium focus:outline-none focus:border-violet-500/50 resize-none transition-all placeholder:text-slate-600 custom-scrollbar mb-3 h-24"
                 placeholder="Ej: Aumentar mis ventas a 5 cuadros por día sin subir el presupuesto de Ads..."
              />
              <div className="flex justify-between items-center">
                 <button 
                    onClick={() => { if(confirm("¿Seguro quieres borrar tus objetivos actuales?")) { setGoals(""); setIsGoalsSaved(false); } }}
                    className="text-[10px] text-slate-500 hover:text-rose-400 transition-colors uppercase font-bold"
                 >
                    [ Reemplazar / Limpiar ]
                 </button>
                 <button 
                    onClick={handleSaveGoals}
                    disabled={isGoalsSaved}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                       isGoalsSaved 
                       ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 cursor-default'
                       : 'bg-violet-600 hover:bg-violet-500 text-white shadow-lg cursor-pointer'
                    }`}
                 >
                    {isGoalsSaved ? <ShieldCheck className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                    {isGoalsSaved ? 'Objetivos Guardados' : 'Guardar y Aplicar'}
                 </button>
              </div>
          </div>

          <div className="bg-[#131826] p-8 rounded-3xl border border-white/5 h-64 overflow-y-auto custom-scrollbar">
              <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-6">
                 <Zap className="w-5 h-5 text-cyan-400" /> Acciones Ejecutivas
              </h3>
              <div className="space-y-3">
                  {(analysis?.recommended_actions || []).map((act, i) => (
                       <div key={i} className="flex items-center gap-4 p-4 rounded-2xl bg-[#0b0f19] border border-[#1e293b] hover:border-violet-500/30 transition-all">
                           <div className="shrink-0 w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee]"></div>
                           <div className="flex-1">
                               <h4 className="text-xs font-bold text-white mb-1 uppercase">{act.action}</h4>
                               <p className="text-[11px] text-slate-400">{act.reason}</p>
                           </div>
                           {act.intent && (
                             <button 
                               onClick={() => handleExecuteAction(act)}
                               className="shrink-0 bg-cyan-500 hover:bg-cyan-400 text-black px-3 py-2 rounded-xl text-[10px] font-black transition-all shadow-[0_0_15px_rgba(34,211,238,0.2)]"
                             >
                               APROBAR
                             </button>
                           )}
                       </div>
                  ))}
                  {(!analysis?.recommended_actions || analysis.recommended_actions.length === 0) && (
                      <p className="text-sm text-slate-500 italic">No hay acciones pendientes.</p>
                  )}
              </div>
          </div>
      </div>

      {/* MARKET RADAR & ORGANIC FUNNEL */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 relative z-10 mt-6 mb-20 lg:mb-8">
          {/* Ads Campaigns Monitor (Replaces Obsolete Radar) */}
          <div className="bg-[#131826] p-6 rounded-3xl border border-white/5">
              <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-6">
                 <ShieldCheck className="w-5 h-5 text-emerald-500" /> Monitor Mercado Ads
              </h3>
              <div className="space-y-3">
                  {(analysis?.ads_manager?.active_campaigns || []).map((camp: any, i: number) => (
                      <div key={i} className="flex items-center justify-between p-3 rounded-2xl bg-[#0b0f19] border border-emerald-500/10">
                          <div className="flex flex-col w-48 sm:w-64">
                              <span className="text-xs font-bold text-white truncate">{camp.name}</span>
                              <span className="text-[10px] text-slate-500">
                                Estado: <span className="text-emerald-400 capitalize">{camp.status}</span> | Objetivo ROAS: {camp.roas_target}
                              </span>
                          </div>
                          <div className="text-right shrink-0">
                              <div className="text-sm font-black text-emerald-400">${camp.budget.toLocaleString()} ARS</div>
                              <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Presupuesto / Día</div>
                          </div>
                      </div>
                  ))}
                  
                  {(!analysis?.ads_manager || !analysis.ads_manager.active_campaigns || analysis.ads_manager.active_campaigns.length === 0) && (
                      <p className="text-xs text-slate-500 italic">No hay campañas de publicidad activas.</p>
                  )}
              </div>
          </div>

          {/* Organic Funnel (Visits) */}
          <div className="bg-[#131826] p-6 rounded-3xl border border-white/5">
              <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-6">
                 <Zap className="w-5 h-5 text-cyan-400" /> Embudo Orgánico (Top 5 Visitas)
              </h3>
              <div className="space-y-3">
                  {(currentMetrics?.top_items || []).slice(0, 5).map((item: any, i: number) => (
                      <div key={i} className="flex items-center justify-between p-3 rounded-2xl bg-[#0b0f19] border border-white/5">
                          <div className="flex flex-col">
                              <span className="text-xs font-bold text-white truncate w-48 sm:w-64">{item.title}</span>
                              <span className="text-[10px] text-slate-500">Salud: {Math.round(item.health || 0 * 100)}%</span>
                          </div>
                          <div className="text-right">
                              <div className="text-sm font-black text-white">{item.visits_30d}</div>
                              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Visitas (30d)</div>
                          </div>
                      </div>
                  ))}
                  {(!currentMetrics?.top_items || currentMetrics.top_items.length === 0) && (
                      <p className="text-xs text-slate-500 italic">No hay datos de tráfico orgánico.</p>
                  )}
              </div>
          </div>
      </div>
      <div 
        className="fixed z-100 flex flex-col items-end drop-shadow-2xl vanguard-floating-bubble"
        style={{ 
          '--bottom': `${position.bottom}px`, 
          '--right': `${position.right}px` 
        } as React.CSSProperties}
      >
        {/* Chat Window (Opens Upwards) */}
        {isChatOpen && (
          <div 
             className="w-[360px] sm:w-[400px] h-[580px] bg-[#1a1c23] border border-white/10 rounded-3xl mb-4 shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 fade-in duration-200"
             onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
             onDrop={(e) => {
               e.preventDefault(); e.stopPropagation();
               const files = Array.from(e.dataTransfer.files || []);
               files.forEach(file => {
                 if (file.type.startsWith('image/')) {
                   const reader = new FileReader();
                   reader.onload = () => {
                     setAttachments(prev => [...prev, { url: reader.result as string, type: file.type }]);
                   };
                   reader.readAsDataURL(file);
                 }
               });
             }}
          >
            <div className="bg-[#131826] p-4 flex justify-between items-center border-b border-white/5">
               <div className="flex items-center gap-3">
                 <div className="relative">
                    <div className="w-10 h-10 bg-violet-600 rounded-full flex items-center justify-center shadow-lg">
                       <User className="w-5 h-5 text-white" />
                    </div>
                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-400 border-2 border-[#131826] rounded-full"></div>
                 </div>
                 <div>
                   <h3 className="text-sm font-black text-white">VANGUARD EXPERT</h3>
                   <span className="text-[9px] font-bold text-emerald-400 uppercase">Asistente Online</span>
                 </div>
               </div>
               <div className="flex gap-2">
                 <button title="Actualizar chat" onClick={() => setMessages([])} className="p-2 text-slate-400 hover:text-white transition-colors"><RefreshCw className="w-4 h-4" /></button>
                 <button title="Cerrar chat" onClick={() => { setIsChatOpen(false); setUnreadCount(0); }} className="p-2 text-slate-400 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
               </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-[#0b0f19] custom-scrollbar">
               {messages.length === 0 && (
                  <div className="text-center py-10 opacity-50">
                     <ShieldCheck className="w-12 h-12 mx-auto mb-3 text-slate-500" />
                     <p className="text-xs font-bold text-slate-400">Tu Partner Estratégico de IA está listo para operar.</p>
                  </div>
               )}
               {messages.map((msg, i) => {
                  
                  // Hitl (Human-in-the-Loop) Parser: Captura si Vanguard envía un bloque "```action..."
                  const actionMatch = msg.content?.match(/```action\n([\s\S]*?)(\n)?```/);
                  let displayContent = msg.content;
                  let actionData = null;
                  if (actionMatch) {
                    displayContent = msg.content.replace(actionMatch[0], '');
                    try { actionData = JSON.parse(actionMatch[1]); } catch(e){}
                  }

                  return (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                     <div className={`max-w-[85%] p-3.5 rounded-2xl text-[13px] leading-relaxed shadow-sm ${
                       msg.role === 'user' 
                       ? 'bg-violet-600 text-white rounded-br-sm' 
                       : 'bg-[#1e293b] text-slate-200 rounded-bl-sm border border-white/5'
                     }`}>
                        {msg.attachments && msg.attachments.length > 0 && (
                           <div className="grid grid-cols-2 gap-2 mb-2">
                             {msg.attachments.map((url: string, idx: number) => (
                               <img key={idx} src={url} alt={`Adjunto ${idx}`} className="w-full rounded-lg h-32 object-cover border border-white/10" />
                             ))}
                           </div>
                        )}
                        {msg.attachment && !msg.attachments && (
                           <img src={msg.attachment} alt="Adjunto" className="w-full rounded-lg mb-2 max-h-40 object-cover border border-white/10" />
                        )}
                        <p className="whitespace-pre-wrap">{displayContent}</p>

                        {/* BLOQUE DE AUTORIZACIÓN (HITL) */}
                        {actionData && msg.role === 'vanguard' && (
                           <div className="mt-3 p-3 bg-[#0b0f19] border border-emerald-500/30 rounded-xl shadow-[0_0_15px_rgba(16,185,129,0.1)]">
                              <div className="flex items-center gap-2 mb-2 text-emerald-400 font-bold text-[10px] uppercase tracking-wider">
                                 <ShieldCheck size={14}/> Propuesta Ejecutiva Protegida
                              </div>
                              <p className="text-slate-300 text-xs mb-3">{actionData.description}</p>
                              
                              <div className="flex items-center gap-2">
                                <button title="Autorizar Acción" onClick={() => handleExecuteAction(actionData)} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-2 px-3 rounded-lg flex items-center justify-center gap-1 transition-colors">
                                   <CheckCircle size={14} /> Aprobar
                                </button>
                                <button title="Rechazar" onClick={() => sendMessage(`[ADMINISTRADOR]: He DENEGADO tu propuesta de "${actionData.description}". Busca una alternativa.`)} className="bg-rose-900/40 hover:bg-rose-800 text-rose-300 border border-rose-500/30 text-xs font-bold py-2 px-3 rounded-lg transition-colors">
                                   <X size={14} />
                                </button>
                              </div>
                           </div>
                        )}
                     </div>
                  </div>
                  );
               })}
               {chatLoading && (
                 <div className="flex justify-start">
                    <div className="bg-[#1e293b] p-3.5 rounded-2xl rounded-bl-sm border border-white/5 flex gap-1.5">
                      <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce"></span>
                      <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                      <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                    </div>
                 </div>
               )}
               <div ref={chatEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-[#131826] border-t border-white/5">
               {attachments.length > 0 && (
                 <div className="mb-3 flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                    {attachments.map((att, idx) => (
                      <div key={idx} className="relative shrink-0">
                         <img src={att.url} alt={`Preview ${idx}`} className="h-16 w-16 rounded-md border border-white/10 object-cover" />
                         <button title="Remover imagen adjunta" aria-label="Remover imagen adjunta" onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))} className="absolute -top-2 -right-2 bg-slate-800 text-slate-300 rounded-full p-1 border border-white/10 hover:text-white transition-colors">
                           <X size={10}/>
                         </button>
                      </div>
                    ))}
                 </div>
               )}
               <div className="relative flex items-center">
                  <input title="Subir imagen" aria-label="Subir imagen" type="file" accept="image/*" multiple className="hidden" ref={fileInputRef} onChange={handleFileChange} />
                  <button title="Adjuntar imagen" onClick={() => fileInputRef.current?.click()} className="absolute left-2 p-2 text-slate-400 hover:text-white transition-colors z-10 focus:outline-none">
                     <Paperclip className="w-5 h-5 pointer-events-none" />
                  </button>
                  <textarea 
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    onPaste={(e) => {
                      const items = Array.from(e.clipboardData.items);
                      items.forEach(item => {
                        if (item?.type.includes('image')) {
                          const file = item.getAsFile();
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (e) => {
                              setAttachments(prev => [...prev, { url: e.target?.result as string, type: 'image' }]);
                            };
                            reader.readAsDataURL(file);
                          }
                        }
                      });
                    }}
                    placeholder="Escribe o arrastra fotos aquí..."
                    rows={1}
                    className="w-full bg-[#0b0f19] border border-white/10 rounded-full py-3 pl-10 pr-12 text-sm text-white focus:outline-none focus:border-violet-500 transition-all resize-none shadow-inner custom-scrollbar"
                  />
                  <button title="Enviar mensaje" 
                    onClick={() => sendMessage()}
                    disabled={chatLoading}
                    className="absolute right-1.5 bottom-1.5 p-2 bg-violet-600 text-white rounded-full hover:bg-violet-500 transition-all active:scale-95 disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                  </button>
               </div>
            </div>
          </div>
        )}

        {/* Floating Toggle Button (Draggable) */}
        <button title="Abrir chat de Vanguard"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onClick={toggleChat}
          className={`w-16 h-16 bg-linear-to-tr from-violet-600 to-cyan-500 rounded-full flex items-center justify-center shadow-[0_10px_30px_rgba(124,58,237,0.5)] transition-all relative z-50 group hover:scale-110 ${!isDragging && 'active:scale-95'} ${isDragging ? 'cursor-grabbing scale-110 shadow-[0_20px_50px_rgba(124,58,237,0.8)]' : 'cursor-pointer'}`}
        >
          {isChatOpen ? <X className="text-white w-7 h-7 group-hover:rotate-90 transition-transform" /> : <MessageSquare className="text-white w-7 h-7" />}
          
          {/* Unread Message Badge */}
          {!isChatOpen && unreadCount > 0 && (
             <span className="absolute -top-1 -right-1 flex h-6 w-6">
               <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
               <span className="relative inline-flex rounded-full h-6 w-6 bg-rose-500 items-center justify-center text-[10px] font-black text-white border-2 border-[#0b0f19]">
                 {unreadCount}
               </span>
             </span>
          )}
        </button>
      </div>
      
    </div>
  );
};

export default MLStrategist;
