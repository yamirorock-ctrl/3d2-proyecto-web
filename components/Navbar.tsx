import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Package } from 'lucide-react';
import { ShoppingCart, Menu, X } from 'lucide-react';
import SmartImage from './SmartImage';
import { isAuthenticated } from '../utils/auth';

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

const Navbar: React.FC<NavbarProps> = ({ cartCount, onOpenCart, onGoHome, onOpenAdmin, onRegister, currentUser, onLogoutUser, onCategorySelect, onSearch }) => {
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
    navigate('/admin/login');
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
              >
                <Search size={18} className="text-slate-600" />
              </button>
              {showSearch && (
                <input
                  autoFocus
                  value={search}
                  onChange={(e)=>setSearch(e.target.value)}
                  onBlur={()=>{ if(!search) setShowSearch(false); }}
                  onKeyDown={(e)=>{
                    if (e.key === 'Enter') {
                      if (ADMIN_SECRET && search.trim() === ADMIN_SECRET) {
                        issueAdminEntry(ADMIN_SECRET);
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
            {currentUser && (
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-slate-700">Hola, {currentUser}</span>
                <button onClick={onLogoutUser} className="text-sm text-slate-500">Cerrar</button>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-4">
            {onOpenAdmin && isAuthenticated() && (
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
        <>
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div className="fixed inset-y-0 right-0 w-72 bg-white shadow-2xl z-50 md:hidden transform transition-transform duration-300 ease-in-out">
            <div className="flex flex-col h-full">
              {/* Mobile Menu Header */}
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <h2 className="text-lg font-bold text-slate-900">Menú</h2>
                <button 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              {/* Barra de búsqueda móvil (incluye secreto) */}
              <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-2">
                <Search size={18} className="text-slate-600" />
                <input
                  placeholder="Buscar productos..."
                  value={search}
                  onChange={(e)=>setSearch(e.target.value)}
                  onKeyDown={(e)=>{
                    if (e.key === 'Enter') {
                      if (ADMIN_SECRET && search.trim() === ADMIN_SECRET) {
                        const ts = Date.now();
                        const minute = Math.floor(ts / 60000);
                        const raw = ADMIN_SECRET + ':' + minute;
                        const token = btoa(unescape(encodeURIComponent(raw))).replace(/=+$/,'');
                        try {
                          sessionStorage.setItem('admin_entry_token', token);
                          sessionStorage.setItem('admin_entry_ts', String(ts));
                        } catch {}
                        navigate('/admin/login');
                        setSearch('');
                        setIsMobileMenuOpen(false);
                      } else {
                        if (search.trim() && onSearch) {
                          onSearch(search.trim());
                        }
                        setSearch('');
                      }
                    }
                    if (e.key === 'Escape') {
                      setSearch('');
                    }
                  }}
                  className="flex-1 rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Mobile Menu Content */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                <button 
                  onClick={() => { onGoHome(); onCategorySelect?.('Destacados'); setIsMobileMenuOpen(false); }}
                  className="w-full text-left px-4 py-3 text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg transition-colors font-medium"
                >
                  Inicio
                </button>
                <button 
                  onClick={() => { onGoHome(); onCategorySelect?.('3D'); setIsMobileMenuOpen(false); }}
                  className="w-full text-left px-4 py-3 text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg transition-colors font-medium"
                >
                  Impresión 3D
                </button>
                <button 
                  onClick={() => { onGoHome(); onCategorySelect?.('Láser'); setIsMobileMenuOpen(false); }}
                  className="w-full text-left px-4 py-3 text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg transition-colors font-medium"
                >
                  Corte Láser
                </button>
                <button 
                  onClick={() => { onGoHome(); onCategorySelect?.('Personalizados'); setIsMobileMenuOpen(false); }}
                  className="w-full text-left px-4 py-3 text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg transition-colors font-medium"
                >
                  Personalizados
                </button>

                <div className="border-t border-gray-200 my-4" />

                {currentUser && (
                  <div className="space-y-2">
                    <div className="px-4 py-2 bg-indigo-50 rounded-lg">
                      <p className="text-xs text-slate-500">Conectado como</p>
                      <p className="font-medium text-slate-900">{currentUser}</p>
                    </div>
                    {onLogoutUser && (
                      <button 
                        onClick={() => { onLogoutUser(); setIsMobileMenuOpen(false); }}
                        className="w-full text-left px-4 py-3 bg-red-50 text-red-700 hover:bg-red-100 rounded-lg transition-colors font-medium"
                      >
                        Cerrar Sesión
                      </button>
                    )}
                  </div>
                )}

                {onOpenAdmin && isAuthenticated() && (
                  <>
                    <div className="border-t border-gray-200 my-4" />
                    <button 
                      onClick={() => { onOpenAdmin(); setIsMobileMenuOpen(false); }}
                      className="w-full text-left px-4 py-3 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-lg transition-colors font-medium"
                    >
                      Panel Admin
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </nav>
  );
};

export default Navbar;