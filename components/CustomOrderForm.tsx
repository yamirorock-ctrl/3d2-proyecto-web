import React, { useState } from 'react';
import { Send } from 'lucide-react';
import { sendCustomOrderEmail } from '../services/emailService';

interface Props {
  onSubmit: (order: CustomOrder) => void;
}

export interface CustomOrder {
  id: number;
  name: string;
  email: string;
  phone: string;
  description: string;
  technology: '3D' | 'Láser' | 'Ambas';
  timestamp: Date;
  status: 'pendiente' | 'contactado' | 'completado';
}

const CustomOrderForm: React.FC<Props> = ({ onSubmit }) => {
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    description: '',
    technology: '3D' as '3D' | 'Láser' | 'Ambas'
  });
  
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!form.name || !form.email || !form.description) {
      alert('Por favor completa todos los campos obligatorios');
      return;
    }

    const order: CustomOrder = {
      id: Date.now(),
      ...form,
      timestamp: new Date(),
      status: 'pendiente'
    };

    onSubmit(order);
    setSubmitted(true);
    
    // Reset form after 3 seconds
    setTimeout(() => {
      setForm({
        name: '',
        email: '',
        phone: '',
        description: '',
        technology: '3D'
      });
      setSubmitted(false);
    }, 3000);
  };

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto p-8 bg-green-50 border-2 border-green-500 rounded-2xl text-center animate-fade-in">
        <div className="w-16 h-16 bg-green-500 text-white rounded-full flex items-center justify-center mx-auto mb-4">
          <Send size={32} />
        </div>
        <h3 className="text-2xl font-bold text-green-900 mb-2">¡Solicitud Enviada!</h3>
        <p className="text-green-700">Nos pondremos en contacto contigo pronto para discutir tu proyecto personalizado.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-8 bg-white rounded-2xl shadow-xl">
      <div className="text-center mb-6">
        <h2 className="text-3xl font-bold text-slate-900 mb-2">Diseño Personalizado</h2>
        <p className="text-slate-600">Cuéntanos qué necesitas y crearemos algo único para ti</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-2">
            Nombre completo <span className="text-red-500">*</span>
          </label>
          <input
            id="name"
            type="text"
            value={form.name}
            onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
            className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            placeholder="Tu nombre"
            required
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-2">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => setForm(prev => ({ ...prev, email: e.target.value }))}
              className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="tu@email.com"
              required
            />
          </div>

          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-slate-700 mb-2">
              Teléfono
            </label>
            <input
              id="phone"
              type="tel"
              value={form.phone}
              onChange={(e) => setForm(prev => ({ ...prev, phone: e.target.value }))}
              className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="+54 9 11 1234-5678"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Tecnología preferida
          </label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="technology"
                value="3D"
                checked={form.technology === '3D'}
                onChange={(e) => setForm(prev => ({ ...prev, technology: '3D' }))}
                className="text-indigo-600"
              />
              <span className="text-sm">Impresión 3D</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="technology"
                value="Láser"
                checked={form.technology === 'Láser'}
                onChange={(e) => setForm(prev => ({ ...prev, technology: 'Láser' }))}
                className="text-indigo-600"
              />
              <span className="text-sm">Corte Láser</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="technology"
                value="Ambas"
                checked={form.technology === 'Ambas'}
                onChange={(e) => setForm(prev => ({ ...prev, technology: 'Ambas' }))}
                className="text-indigo-600"
              />
              <span className="text-sm">Ambas</span>
            </label>
          </div>
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-slate-700 mb-2">
            Describe tu proyecto <span className="text-red-500">*</span>
          </label>
          <textarea
            id="description"
            value={form.description}
            onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
            className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent min-h-[150px]"
            placeholder="Cuéntanos qué quieres crear: dimensiones, materiales, colores, cantidad, uso previsto, etc."
            required
          />
          <p className="text-sm text-slate-500 mt-1">
            Incluye todos los detalles que consideres importantes para tu proyecto
          </p>
        </div>

        <button
          type="submit"
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-4 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <Send size={20} />
          Enviar Solicitud
        </button>

        <p className="text-xs text-center text-slate-500">
          Te responderemos en menos de 24 horas con un presupuesto personalizado
        </p>
      </form>
    </div>
  );
};

export default CustomOrderForm;
