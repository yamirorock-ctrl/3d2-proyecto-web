import React from 'react';

const Footer: React.FC = () => {
  return (
    <footer className="bg-white border-t border-gray-200 py-12 mt-12">
      <div className="max-w-7xl mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          <div className="text-center md:text-left">
            <h3 className="font-black text-xl text-slate-900 mb-4">3D2</h3>
            <p className="text-slate-500 text-sm max-w-xs mx-auto md:mx-0 mb-6">
              Transformamos filamento y madera en tus ideas favoritas. Calidad y detalle en cada impresión.
            </p>
          </div>
          
          <div className="text-center">
            <h4 className="font-bold text-slate-900 mb-4">Enlaces Rápidos</h4>
            <ul className="space-y-2 text-sm text-slate-500">
              <li><a href="#" className="hover:text-indigo-600 transition-colors">Catálogo</a></li>
              <li>
                <a 
                  href="https://www.instagram.com/3d2_creart/" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="hover:text-indigo-600 transition-colors"
                >
                  Instagram
                </a>
              </li>
              <li><a href="#" className="hover:text-indigo-600 transition-colors">Contacto</a></li>
            </ul>
          </div>
          
          <div className="text-center md:text-right">
            <h4 className="font-bold text-slate-900 mb-4">Contacto</h4>
            <ul className="space-y-2 text-sm text-slate-500">
              <li>Envios a todo el país</li>
              <li>Retiro en punto de venta</li>
              <li>3d2.ventas@gmail.com</li>
            </ul>
          </div>
        </div>
        
        <div className="border-t border-gray-100 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs text-slate-400">
            © {new Date().getFullYear()} 3D2 - Impresión 3D & Corte Láser
          </p>
          <div className="flex gap-4">
             {/* Icons would go here if imported */}
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
