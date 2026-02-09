import React, { useState, useMemo } from 'react';
import { Order } from '../types';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Truck, User } from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';

interface Props {
  orders: Order[];
  onSelectOrder?: (order: Order) => void;
}

export const DeliveryCalendar: React.FC<Props> = ({ orders, onSelectOrder }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());

  // Helper to parse delivery date from notes
  const parseDeliveryDate = (notes?: string): Date | null => {
    if (!notes) return null;
    const match = notes.match(/\[ENTREGA: (\d{1,2})\/(\d{1,2})\/(\d{4})\]/);
    if (match) {
      const [_, day, month, year] = match;
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }
    return null;
  };

  const deliveries = useMemo(() => {
    return orders.filter(o => {
        // Filter out completed/cancelled if desired, but user wants to see scheduled deliveries
        return o.status !== 'cancelled'; 
    }).map(o => ({
      ...o,
      deliveryDate: parseDeliveryDate(o.notes)
    })).filter(o => o.deliveryDate !== null);
  }, [orders]);

  const daysInMonth = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { locale: es });
    const end = endOfWeek(endOfMonth(currentMonth), { locale: es });
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

  const selectedDayDeliveries = useMemo(() => {
    if (!selectedDate) return [];
    return deliveries.filter(d => d.deliveryDate && isSameDay(d.deliveryDate, selectedDate));
  }, [selectedDate, deliveries]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col md:flex-row h-[600px]">
      {/* Calendar Grid */}
      <div className="flex-1 p-4 border-r border-slate-100 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <CalendarIcon className="text-indigo-600" />
            Agenda de Entregas
          </h2>
          <div className="flex items-center gap-2">
            <button onClick={prevMonth} className="p-1 hover:bg-slate-100 rounded-full"><ChevronLeft size={20} /></button>
            <span className="font-medium text-slate-700 min-w-[140px] text-center capitalize">
              {format(currentMonth, 'MMMM yyyy', { locale: es })}
            </span>
            <button onClick={nextMonth} className="p-1 hover:bg-slate-100 rounded-full"><ChevronRight size={20} /></button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-2">
          {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(day => (
            <div key={day} className="text-center text-xs font-semibold text-slate-400 uppercase">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1 flex-1 auto-rows-fr">
          {daysInMonth.map(day => {
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isToday = isSameDay(day, new Date());
            const isSelected = selectedDate && isSameDay(day, selectedDate);
            
            const dayDeliveries = deliveries.filter(d => d.deliveryDate && isSameDay(d.deliveryDate, day));
            const hasDeliveries = dayDeliveries.length > 0;

            return (
              <button
                key={day.toISOString()}
                onClick={() => setSelectedDate(day)}
                className={`
                  relative flex flex-col items-center justify-start py-2 rounded-lg transition-all
                  ${!isCurrentMonth ? 'text-slate-300 bg-slate-50/50' : 'text-slate-700 hover:bg-slate-50'}
                  ${isSelected ? 'ring-2 ring-indigo-500 bg-indigo-50 z-10' : ''}
                  ${isToday && !isSelected ? 'bg-indigo-50 font-bold text-indigo-700' : ''}
                `}
              >
                <span className={`text-sm ${isToday ? 'bg-indigo-600 text-white w-6 h-6 rounded-full flex items-center justify-center -mt-1' : ''}`}>
                  {format(day, 'd')}
                </span>
                
                {hasDeliveries && (
                  <div className="mt-1 flex flex-col gap-0.5 w-full px-1">
                     <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1 rounded-sm truncate w-full text-center font-medium">
                        {dayDeliveries.length} {dayDeliveries.length === 1 ? 'entrega' : 'entregas'}
                     </span>
                     {/* Preview names if space permits or just dots */}
                     <div className="flex gap-0.5 justify-center mt-0.5">
                       {dayDeliveries.slice(0, 3).map((_, i) => (
                         <div key={i} className="w-1 h-1 rounded-full bg-emerald-500" />
                       ))}
                     </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Detail Panel */}
      <div className="w-full md:w-80 bg-slate-50 p-4 overflow-y-auto border-l border-slate-200">
        <h3 className="font-bold text-slate-800 mb-4 flex items-center justify-between">
          <span>{selectedDate ? format(selectedDate, 'EEEE d, MMMM', { locale: es }) : 'Selecciona un día'}</span>
          {selectedDayDeliveries.length > 0 && (
             <span className="bg-emerald-100 text-emerald-800 text-xs px-2 py-0.5 rounded-full">
               {selectedDayDeliveries.length}
             </span>
          )}
        </h3>

        <div className="space-y-3">
          {selectedDayDeliveries.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <Truck size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No hay entregas programadas</p>
            </div>
          ) : (
            selectedDayDeliveries.map((order) => (
              <div 
                key={order.id} 
                onClick={() => onSelectOrder && onSelectOrder(order)}
                className="bg-white p-3 rounded-lg shadow-xs border border-slate-200 hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer group"
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="font-bold text-slate-800 text-sm group-hover:text-indigo-600">
                     #{order.id.slice(0, 6)}
                  </div>
                  <div className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                    order.status === 'completed' ? 'bg-green-100 text-green-700' : 
                    order.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {order.status}
                  </div>
                </div>
                
                <div className="flex items-center gap-2 mb-2 text-sm text-slate-600">
                  <User size={14} className="text-slate-400" />
                  <span className="truncate">{(order as any).customer_name || 'Cliente'}</span>
                </div>

                <div className="text-xs text-slate-500 mb-2 line-clamp-2">
                  {order.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}
                </div>

                {/* Parse debt info again specifically for this view if needed, but dashboard shows it better */}
                <div className="flex items-center justify-end text-xs font-bold text-emerald-600">
                   {/* Maybe extract amount here? */}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
