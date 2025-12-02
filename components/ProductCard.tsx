import React, { useMemo, useState } from 'react';
import { Plus, Star } from 'lucide-react';
import { Product } from '../types';
import SmartImage from './SmartImage';

interface ProductCardProps {
  product: Product;
  onAddToCart: (product: Product) => void;
}

const ProductCard: React.FC<ProductCardProps> = ({ product, onAddToCart }) => {
  const images = useMemo(() => {
    if (product.images && product.images.length > 0) return product.images;
    return product.image ? [{ url: product.image }] : [];
  }, [product]);
  const [active, setActive] = useState(0);

  const prev = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); setActive(a => (a - 1 + images.length) % images.length); };
  const next = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); setActive(a => (a + 1) % images.length); };

  return (
    <div className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col h-full">
      <div className="relative h-64 overflow-hidden bg-white p-8 flex items-center justify-center">
        {images.length > 0 && (
          <SmartImage
            src={images[active].url}
            storageKey={images[active].storageKey}
            alt={product.name}
            className="max-h-full max-w-full object-contain"
            loading="lazy"
            showError
          />
        )}
        <div className="absolute top-3 left-3">
           <span className="px-3 py-1 bg-white/90 backdrop-blur text-xs font-bold uppercase tracking-wider rounded-full text-slate-800 shadow-sm">
             {product.category}
           </span>
        </div>
        {product.featured && (
          <div className="absolute top-3 right-3">
            <span className="px-2.5 py-1 bg-yellow-300/90 text-yellow-900 text-xs font-bold rounded-full shadow-sm flex items-center gap-1">
              <Star size={12} className="text-yellow-900" />
              Destacado
            </span>
          </div>
        )}
        {images.length > 1 && (
          <>
            <button aria-label="Anterior" onClick={prev} className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white text-slate-700 rounded-full h-8 w-8 flex items-center justify-center shadow">‹</button>
            <button aria-label="Siguiente" onClick={next} className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white text-slate-700 rounded-full h-8 w-8 flex items-center justify-center shadow">›</button>
          </>
        )}
        {images.length > 1 && (
          <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-2">
            {images.map((_, idx) => (
              <button key={idx} onClick={(e)=>{e.preventDefault(); e.stopPropagation(); setActive(idx);}} className={`h-2.5 w-2.5 rounded-full ${idx===active ? 'bg-white' : 'bg-white/50'} border border-white/60`}></button>
            ))}
          </div>
        )}
      </div>
      {product.images && product.images.length > 1 && (
        <div className="px-4 pt-2 pb-1 flex gap-2 items-center overflow-x-auto scrollbar-hide">
          {product.images.map((img, idx) => (
            <button
              key={idx}
              title={img.color || `Variante ${idx+1}`}
              onClick={(e)=>{ e.preventDefault(); e.stopPropagation(); setActive(idx); }}
              className={`h-8 w-8 flex-shrink-0 rounded-lg border ${idx===active ? 'border-indigo-500' : 'border-gray-200'} overflow-hidden bg-white p-0.5 flex items-center justify-center`}
            >
              <SmartImage src={img.url} storageKey={img.storageKey} alt={img.color || `var-${idx+1}`} className="max-h-full max-w-full object-contain" showError />
            </button>
          ))}
        </div>
      )}
      
      <div className={`p-5 flex flex-col flex-grow ${product.images && product.images.length > 1 ? 'pt-3' : ''}`}>
        <div className="flex justify-between items-start mb-2">
          <h3 className="text-lg font-bold text-slate-900 line-clamp-1">{product.name}</h3>
          <span className="text-lg font-bold text-indigo-600 ml-2 flex-shrink-0">${product.price}</span>
        </div>
        
        {/* Stock indicator */}
        {product.stock !== undefined && (
          <div className="mb-2">
            {product.stock === 0 ? (
              <span className="inline-block px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded">
                Agotado
              </span>
            ) : product.stock < 5 ? (
              <span className="inline-block px-2 py-1 bg-yellow-100 text-yellow-700 text-xs font-medium rounded">
                ¡Pocas unidades!
              </span>
            ) : (
              <span className="inline-block px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">
                Disponible
              </span>
            )}
          </div>
        )}
        
        <p className="text-sm text-slate-500 mb-4 line-clamp-3 flex-grow">
          {product.description}
        </p>
        
        <button 
          onClick={() => onAddToCart({ ...product, image: images[active].url ? images[active].url! : images[active].storageKey ? `lf:${images[active].storageKey}` : product.image })}
          disabled={product.stock === 0}
          className={`w-full py-3 px-4 font-medium rounded-xl flex items-center justify-center gap-2 transition-all duration-200 ease-out ${
            product.stock === 0
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-slate-900 text-white hover:bg-indigo-600 hover:scale-[1.02] hover:shadow-lg active:scale-95 active:bg-indigo-700'
          }`}
        >
          <Plus size={18} />
          {product.stock === 0 ? 'Agotado' : 'Agregar al Carrito'}
        </button>
      </div>
    </div>
  );
};

export default ProductCard;