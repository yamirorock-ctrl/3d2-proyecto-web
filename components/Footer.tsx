import React from "react";
import { Instagram, Facebook, MessageCircle } from "lucide-react";

const Footer: React.FC = () => {
  return (
    <footer className="bg-black/40 border-t border-white/5 py-16 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute bottom-0 right-0 w-64 h-64 bg-cyan-500/5 blur-[100px] rounded-full pointer-events-none"></div>
      
      <div className="max-w-7xl mx-auto px-4 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-12">
          <div className="text-center md:text-left">
            <h3 className="font-black text-2xl text-white mb-4 glow-cyan">3D<span className="text-cyan-400">2</span></h3>
            <p className="text-slate-500 text-sm max-w-xs mx-auto md:mx-0 mb-6 font-medium leading-relaxed">
              Fusión de ingeniería y creatividad. Evolucionamos la manufactura digital capa por capa.
            </p>
          </div>

          <div className="text-center">
            <h4 className="text-xs font-black text-white uppercase tracking-[0.3em] mb-6">Navegación</h4>
            <ul className="space-y-3 text-[11px] font-bold text-slate-500 uppercase tracking-widest">
              <li>
                <a href="#" className="hover:text-cyan-400 transition-all hover:tracking-[0.4em]">
                  Catálogo
                </a>
              </li>
              <li>
                <a
                  href="https://www.instagram.com/3d2_creart/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-cyan-400 transition-all hover:tracking-[0.4em]"
                >
                  Instagram
                </a>
              </li>
              <li>
                <a 
                  href={`https://api.whatsapp.com/send?phone=${(import.meta.env.VITE_WHATSAPP_NUMBER || "5491171285516").trim()}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-cyan-400 transition-all hover:tracking-[0.4em]"
                >
                  Contacto
                </a>
              </li>
            </ul>
          </div>

          <div className="text-center md:text-right">
            <h4 className="text-xs font-black text-white uppercase tracking-[0.3em] mb-6">Conexión Social</h4>
            <div className="flex justify-center md:justify-end gap-5">
                {/* Instagram */}
                <a
                  href="https://www.instagram.com/3d2_creart/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative p-3 bg-white/5 rounded-xl border border-white/10 hover:border-magenta-500/50 hover:shadow-[0_0_20px_rgba(255,0,255,0.2)] transition-all duration-300"
                  title="Instagram"
                >
                  <Instagram
                    size={20}
                    className="text-slate-400 group-hover:text-magenta-400 transition-colors"
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
                  className="group relative p-3 bg-white/5 rounded-xl border border-white/10 hover:border-blue-500/50 hover:shadow-[0_0_20px_rgba(59,130,246,0.2)] transition-all duration-300"
                  title="Facebook"
                >
                  <Facebook
                    size={20}
                    className="text-slate-400 group-hover:text-blue-400 transition-colors"
                  />
                </a>

                {/* WhatsApp */}
                <a
                  href={`https://api.whatsapp.com/send?phone=${(
                    import.meta.env.VITE_WHATSAPP_NUMBER || "5491171285516"
                  ).trim()}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative p-3 bg-white/5 rounded-xl border border-white/10 hover:border-cyan-500/50 hover:shadow-[0_0_20px_rgba(0,243,255,0.2)] transition-all duration-300"
                  title="WhatsApp"
                >
                  <MessageCircle
                    size={20}
                    className="text-slate-400 group-hover:text-cyan-400 transition-colors"
                  />
                </a>
            </div>
            <p className="mt-6 text-[10px] font-mono text-slate-600 uppercase tracking-widest">
                ENVIOS A TODO EL PAÍS // SISTEMA DE ENVÍO: ACTIVO
            </p>
          </div>
        </div>

        <div className="border-t border-white/5 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">
            © {new Date().getFullYear()} 3D2_LABS. TODOS LOS DERECHOS RESERVADOS.
          </p>
          <div className="text-[9px] font-mono text-cyan-500/40 uppercase tracking-widest">
            v2.6.0 // PROTOCOLO POR: CREART
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
