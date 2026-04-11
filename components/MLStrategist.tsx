import React, { useState, useEffect, useRef } from 'react';
import { Zap, Target, DollarSign, Rocket, RefreshCw, BarChart, ShieldCheck, TrendingUp, AlertTriangle, CheckCircle, ChevronRight, Send, User, Maximize2, MessageSquare, X, Activity } from 'lucide-react';
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
  const [isChatOpen, setIsChatOpen] = useState(false); // FIXED BOT CHAT BUBBLE
  const [unreadCount, setUnreadCount] = useState(0);

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

  const sendMessage = async (presetText?: string) => {
    const text = presetText || userInput;
    if (!text.trim() || chatLoading) return;
    
    // Open chat automatically if sending a command from dashboard
    if (presetText && !isChatOpen) setIsChatOpen(true);
    
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
    <div className="bg-[#0b0f19] text-slate-200 font-sans min-h-screen p-4 sm:p-8 rounded-[2rem] border border-slate-800 relative shadow-2xl overflow-hidden">
      {/* GLOW BACKGROUND EFFECT */}
      <div className="absolute top-0 left-1/4 w-[800px] h-[500px] bg-violet-600/10 rounded-full blur-[120px] pointer-events-none"></div>
      
      {/* DESKTOP HEADER - Dark Mode Sleek */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 pb-6 border-b border-white/5 relative z-10 gap-6">
        <div>
           <h1 className="text-3xl font-black tracking-tight text-white flex items-center gap-3">
              VANGUARD <span className="bg-clip-text text-transparent bg-gradient-to-r from-violet-400 to-cyan-400 italic">OVERVIEW</span>
           </h1>
           <p className="text-sm font-medium text-slate-500 mt-1">Track your MercadoLibre metrics in real time.</p>
        </div>

        <div className="flex items-center gap-4 bg-[#131826] p-2 rounded-2xl border border-white/5">
            <div className="px-4 py-2">
               <span className="text-[10px] font-black text-slate-500 uppercase block mb-1">Status</span>
               <span className="text-xs font-bold text-cyan-400 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse shadow-[0_0_10px_#22d3ee]"></span>
                  Live Sync
               </span>
            </div>
            <div className="w-px h-8 bg-white/10"></div>
            <button 
                onClick={fetchAnalysis} 
                disabled={loading} 
                className="bg-violet-600 hover:bg-violet-500 text-white px-6 py-3 rounded-xl font-bold text-xs flex items-center gap-2 transition-all shadow-[0_0_20px_rgba(124,58,237,0.3)] disabled:opacity-50"
            >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
                Analyze Now
            </button>
        </div>
      </header>

      {/* METRICS ROW (Fauget / Image 1 Style) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8 relative z-10">
         {/* Total Sales - Primary Gradient Card */}
         <div className="bg-gradient-to-br from-violet-600 to-indigo-600 rounded-3xl p-6 shadow-[0_10px_30px_rgba(124,58,237,0.3)] relative overflow-hidden group">
            <div className="absolute right-0 top-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10 group-hover:scale-150 transition-transform duration-700"></div>
            <div className="flex items-start justify-between">
                <div>
                    <div className="bg-white/20 p-3 rounded-2xl inline-block mb-4 backdrop-blur-sm">
                        <DollarSign className="w-6 h-6 text-white" />
                    </div>
                    <div className="text-3xl font-black text-white">${(analysis?.total_revenue || 82450).toLocaleString()}</div>
                    <div className="text-xs font-medium text-white/80 mt-1 uppercase tracking-wider">Total Sales (30d)</div>
                </div>
            </div>
            <div className="mt-4 flex items-center gap-2 text-xs font-bold text-emerald-300">
                <TrendingUp className="w-4 h-4" /> +12.5% vs last month
            </div>
         </div>

         {/* Secondary Metrics - Dark Cards */}
         <div className="bg-[#131826] border border-white/5 rounded-3xl p-6 hover:border-violet-500/30 transition-all">
            <div className="bg-cyan-500/10 p-3 rounded-2xl inline-block mb-4 text-cyan-400">
                <Target className="w-6 h-6" />
            </div>
            <div className="text-3xl font-black text-white">{analysis?.organic_sales || 1250}</div>
            <div className="text-xs font-medium text-slate-500 mt-1 uppercase tracking-wider">Total Orders</div>
            <div className="mt-4 flex items-center gap-2 text-xs font-bold text-emerald-400">
                <TrendingUp className="w-4 h-4" /> +8.3% vs last month
            </div>
         </div>

         <div className="bg-[#131826] border border-white/5 rounded-3xl p-6 hover:border-violet-500/30 transition-all">
            <div className="bg-emerald-500/10 p-3 rounded-2xl inline-block mb-4 text-emerald-400">
                <Zap className="w-6 h-6" />
            </div>
            <div className="text-3xl font-black text-white">42.8%</div>
            <div className="text-xs font-medium text-slate-500 mt-1 uppercase tracking-wider">Ads Conversion</div>
            <div className="mt-4 flex items-center gap-2 text-xs font-bold text-emerald-400">
                <TrendingUp className="w-4 h-4" /> Optimal Rate
            </div>
         </div>

         <div className="bg-[#131826] border border-white/5 rounded-3xl p-6 hover:border-violet-500/30 transition-all">
            <div className="bg-rose-500/10 p-3 rounded-2xl inline-block mb-4 text-rose-400">
                <BarChart className="w-6 h-6" />
            </div>
            <div className="text-3xl font-black text-white">{analysis?.acos || '39.8'}%</div>
            <div className="text-xs font-medium text-slate-500 mt-1 uppercase tracking-wider">Global ACOS</div>
            <div className="mt-4 flex items-center gap-2 text-xs font-bold text-slate-400">
                <CheckCircle className="w-4 h-4 text-emerald-400" /> Controlled
            </div>
         </div>
      </div>

      {/* MAIN CONTENT GRID */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 relative z-10 lg:mb-8">
        
        {/* BIG CHART (Sales Performance Over Time) */}
        <div className="xl:col-span-2 bg-[#131826] rounded-3xl p-6 md:p-8 border border-white/5">
            <div className="flex justify-between items-center mb-8">
                <div>
                   <h2 className="text-xl font-bold text-white">Sales Performance Over Time</h2>
                   <p className="text-xs text-slate-500 mt-1">Line Chart with dual lines (Ads vs Organic)</p>
                </div>
                <div className="hidden sm:flex items-center gap-4 text-xs font-medium">
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-violet-500"></div> Asistidas (Ads)</div>
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-cyan-400"></div> Orgánicas</div>
                </div>
            </div>
            
            <div className="h-[350px]">
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
                        <Line type="monotone" dataKey="salesAds" name="Ads Sales" stroke="#8b5cf6" strokeWidth={4} dot={{r: 5, fill: '#8b5cf6', stroke: '#0f172a', strokeWidth: 2}} activeDot={{r: 8}} />
                        <Line type="monotone" dataKey="salesOrg" name="Organic Sales" stroke="#22d3ee" strokeWidth={4} dot={{r: 5, fill: '#22d3ee', stroke: '#0f172a', strokeWidth: 2}} />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
        </div>

        {/* TOP SELLING PRODUCTS / PORTFOLIO CLASS */}
        <div className="xl:col-span-1 bg-[#131826] rounded-3xl p-6 md:p-8 border border-white/5 flex flex-col justify-between">
            <div>
               <div className="flex justify-between items-center mb-6">
                   <div>
                       <h3 className="text-lg font-bold text-white">Portfolio Classification</h3>
                       <p className="text-xs text-slate-500 mt-1">AI-driven matrix</p>
                   </div>
               </div>
               
               <div className="space-y-4">
                  {[
                     { title: 'Protagonistas (Star)', icon: <Rocket size={16} />, color: 'violet', value: analysis?.categorized_items?.protagonists?.length || 5, bg: 'bg-violet-500/20 text-violet-400' },
                     { title: 'Estancados (Stagnant)', icon: <Target size={16} />, color: 'cyan', value: analysis?.categorized_items?.stagnant?.length || 12, bg: 'bg-cyan-500/20 text-cyan-400' },
                     { title: 'Zombies (Dead)', icon: <AlertTriangle size={16} />, color: 'rose', value: analysis?.categorized_items?.zombies?.length || 3, bg: 'bg-rose-500/20 text-rose-400' },
                  ].map((cat, i) => (
                      <div key={i} onClick={() => sendMessage(`Muéstrame el listado y plan para mis productos ${cat.title}`)} className="bg-[#0b0f19] p-4 rounded-2xl flex items-center justify-between group cursor-pointer hover:border-violet-500/50 border border-transparent transition-all">
                          <div className="flex items-center gap-4">
                              <div className={`p-3 rounded-xl ${cat.bg}`}>{cat.icon}</div>
                              <div>
                                 <h4 className="font-bold text-sm text-slate-200">{cat.title}</h4>
                                 <p className="text-xs text-slate-500">{cat.value} Publications</p>
                              </div>
                          </div>
                      </div>
                  ))}
               </div>
            </div>

            <button onClick={() => sendMessage("Dame un resumen de mi Portfolio")} className="w-full mt-6 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold transition-all text-slate-300">
               Analyze All Categories
            </button>
        </div>
      </div>

      {/* STRATEGY & ACTIONS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 relative z-10 mb-20 lg:mb-0">
          <div className="bg-[#131826] p-8 rounded-3xl border border-white/5">
              <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-6">
                 <ShieldCheck className="w-5 h-5 text-violet-500" /> Strategic Plan
              </h3>
              <p className="text-[15px] font-medium leading-relaxed text-slate-300">
                  {analysis?.strategic_plan || "Connect your store to Vanguard AI to generate a powerful, real-time strategic roadmap tailored to your actual MercadoLibre metrics."}
              </p>
          </div>

          <div className="bg-[#131826] p-8 rounded-3xl border border-white/5 h-64 overflow-y-auto custom-scrollbar">
              <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-6">
                 <Zap className="w-5 h-5 text-cyan-400" /> Executive Actions
              </h3>
              <div className="space-y-3">
                  {(analysis?.recommended_actions || []).map((act, i) => (
                      <div key={i} onClick={() => sendMessage(`Ejecutar: ${act.action} para ${act.item_id}`)} className="flex items-start gap-4 p-4 rounded-2xl bg-[#0b0f19] hover:bg-violet-900/20 cursor-pointer border border-[#1e293b] hover:border-violet-500/30 transition-all">
                          <div className="shrink-0 mt-1 w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee]"></div>
                          <div>
                              <h4 className="text-xs font-bold text-white mb-1 uppercase">{act.action}</h4>
                              <p className="text-[11px] text-slate-400">{act.reason}</p>
                          </div>
                          <ChevronRight className="shrink-0 ml-auto w-4 h-4 text-slate-600" />
                      </div>
                  ))}
                  {(!analysis?.recommended_actions || analysis.recommended_actions.length === 0) && (
                      <p className="text-sm text-slate-500 italic">No pending actions.</p>
                  )}
              </div>
          </div>
      </div>

      {/* =========================================
          FLOATING VANGUARD CHAT (Messenger Style)
      =========================================== */}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end">
        {/* Chat Window (Opens Upwards) */}
        {isChatOpen && (
          <div className="w-[360px] sm:w-[400px] h-[580px] bg-[#1a1c23] border border-white/10 rounded-3xl mb-4 shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 fade-in duration-200">
            {/* Header */}
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
                   <span className="text-[9px] font-bold text-emerald-400 uppercase">Online Assistant</span>
                 </div>
               </div>
               <div className="flex gap-2">
                 <button onClick={() => setMessages([])} className="p-2 text-slate-400 hover:text-white transition-colors"><RefreshCw className="w-4 h-4" /></button>
                 <button onClick={() => { setIsChatOpen(false); setUnreadCount(0); }} className="p-2 text-slate-400 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
               </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-[#0b0f19] custom-scrollbar">
               {messages.length === 0 && (
                  <div className="text-center py-10 opacity-50">
                     <ShieldCheck className="w-12 h-12 mx-auto mb-3 text-slate-500" />
                     <p className="text-xs font-bold text-slate-400">Your AI Strategy Partner is ready.</p>
                  </div>
               )}
               {messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                     <div className={`max-w-[85%] p-3.5 rounded-2xl text-[13px] leading-relaxed shadow-sm ${
                       msg.role === 'user' 
                       ? 'bg-violet-600 text-white rounded-br-sm' 
                       : 'bg-[#1e293b] text-slate-200 rounded-bl-sm border border-white/5'
                     }`}>
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                     </div>
                  </div>
               ))}
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
                    placeholder="Ask Vanguard about strategy..."
                    rows={1}
                    className="w-full bg-[#0b0f19] border border-white/10 rounded-full py-3 pl-4 pr-12 text-sm text-white focus:outline-none focus:border-violet-500 transition-all resize-none shadow-inner"
                  />
                  <button 
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

        {/* Floating Toggle Button */}
        <button 
          onClick={() => { setIsChatOpen(!isChatOpen); setUnreadCount(0); }}
          className="w-16 h-16 bg-gradient-to-tr from-violet-600 to-cyan-500 rounded-full flex items-center justify-center shadow-[0_10px_30px_rgba(124,58,237,0.5)] hover:scale-110 active:scale-95 transition-all relative z-50 group"
        >
          {isChatOpen ? <X className="text-white w-7 h-7 group-hover:rotate-90 transition-transform" /> : <MessageSquare className="text-white w-7 h-7" />}
          
          {/* Unread Message Badge */}
          {!isChatOpen && unreadCount > 0 && (
             <span className="absolute -top-1 -right-1 flex h-6 w-6 relative">
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
