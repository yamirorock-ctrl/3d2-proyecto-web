import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Package, ShoppingCart, Menu, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface NavbarProps {
  cartCount: number;
  onOpenCart: () => void;
  onGoHome: () => void;
  onOpenAdmin?: () => void;
  onRegister?: () => void;
  currentUser?: string | null;
  onLogoutUser?: () => void;
  onCategorySelect?: (category: string) => void;
  onSearch?: (query: string) => void;
}

const Navbar: React.FC<NavbarProps> = ({ cartCount, onOpenCart, onGoHome, onOpenAdmin, onLogoutUser, onCategorySelect, onSearch }) => {
  const { user, isAdmin, logout } = useAuth();
  const displayUser = user ? user.email : null;
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const navigate = useNavigate();
  const ADMIN_SECRET = ((import.meta as any).env?.VITE_ADMIN_SECRET || 'modozen').trim();

  const issueAdminEntry = (secret: string) => {
    const s = (secret || '').trim();
    if (!s) { alert('Secreto requerido'); return; }
    const ts = Date.now();
    const minute = Math.floor(ts / 60000);
    const raw = s + ':' + minute;
    const token = btoa(unescape(encodeURIComponent(raw))).replace(/=+$/,'');
    try {
      sessionStorage.setItem('admin_entry_token', token);
      sessionStorage.setItem('admin_entry_ts', String(ts));
    } catch {}
    window.location.href = '/admin/login';
  };

  return (
    <nav className="sticky top-0 z-40 w-full transition-all duration-500">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-xl border-b border-white/5"></div>
      
      {/* Search Bar Secret Mode Animation */}
      <div className={`absolute top-0 left-0 w-full h-full bg-cyan-500/10 flex items-center justify-center transition-all duration-500 z-50 ${showSearch ? 'opacity-100' : 'opacity-0 pointer-events-none -translate-y-full'}`}>
          <div className="relative w-full max-w-xl mx-4">
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-cyan-400" size={20} />
              <input
                  autoFocus
                  value={search}
                  onChange={(e)=>setSearch(e.target.value)}
                  onKeyDown={(e)=>{
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const s = search.trim().toLowerCase();
                      if ((ADMIN_SECRET && s === ADMIN_SECRET.toLowerCase()) || s === 'modozen') {
                        issueAdminEntry(ADMIN_SECRET || 'modozen');
                      } else {
                        if (search.trim() && onSearch) onSearch(search.trim());
                        setSearch('');
                        setShowSearch(false);
                      }
                    } else if (e.key === 'Escape') {
                      setShowSearch(false);
                    }
                  }}
                  placeholder="BUSCAR EN EL SISTEMA..."
                  className="w-full bg-slate-900/90 border-2 border-cyan-500/50 rounded-2xl py-5 px-16 text-white text-lg font-black tracking-widest uppercase placeholder:text-cyan-500/30 focus:outline-none focus:border-cyan-400 shadow-[0_0_30px_rgba(0,243,255,0.2)]"
                />
                <button onClick={() => setShowSearch(false)} className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors">
                    <X size={20} />
                </button>
          </div>
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-24">
          {/* Logo Section */}
          <div className="flex items-center cursor-pointer group gap-4" onClick={onGoHome}>
            <div className="relative h-12 w-12 flex items-center justify-center shrink-0">
               <div className="absolute -inset-2 bg-linear-to-tr from-cyan-400 via-blue-500 to-magenta-500 rounded-full blur-md opacity-20 group-hover:opacity-60 transition-opacity duration-500"></div>
               <div className="absolute -inset-[2px] rounded-full bg-linear-to-r from-cyan-500 via-blue-600 to-magenta-600 animate-[spin_4s_linear_infinite] opacity-50 group-hover:opacity-100 transition-opacity"></div>
               <div className="relative h-full w-full rounded-full bg-slate-900 z-10 flex items-center justify-center border border-white/10 overflow-hidden">
                  <img src="/LOGO.jpg" alt="3D2 Logo" className="h-full w-full object-contain p-1.5 transition-transform duration-500 group-hover:scale-110" />
               </div>
            </div>
            <div className="flex flex-col justify-center">
              <h1 className="text-2xl font-black tracking-widest text-white leading-none group-hover:glow-cyan transition-all">
                3D<span className="text-cyan-400">2</span>
              </h1>
              <span className="text-[10px] font-black text-slate-500 tracking-[0.2em] uppercase group-hover:text-cyan-500/80 transition-all">
                PRINT & LABS
              </span>
            </div>
          </div>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center space-x-10 text-[11px] font-black uppercase tracking-[0.15em]">
            <button onClick={()=>{onGoHome(); onCategorySelect?.('Destacados');}} className="text-slate-400 hover:text-cyan-400 transition-all relative group/link">INICIO<span className="absolute -bottom-1 left-0 w-0 h-[2px] bg-cyan-500 transition-all group-hover/link:w-full"></span></button>
            <button onClick={()=>{onGoHome(); onCategorySelect?.('3D');}} className="text-slate-400 hover:text-cyan-400 transition-all relative group/link">3D PRINT<span className="absolute -bottom-1 left-0 w-0 h-[2px] bg-cyan-500 transition-all group-hover/link:w-full"></span></button>
            <button onClick={()=>{onGoHome(); onCategorySelect?.('Láser');}} className="text-slate-400 hover:text-cyan-400 transition-all relative group/link">LASER CUT<span className="absolute -bottom-1 left-0 w-0 h-[2px] bg-cyan-500 transition-all group-hover/link:w-full"></span></button>
            <button onClick={()=>{onGoHome(); onCategorySelect?.('Personalizados');}} className="text-magenta-400 hover:text-magenta-300 transition-all relative group/link">CUSTOM<span className="absolute -bottom-1 left-0 w-0 h-[2px] bg-magenta-500 transition-all group-hover/link:w-full shadow-[0_0_10px_rgba(255,0,255,0.5)]"></span></button>
            <button type="button" onClick={()=>setShowSearch(s=>!s)} className="p-2 text-slate-400 hover:text-cyan-400 transition-all" title="Búsqueda de Datos"><Search size={18} /></button>
            {displayUser && (
              <div className="flex items-center gap-4 border-l border-white/10 pl-6">
                <span className="font-mono text-cyan-500/70 lowercase">{displayUser}</span>
                <button onClick={() => { logout(); if(onLogoutUser) onLogoutUser(); }} className="text-slate-500 hover:text-red-400 transition-colors uppercase text-[9px]">X DISCONNECT</button>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-4">
            {onOpenAdmin && isAdmin && (
              <button onClick={onOpenAdmin} className="hidden md:inline-flex items-center gap-2 px-4 py-2 bg-amber-500/10 text-amber-500 border border-amber-500/30 rounded-lg hover:bg-amber-500/20 transition-all text-[10px] font-black uppercase tracking-widest">CORE ACCESS</button>
            )}
            <button onClick={() => navigate('/order-tracking')} className="hidden md:inline-flex items-center gap-2 px-4 py-2 bg-white/5 text-slate-300 border border-white/10 rounded-lg hover:bg-white/10 transition-all text-[10px] font-black uppercase tracking-widest group">
              <Package size={16} className="group-hover:text-cyan-400" /><span>STATUS</span>
            </button>
            <button onClick={onOpenCart} className="relative p-3 bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 rounded-xl hover:bg-cyan-500/20 hover:shadow-[0_0_15px_rgba(0,243,255,0.2)] transition-all group">
              <ShoppingCart size={22} strokeWidth={2.5} className="group-hover:scale-110 transition-transform" />
              {cartCount > 0 && <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center bg-magenta-500 text-white text-[10px] font-black rounded-sm shadow-[0_0_10px_rgba(255,0,255,0.5)]">{cartCount}</span>}
            </button>
            <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="md:hidden p-2 text-white bg-white/5 rounded-lg border border-white/10"><Menu size={24} /></button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setIsMobileMenuOpen(false)} />
          <div className="absolute inset-y-0 right-0 w-[80%] max-sm bg-slate-900 shadow-2xl flex flex-col h-full animate-fade-in border-l border-white/10">
             <div className="flex items-center justify-between p-6 border-b border-white/10 bg-black/20">
                <h2 className="text-sm font-black text-cyan-500 uppercase tracking-widest">Navegación</h2>
                <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 text-slate-500 hover:text-white transition-colors"><X size={24} /></button>
             </div>
             <div className="p-6 border-b border-white/5">
               <div className="relative flex items-center bg-white/5 rounded-xl border border-white/10 focus-within:border-cyan-500 transition-all">
                  <Search size={18} className="absolute left-4 text-slate-500" />
                  <input placeholder="BUSCAR..." value={search} onChange={(e)=>setSearch(e.target.value)} onKeyDown={(e)=>{if (e.key === 'Enter') {e.preventDefault(); const s = search.trim().toLowerCase(); if ((ADMIN_SECRET && s === ADMIN_SECRET.toLowerCase()) || s === 'modozen') {issueAdminEntry(ADMIN_SECRET || 'modozen'); return;} if (search.trim() && onSearch) onSearch(search.trim()); setSearch(''); setIsMobileMenuOpen(false);}}} className="w-full bg-transparent pl-12 pr-4 py-4 text-sm text-white outline-none placeholder:text-slate-600 font-bold uppercase tracking-widest" />
               </div>
             </div>
             <div className="flex-1 overflow-y-auto p-6 space-y-2">
                <button onClick={() => { onGoHome(); onCategorySelect?.('Destacados'); setIsMobileMenuOpen(false); }} className="w-full text-left px-5 py-4 text-slate-300 hover:bg-cyan-500/10 hover:text-cyan-400 rounded-xl transition-all font-black uppercase tracking-widest text-[11px] flex items-center gap-4 border border-transparent hover:border-cyan-500/20"><span className="w-1 h-1 rounded-full bg-cyan-500 shadow-[0_0_10px_rgba(0,243,255,1)]"></span>INICIO</button>
                <button onClick={() => { onGoHome(); onCategorySelect?.('3D'); setIsMobileMenuOpen(false); }} className="w-full text-left px-5 py-4 text-slate-300 hover:bg-white/5 hover:text-white rounded-xl transition-all font-black uppercase tracking-widest text-[11px] flex items-center gap-4 border border-transparent hover:border-white/10"><span className="w-1 h-1 rounded-full bg-slate-500"></span>3D PRINT</button>
                <button onClick={() => { onGoHome(); onCategorySelect?.('Láser'); setIsMobileMenuOpen(false); }} className="w-full text-left px-5 py-4 text-slate-300 hover:bg-white/5 hover:text-white rounded-xl transition-all font-black uppercase tracking-widest text-[11px] flex items-center gap-4 border border-transparent hover:border-white/10"><span className="w-1 h-1 rounded-full bg-slate-500"></span>LASER CUT</button>
                <button onClick={() => { onGoHome(); onCategorySelect?.('Personalizados'); setIsMobileMenuOpen(false); }} className="w-full text-left px-5 py-4 text-magenta-400 hover:bg-magenta-500/10 hover:text-magenta-300 rounded-xl transition-all font-black uppercase tracking-widest text-[11px] flex items-center gap-4 border border-transparent hover:border-magenta-500/20"><span className="w-1 h-1 rounded-full bg-magenta-500 shadow-[0_0_10px_rgba(255,0,255,1)]"></span>CUSTOM</button>
                {displayUser && (
                  <div className="mt-10 pt-10 border-t border-white/5">
                     <div className="px-5 mb-4"><span className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em]">IDENTIFICACIÓN</span></div>
                     <div className="px-5 py-3 text-xs text-cyan-500/80 bg-cyan-500/5 rounded-lg border border-cyan-500/10 mb-4 font-mono truncate">{displayUser}</div>
                      <button onClick={() => { logout(); setIsMobileMenuOpen(false); }} className="w-full text-left px-5 py-4 text-red-500 hover:bg-red-500/10 rounded-xl transition-all font-black uppercase tracking-widest text-[10px] flex items-center gap-3">DESCONECTAR</button>
                  </div>
                )}
                {onOpenAdmin && isAdmin && (
                  <div className="mt-4 pt-4 border-t border-white/5">
                    <button onClick={() => { onOpenAdmin(); setIsMobileMenuOpen(false); }} className="w-full text-left px-5 py-4 bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 rounded-xl transition-all font-black uppercase tracking-widest text-[10px] flex items-center gap-3 border border-amber-500/20">CORE ACCESS 🔒</button>
                  </div>
                )}
             </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;