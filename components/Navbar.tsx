import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Package } from 'lucide-react';
import { ShoppingCart, Menu, X } from 'lucide-react';
import SmartImage from './SmartImage';
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
  onSearch?: (query: string) => void; // búsqueda de productos
}

const Navbar: React.FC<NavbarProps> = ({ cartCount, onOpenCart, onGoHome, onOpenAdmin, onRegister, onLogoutUser, onCategorySelect, onSearch }) => {
  const { user, isAdmin, logout } = useAuth();
  // Use context user if available, otherwise fallback to prop or null.
  // Actually, we should rely on context.
  const displayUser = user ? user.email : null; // or null if we want to rely on props. But migrating to context is better.

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const navigate = useNavigate();
  // Leer el secreto desde env; fallback a 'modozen' si falta
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
    // Forzamos la redirección real para evitar problemas de ruteo
    window.location.href = '/admin/login';
  };
  // Logo local servido desde /public respetando la base de Vite
  // Usar logo JPG absoluto desde /public
  const logoUrl = `/LOGO.jpg`;

  return (
    <nav className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur-md border-b border-gray-100 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-24">
          {/* Logo Section */}
          <div 
            className="flex items-center cursor-pointer group gap-4" 
            onClick={onGoHome}
          >
            {/* Logo Container with Neon Effect */}
            <div className="relative h-12 w-12 flex items-center justify-center shrink-0">
               {/* Static Glow Layer (Background Blur) */}
               <div className="absolute -inset-2 bg-linear-to-tr from-cyan-400 via-indigo-500 to-purple-600 rounded-full blur-md opacity-40 group-hover:opacity-75 transition-opacity duration-500"></div>
               
               {/* Spinning Neon Border Layer */}
               <div className="absolute -inset-[2px] rounded-full bg-linear-to-r from-cyan-400 via-blue-500 to-purple-600 animate-[spin_3s_linear_infinite]"></div>
               
               {/* Inner Circle with Image */}
               <div className="relative h-full w-full rounded-full bg-white z-10 flex items-center justify-center border-2 border-white overflow-hidden">
                  <img 
                    src="/LOGO.jpg" 
                    alt="3D2 Logo" 
                    className="h-full w-full object-contain p-1"
                  />
               </div>
            </div>

            <div className="flex flex-col justify-center">
              <h1 className="text-2xl font-black tracking-wider text-slate-900 leading-none group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-linear-to-r group-hover:from-indigo-600 group-hover:to-purple-600 transition-all">
                3D2
              </h1>
              <span className="text-xs font-semibold text-indigo-600 tracking-widest uppercase">
                Print & Laser
              </span>
            </div>
          </div>

          {/* Desktop Menu */}
          <div className="hidden md:flex space-x-8 text-sm font-medium text-slate-600">
            <button onClick={()=>{onGoHome(); onCategorySelect?.('Destacados');}} className="hover:text-indigo-600 transition-colors">Inicio</button>
            <button onClick={()=>{onGoHome(); onCategorySelect?.('3D');}} className="hover:text-indigo-600 transition-colors">Impresión 3D</button>
            <button onClick={()=>{onGoHome(); onCategorySelect?.('Láser');}} className="hover:text-indigo-600 transition-colors">Corte Láser</button>
            <button onClick={()=>{onGoHome(); onCategorySelect?.('Personalizados');}} className="hover:text-indigo-600 transition-colors">Personalizados</button>
            {/* Icono de búsqueda secreto */}
            <div className="relative flex items-center">
              <button
                type="button"
                onClick={()=>setShowSearch(s=>!s)}
                className="p-2 rounded-md hover:bg-slate-100 transition-colors"
                title="Buscar"
                aria-label="Buscar productos"
              >
                <Search size={18} className="text-slate-600" />
              </button>
              {showSearch && (
                <input
                  autoFocus
                  value={search}
                  onChange={(e)=>setSearch(e.target.value)}
                  // onBlur={()=>{ if(!search) setShowSearch(false); }}
                  onKeyDown={(e)=>{
                    if (e.key === 'Enter') {
                      e.preventDefault(); // Evitar submit
                      const s = search.trim().toLowerCase();
                      if ((ADMIN_SECRET && s === ADMIN_SECRET.toLowerCase()) || s === 'modozen') {
                        console.log('Modo Zen activado');
                        issueAdminEntry(ADMIN_SECRET || 'modozen');
                        setSearch('');
                        setShowSearch(false);
                      } else {
                        if (search.trim() && onSearch) {
                          onSearch(search.trim());
                        }
                        setSearch('');
                        setShowSearch(false);
                      }
                    } else if (e.key === 'Escape') {
                      setShowSearch(false);
                    }
                  }}
                  placeholder="Buscar..."
                  className="ml-2 rounded-md border border-gray-200 px-3 py-2 text-sm w-44 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              )}
            </div>
            {displayUser && (
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-slate-700">Hola, {displayUser}</span>
                <button onClick={() => { logout(); if(onLogoutUser) onLogoutUser(); }} className="text-sm text-slate-500">Cerrar</button>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-4">
            {onOpenAdmin && isAdmin && (
              <button onClick={onOpenAdmin} title="Admin" className="hidden md:inline-flex items-center gap-2 px-3 py-2 bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100">
                Admin
              </button>
            )}
            <button
              onClick={() => navigate('/order-tracking')}
              title="Seguir Pedido"
              className="hidden md:inline-flex items-center gap-2 px-3 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <Package size={18} />
              <span className="text-sm">Seguir Pedido</span>
            </button>
            <button
              onClick={onOpenCart}
              className="relative p-2 text-slate-900 hover:bg-slate-100 rounded-full transition-all group"
            >
              <ShoppingCart size={24} strokeWidth={2} className="group-hover:text-indigo-600 transition-colors" />
              {cartCount > 0 && (
                <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/4 -translate-y-1/4 bg-indigo-600 rounded-full shadow-sm">
                  {cartCount}
                </span>
              )}
            </button>
            <button 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <Menu size={24} />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          
          {/* Sidebar */}
          <div className="absolute inset-y-0 right-0 w-[80%] max-w-sm bg-white shadow-2xl flex flex-col h-full animate-fade-in">
             {/* Header */}
             <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-slate-50/50">
                <h2 className="text-lg font-bold text-slate-900">Navegación</h2>
                <button 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-2 hover:bg-red-50 hover:text-red-600 rounded-full transition-colors"
                  aria-label="Cerrar menú"
                >
                  <X size={24} />
                </button>
             </div>

             {/* Search */}
             <div className="p-4 border-b border-gray-100">
               <div className="relative flex items-center bg-gray-50 rounded-lg border border-gray-200 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500 transition-all">
                  <Search size={18} className="absolute left-3 text-slate-400" />
                  <input
                    placeholder="Buscar productos..."
                    value={search}
                    onChange={(e)=>setSearch(e.target.value)}
                    onKeyDown={(e)=>{
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        // Secret Admin Entry
                        const s = search.trim().toLowerCase();
                        if ((ADMIN_SECRET && s === ADMIN_SECRET.toLowerCase()) || s === 'modozen') {
                          const ts = Date.now();
                          const minute = Math.floor(ts / 60000);
                          const raw = ADMIN_SECRET + ':' + minute;
                          const token = btoa(unescape(encodeURIComponent(raw))).replace(/=+$/,'');
                          try {
                            sessionStorage.setItem('admin_entry_token', token);
                            sessionStorage.setItem('admin_entry_ts', String(ts));
                          } catch {}
                          window.location.href = '/admin/login'; // Force reload/redirect
                          setSearch('');
                          setIsMobileMenuOpen(false);
                          return;
                        }
                        
                        if (search.trim() && onSearch) {
                          onSearch(search.trim());
                        }
                        setSearch('');
                        setIsMobileMenuOpen(false);
                      }
                    }}
                    className="w-full bg-transparent pl-10 pr-4 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400"
                  />
               </div>
             </div>

             {/* Links */}
             <div className="flex-1 overflow-y-auto p-4 space-y-1">
                <button 
                   onClick={() => { onGoHome(); onCategorySelect?.('Destacados'); setIsMobileMenuOpen(false); }}
                   className="w-full text-left px-4 py-3.5 text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 rounded-xl transition-all font-medium flex items-center gap-3"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                  Inicio
                </button>
                <button 
                   onClick={() => { onGoHome(); onCategorySelect?.('3D'); setIsMobileMenuOpen(false); }}
                   className="w-full text-left px-4 py-3.5 text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 rounded-xl transition-all font-medium flex items-center gap-3"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-300"></span>
                  Impresión 3D
                </button>
                <button 
                   onClick={() => { onGoHome(); onCategorySelect?.('Láser'); setIsMobileMenuOpen(false); }}
                   className="w-full text-left px-4 py-3.5 text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 rounded-xl transition-all font-medium flex items-center gap-3"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-300"></span>
                  Corte Láser
                </button>
                <button 
                   onClick={() => { onGoHome(); onCategorySelect?.('Personalizados'); setIsMobileMenuOpen(false); }}
                   className="w-full text-left px-4 py-3.5 text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 rounded-xl transition-all font-medium flex items-center gap-3"
                >
                   <span className="w-1.5 h-1.5 rounded-full bg-pink-300"></span>
                  Personalizados
                </button>

                {displayUser && (
                  <div className="mt-6 pt-6 border-t border-gray-100">
                     <div className="px-4 mb-2">
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Cuenta</span>
                     </div>
                     <div className="px-4 py-2 text-sm text-slate-900 bg-slate-50 rounded-lg mx-2 border border-slate-100 mb-2">
                        {displayUser}
                     </div>
                      <button 
                         onClick={() => { logout(); if(onLogoutUser) onLogoutUser(); setIsMobileMenuOpen(false); }}
                         className="w-full text-left px-4 py-3 text-red-600 hover:bg-red-50 rounded-xl transition-all font-medium flex items-center gap-2"
                       >
                         Cerrar Sesión
                       </button>
                  </div>
                )}
                
                 {onOpenAdmin && isAdmin && (
                   <div className="mt-4 pt-4 border-t border-gray-100">
                     <button 
                       onClick={() => { onOpenAdmin(); setIsMobileMenuOpen(false); }}
                       className="w-full text-left px-4 py-3 bg-amber-50 text-amber-800 hover:bg-amber-100 rounded-xl transition-all font-bold flex items-center gap-2"
                     >
                       Panel Admin 🔒
                     </button>
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