import React, { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { Product } from '../types';

interface ProductCardProps {
  product: Product;
  onAddToCart: (product: Product) => void;
}

const ProductCard: React.FC<ProductCardProps> = ({ product, onAddToCart }) => {
  const images = useMemo(() => {
    if (product.images && product.images.length > 0) return product.images.map(i => i.url);
    return product.image ? [product.image] : [];
  }, [product]);
  const [active, setActive] = useState(0);

  const prev = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); setActive(a => (a - 1 + images.length) % images.length); };
  const next = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); setActive(a => (a + 1) % images.length); };

  return (
    <div className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col h-full">
      <div className="relative h-64 overflow-hidden bg-gray-100">
        {images.length > 0 && (
          <img
            src={images[active]}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
            loading="lazy"
          />
        )}
        <div className="absolute top-3 left-3">
           <span className="px-3 py-1 bg-white/90 backdrop-blur text-xs font-bold uppercase tracking-wider rounded-full text-slate-800 shadow-sm">
             {product.category}
           </span>
        </div>
        {images.length > 1 && (
          <>
            <button aria-label="Anterior" onClick={prev} className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white text-slate-700 rounded-full h-8 w-8 flex items-center justify-center shadow">‹</button>
            <button aria-label="Siguiente" onClick={next} className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white text-slate-700 rounded-full h-8 w-8 flex items-center justify-center shadow">›</button>
          </>
        )}
        {images.length > 1 && (
          <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-2">
            {images.map((src, idx) => (
              <button key={idx} onClick={(e)=>{e.preventDefault(); e.stopPropagation(); setActive(idx);}} className={`h-2.5 w-2.5 rounded-full ${idx===active ? 'bg-white' : 'bg-white/50'} border border-white/60`}></button>
            ))}
          </div>
        )}
      </div>
      {product.images && product.images.length > 1 && (
        <div className="px-4 pt-3 flex gap-2 items-center">
          {product.images.map((img, idx) => (
            <button
              key={idx}
              title={img.color || `Variante ${idx+1}`}
              onClick={(e)=>{ e.preventDefault(); e.stopPropagation(); setActive(idx); }}
              className={`h-10 w-10 rounded-lg border ${idx===active ? 'border-indigo-500' : 'border-gray-200'} overflow-hidden`}
            >
              <img src={img.url} alt={img.color || `var-${idx+1}`} className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
      
      <div className="p-5 flex flex-col flex-grow">
        <div className="flex justify-between items-start mb-2">
          <h3 className="text-lg font-bold text-slate-900 line-clamp-1">{product.name}</h3>
          <span className="text-lg font-bold text-indigo-600">${product.price}</span>
        </div>
        
        <p className="text-sm text-slate-500 mb-6 line-clamp-2 flex-grow">
          {product.description}
        </p>
        
        <button 
          onClick={() => onAddToCart({ ...product, image: images[active] || product.image })}
          className="w-full py-3 px-4 bg-slate-900 text-white font-medium rounded-xl flex items-center justify-center gap-2 hover:bg-indigo-600 hover:scale-[1.02] hover:shadow-lg active:scale-95 active:bg-indigo-700 transition-all duration-200 ease-out"
        >
          <Plus size={18} />
          Agregar al Carrito
        </button>
      </div>
    </div>
  );
};

export default ProductCard;