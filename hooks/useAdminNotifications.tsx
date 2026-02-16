
import { useEffect } from 'react';
import { supabase } from '../services/supabaseService';
import { toast } from 'sonner';
import { ShoppingBag, MessageCircle, AlertTriangle } from 'lucide-react';

export const useAdminNotifications = () => {
  useEffect(() => {
    console.log('🔔 Iniciando sistema de notificaciones en tiempo real para Admin...');

    // 1. Suscripción a Nuevas Ventas (Orders)
    const ordersChannel = supabase
      .channel('admin-orders')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders' },
        (payload) => {
          console.log('💰 Nueva orden recibida:', payload.new);
          const order = payload.new;
          toast.success(`Nueva Venta: #${order.id.slice(0, 8)}`, {
            description: `Monto: $${order.total} - ${order.customer_name || 'Cliente Web'}`,
            icon: <ShoppingBag className="text-emerald-600" />,
            duration: 8000,
          });
          // Reproducir sonido si se desea
          // new Audio('/sounds/cash.mp3').play().catch(() => {}); 
        }
      )
      .subscribe();

    // 2. Suscripción a Nuevas Preguntas (ML Questions & Web Questions)
    // Asumiendo que las preguntas de ML se guardan en 'ml_questions' o 'questions'
    // Revisar esquema: usas 'ml_questions' para preguntas de MercadoLibre?
    const questionsChannel = supabase
      .channel('admin-questions')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'ml_questions' },
        (payload) => {
           // Ignorar si es una respuesta del sistema
           if (payload.new.status === 'answered') return;

           console.log('💬 Nueva pregunta ML:', payload.new);
           const q = payload.new;
           toast.info('Nueva Pregunta MercadoLibre', {
             description: `"${q.question}"`,
             icon: <MessageCircle className="text-blue-600" />,
             duration: 10000,
             action: {
                label: 'Ver',
                onClick: () => window.location.hash = '#ai-monitor' // Redirigir si se puede
             }
           });
        }
      )
      .subscribe();
      
      // 3. Suscripción a Errores Críticos (System Logs si existiera tabla, o AI Logs)
      // Opcional: Escuchar updates en 'ai_logs' donde status sea 'error'
      
    return () => {
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(questionsChannel);
    };
  }, []);
};
