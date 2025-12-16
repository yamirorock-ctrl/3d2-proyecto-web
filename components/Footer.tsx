import React from "react";
import { Instagram, Facebook, MessageCircle } from "lucide-react";

const Footer: React.FC = () => {
  return (
    <footer className="bg-white border-t border-gray-200 py-12 mt-12">
      <div className="max-w-7xl mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          <div className="text-center md:text-left">
            <h3 className="font-black text-xl text-slate-900 mb-4">3D2</h3>
            <p className="text-slate-500 text-sm max-w-xs mx-auto md:mx-0 mb-6">
              Transformamos filamento y madera en tus ideas favoritas. Calidad y
              detalle en cada impresión.
            </p>
          </div>

          <div className="text-center">
            <h4 className="font-bold text-slate-900 mb-4">Enlaces Rápidos</h4>
            <ul className="space-y-2 text-sm text-slate-500">
              <li>
                <a 
                  href={`https://wa.me/c/${(import.meta.env.VITE_WHATSAPP_NUMBER || "5491171285516").trim()}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-indigo-600 transition-colors"
                >
                  Catálogo
                </a>
              </li>
              <li>
                <a
                  href="https://www.instagram.com/3d2_creart/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-indigo-600 transition-colors"
                  aria-label="Instagram"
                >
                  Instagram
                </a>
              </li>
              <li>
                <a 
                  href={`https://api.whatsapp.com/send?phone=${(import.meta.env.VITE_WHATSAPP_NUMBER || "5491171285516").trim()}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-indigo-600 transition-colors"
                  aria-label="WhatsApp"
                >
                  Contacto
                </a>
              </li>
            </ul>
          </div>

          <div className="text-center md:text-right">
            <h4 className="font-bold text-slate-900 mb-4">Contacto</h4>
            <ul className="space-y-4 text-sm text-slate-500">
              <li className="font-medium text-slate-600">
                Envios a todo el país
              </li>
              <li className="flex justify-center md:justify-end gap-4 pt-2">
                {/* Instagram */}
                <a
                  href="https://www.instagram.com/3d2_creart/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative p-2.5 bg-white rounded-xl shadow-sm border border-slate-100 hover:border-pink-200 hover:shadow-[0_0_15px_-3px_rgba(236,72,153,0.3)] transition-all duration-300"
                  title="Instagram"
                  aria-label="Instagram"
                >
                  <div className="absolute inset-0 bg-pink-50 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <Instagram
                    size={22}
                    className="relative z-10 text-slate-400 group-hover:text-pink-600 transition-colors duration-300"
                  />
                </a>

                {/* Facebook */}
                <a
                  href={(
                    import.meta.env.VITE_FACEBOOK_URL ||
                    "https://www.facebook.com/share/1AfvWg8N66/"
                  ).trim()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative p-2.5 bg-white rounded-xl shadow-sm border border-slate-100 hover:border-blue-200 hover:shadow-[0_0_15px_-3px_rgba(59,130,246,0.3)] transition-all duration-300"
                  title="Facebook"
                  aria-label="Facebook"
                >
                  <div className="absolute inset-0 bg-blue-50 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <Facebook
                    size={22}
                    className="relative z-10 text-slate-400 group-hover:text-blue-600 transition-colors duration-300"
                  />
                </a>

                {/* WhatsApp */}
                <a
                  href={`https://api.whatsapp.com/send?phone=${(
                    import.meta.env.VITE_WHATSAPP_NUMBER || "5491171285516"
                  ).trim()}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative p-2.5 bg-white rounded-xl shadow-sm border border-slate-100 hover:border-green-200 hover:shadow-[0_0_15px_-3px_rgba(34,197,94,0.3)] transition-all duration-300"
                  title="WhatsApp"
                  aria-label="WhatsApp"
                >
                  <div className="absolute inset-0 bg-green-50 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <MessageCircle
                    size={22}
                    className="relative z-10 text-slate-400 group-hover:text-green-600 transition-colors duration-300"
                  />
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-slate-200/60 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
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
