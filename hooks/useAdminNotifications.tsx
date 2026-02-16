
import { useEffect } from 'react';
import { supabase } from '../services/supabaseService';
import { toast } from 'sonner';
import { ShoppingBag, MessageCircle, AlertTriangle } from 'lucide-react';

export const useAdminNotifications = () => {
  useEffect(() => {
    console.log('🔔 Iniciando sistema de notificaciones en tiempo real para Admin...');

    // Pedir permiso para notificaciones nativas (Sistema Operativo)
    if ('Notification' in window && Notification.permission !== 'granted') {
      Notification.requestPermission();
    }

    const showNativeNotification = (title: string, body: string, icon?: string) => {
      if ('Notification' in window && Notification.permission === 'granted') {
        const notif = new Notification(title, {
          body,
          icon: icon || '/favicon.ico', // Asegúrate de tener un favicon o logo
          // requireInteraction: true // Para que se quede fija hasta que la cierres (opcional)
        });
        notif.onclick = () => {
          window.focus();
          // window.location.hash = '#orders'; // Opcional: navegar a la sección
        };
      }
    };

    // 1. Suscripción a Nuevas Ventas (Orders)
    const ordersChannel = supabase
      .channel('admin-orders')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders' },
        (payload) => {
          console.log('💰 Nueva orden recibida:', payload.new);
          const order = payload.new;
          
          // Toast interno (Sonner)
          toast.success(`Nueva Venta: #${order.id.slice(0, 8)}`, {
            description: `Monto: $${order.total} - ${order.customer_name || 'Cliente Web'}`,
            icon: <ShoppingBag className="text-emerald-600" />,
            duration: 8000,
          });

          // Notificación Nativa (Windows/Mac)
          showNativeNotification(
            '💰 ¡Nueva Venta 3D2!', 
            `Monto: $${order.total} - ${order.customer_name || 'Cliente Web'}`
          );
          
          // Sonido (opcional, necesita interacción previa del usuario)
          // new Audio('/sounds/cash.mp3').play().catch(() => {}); 
        }
      )
      .subscribe();

    // 2. Suscripción a Nuevas Preguntas (ML Questions & Web Questions)
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
           
           // Toast interno
           toast.info('Nueva Pregunta MercadoLibre', {
             description: `"${q.question}"`,
             icon: <MessageCircle className="text-blue-600" />,
             duration: 10000,
           });

           // Notificación Nativa
           showNativeNotification(
             '💬 Pregunta MercadoLibre',
             q.question
           );
        }
      )
      .subscribe();
      
    return () => {
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(questionsChannel);
    };
  }, []);
};
