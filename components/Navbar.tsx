import React from 'react';
import { ShoppingCart, Menu } from 'lucide-react';

interface NavbarProps {
  cartCount: number;
  onOpenCart: () => void;
  onGoHome: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ cartCount, onOpenCart, onGoHome }) => {
  // PLACEHOLDER: Replace this URL with the link to your specific logo image
  const logoUrl = "https://placehold.co/200x200/ffffff/0f172a?text=3D2";

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
            <div className="relative h-16 w-16 flex items-center justify-center flex-shrink-0">
               {/* Static Glow Layer (Background Blur) */}
               <div className="absolute -inset-2 bg-gradient-to-tr from-cyan-400 via-indigo-500 to-purple-600 rounded-full blur-md opacity-40 group-hover:opacity-75 transition-opacity duration-500"></div>
               
               {/* Spinning Neon Border Layer */}
               <div className="absolute -inset-[2px] rounded-full bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 animate-[spin_3s_linear_infinite]"></div>
               
               {/* Inner Circle with Image */}
               <div className="relative h-full w-full rounded-full bg-white z-10 flex items-center justify-center border-[2px] border-white overflow-hidden">
                  <img 
                    src={logoUrl} 
                    alt="3D2 Logo" 
                    className="h-full w-full object-contain p-1"
                  />
               </div>
            </div>

            <div className="flex flex-col justify-center">
              <h1 className="text-2xl font-black tracking-wider text-slate-900 leading-none group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-indigo-600 group-hover:to-purple-600 transition-all">
                3D2
              </h1>
              <span className="text-xs font-semibold text-indigo-600 tracking-widest uppercase">
                Print & Laser
              </span>
            </div>
          </div>

          {/* Desktop Menu */}
          <div className="hidden md:flex space-x-8 text-sm font-medium text-slate-600">
            <button onClick={onGoHome} className="hover:text-indigo-600 transition-colors">Inicio</button>
            <button className="hover:text-indigo-600 transition-colors">Impresión 3D</button>
            <button className="hover:text-indigo-600 transition-colors">Corte Láser</button>
            <button className="hover:text-indigo-600 transition-colors">Personalizados</button>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-4">
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
            <button className="md:hidden p-2 text-slate-900">
              <Menu size={24} />
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;