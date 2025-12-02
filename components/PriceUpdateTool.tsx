import React, { useState, useMemo } from 'react';
import { Product } from '../types';
import { DollarSign, Percent, TrendingUp, AlertTriangle, X } from 'lucide-react';

interface Props {
  products: Product[];
  onUpdatePrices: (updatedProducts: Product[]) => void;
  onClose: () => void;
}

type AdjustMode = 'percentage' | 'fixed';
type FilterMode = 'all' | 'category' | 'selected';

const PriceUpdateTool: React.FC<Props> = ({ products, onUpdatePrices, onClose }) => {
  const [adjustMode, setAdjustMode] = useState<AdjustMode>('percentage');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [adjustValue, setAdjustValue] = useState<string>('');
  const [showPreview, setShowPreview] = useState(false);

  const categories = useMemo(() => {
    const cats = new Set(products.map(p => p.category));
    return Array.from(cats).filter(Boolean);
  }, [products]);

  const affectedProducts = useMemo(() => {
    switch (filterMode) {
      case 'all':
        return products;
      case 'category':
        return products.filter(p => p.category === selectedCategory);
      case 'selected':
        return products.filter(p => selectedIds.has(p.id));
      default:
        return [];
    }
  }, [filterMode, products, selectedCategory, selectedIds]);

  const previewProducts = useMemo(() => {
    if (!adjustValue || isNaN(Number(adjustValue))) return affectedProducts;

    const value = Number(adjustValue);
    return affectedProducts.map(p => {
      let newPrice = p.price;
      if (adjustMode === 'percentage') {
        newPrice = p.price * (1 + value / 100);
      } else {
        newPrice = p.price + value;
      }
      // Redondear a 2 decimales y no permitir negativos
      newPrice = Math.max(0, Math.round(newPrice * 100) / 100);
      return { ...p, price: newPrice };
    });
  }, [affectedProducts, adjustValue, adjustMode]);

  const handleToggleProduct = (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const handleApplyChanges = () => {
    if (!adjustValue || isNaN(Number(adjustValue))) {
      alert('Ingresa un valor numérico válido.');
      return;
    }

    if (affectedProducts.length === 0) {
      alert('No hay productos seleccionados para actualizar.');
      return;
    }

    if (!confirm(`¿Aplicar cambios de precio a ${affectedProducts.length} producto(s)?`)) return;

    const affectedIds = new Set(affectedProducts.map(p => p.id));
    const updated = products.map(p => {
      if (affectedIds.has(p.id)) {
        const preview = previewProducts.find(pp => pp.id === p.id);
        return preview || p;
      }
      return p;
    });

    onUpdatePrices(updated);
    alert('Precios actualizados correctamente.');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[95vw] sm:max-w-2xl lg:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-4 sm:p-6 text-white flex items-center justify-between">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
              <DollarSign size={24} className="hidden sm:block" />
              <DollarSign size={20} className="sm:hidden" />
              Actualizar Precios
            </h2>
            <p className="text-xs sm:text-sm opacity-90 mt-1">Ajusta precios de forma rápida</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Configuración */}
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 overflow-y-auto flex-1">
          {/* Modo de ajuste */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Tipo de Ajuste</label>
            <div className="flex gap-3">
              <button
                onClick={() => setAdjustMode('percentage')}
                className={`flex-1 p-4 rounded-xl border-2 transition-all ${
                  adjustMode === 'percentage'
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                    : 'border-gray-200 bg-white text-slate-600 hover:border-gray-300'
                }`}
              >
                <Percent className="mx-auto mb-2" size={24} />
                <p className="font-medium">Porcentaje</p>
                <p className="text-xs opacity-70 mt-1">Aumentar/reducir %</p>
              </button>
              <button
                onClick={() => setAdjustMode('fixed')}
                className={`flex-1 p-4 rounded-xl border-2 transition-all ${
                  adjustMode === 'fixed'
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                    : 'border-gray-200 bg-white text-slate-600 hover:border-gray-300'
                }`}
              >
                <DollarSign className="mx-auto mb-2" size={24} />
                <p className="font-medium">Monto Fijo</p>
                <p className="text-xs opacity-70 mt-1">Sumar/restar $</p>
              </button>
            </div>
          </div>

          {/* Valor de ajuste */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              {adjustMode === 'percentage' ? 'Porcentaje' : 'Monto'} de Ajuste
            </label>
            <div className="relative">
              <input
                type="number"
                value={adjustValue}
                onChange={(e) => setAdjustValue(e.target.value)}
                placeholder={adjustMode === 'percentage' ? 'ej: 10 (aumenta 10%)' : 'ej: 5.50 (suma $5.50)'}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-600 focus:outline-none"
                step="0.01"
              />
              {adjustMode === 'percentage' && (
                <Percent className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              )}
            </div>
            <p className="text-xs text-slate-500 mt-2">
              {adjustMode === 'percentage' 
                ? 'Valores negativos reducen el precio (ej: -15 para descontar 15%)'
                : 'Valores negativos restan del precio (ej: -10 para descontar $10)'}
            </p>
          </div>

          {/* Filtro de productos */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Aplicar a</label>
            <div className="flex gap-2 mb-3">
              <button
                onClick={() => setFilterMode('all')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  filterMode === 'all'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-slate-600 hover:bg-gray-200'
                }`}
              >
                Todos ({products.length})
              </button>
              <button
                onClick={() => setFilterMode('category')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  filterMode === 'category'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-slate-600 hover:bg-gray-200'
                }`}
              >
                Por Categoría
              </button>
              <button
                onClick={() => setFilterMode('selected')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  filterMode === 'selected'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-slate-600 hover:bg-gray-200'
                }`}
              >
                Seleccionados ({selectedIds.size})
              </button>
            </div>

            {filterMode === 'category' && (
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-600 focus:outline-none"
              >
                <option value="">Selecciona una categoría</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            )}

            {filterMode === 'selected' && (
              <div className="max-h-48 overflow-y-auto border-2 border-gray-200 rounded-xl p-3 space-y-2">
                {products.map(p => (
                  <label key={p.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(p.id)}
                      onChange={() => handleToggleProduct(p.id)}
                      className="w-4 h-4 text-indigo-600"
                    />
                    <span className="text-sm text-slate-700">{p.name}</span>
                    <span className="text-xs text-slate-500 ml-auto">${p.price.toFixed(2)}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Vista previa */}
          {affectedProducts.length > 0 && adjustValue && (
            <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="text-blue-600" size={20} />
                <h4 className="font-bold text-blue-900">Vista Previa</h4>
              </div>
              <p className="text-sm text-blue-700 mb-3">
                {affectedProducts.length} producto(s) serán actualizados
              </p>
              <div className="max-h-40 overflow-y-auto space-y-2">
                {previewProducts.slice(0, 10).map(p => {
                  const original = products.find(pr => pr.id === p.id);
                  const diff = p.price - (original?.price || 0);
                  return (
                    <div key={p.id} className="flex items-center justify-between bg-white p-2 rounded-lg text-sm">
                      <span className="text-slate-700 font-medium">{p.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 line-through">${original?.price.toFixed(2)}</span>
                        <span className="font-bold text-blue-600">${p.price.toFixed(2)}</span>
                        <span className={`text-xs ${diff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          ({diff >= 0 ? '+' : ''}{diff.toFixed(2)})
                        </span>
                      </div>
                    </div>
                  );
                })}
                {previewProducts.length > 10 && (
                  <p className="text-xs text-slate-500 text-center mt-2">
                    ... y {previewProducts.length - 10} más
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Advertencia */}
          {affectedProducts.length === 0 && filterMode !== 'all' && (
            <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-4 flex items-start gap-3">
              <AlertTriangle className="text-amber-600 flex-shrink-0" size={20} />
              <div>
                <p className="font-medium text-amber-900">Sin productos seleccionados</p>
                <p className="text-sm text-amber-700 mt-1">
                  {filterMode === 'category' && 'Selecciona una categoría'}
                  {filterMode === 'selected' && 'Marca al menos un producto'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-4 sm:p-6 bg-gray-50 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-6 py-3 bg-white border-2 border-gray-300 text-slate-700 rounded-xl font-medium hover:bg-gray-50 transition-colors order-2 sm:order-1"
          >
            Cancelar
          </button>
          <button
            onClick={handleApplyChanges}
            disabled={!adjustValue || affectedProducts.length === 0}
            className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-medium hover:from-indigo-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 order-1 sm:order-2"
          >
            <DollarSign size={20} />
            <span className="hidden sm:inline">Aplicar Cambios ({affectedProducts.length})</span>
            <span className="sm:hidden">Aplicar ({affectedProducts.length})</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default PriceUpdateTool;
