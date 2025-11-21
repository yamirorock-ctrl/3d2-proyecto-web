import React from 'react';
import { Plus } from 'lucide-react';
import { Product } from '../types';

interface ProductCardProps {
  product: Product;
  onAddToCart: (product: Product) => void;
}

const ProductCard: React.FC<ProductCardProps> = ({ product, onAddToCart }) => {
  return (
    <div className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col h-full">
      <div className="relative h-64 overflow-hidden bg-gray-100">
        <img 
          src={product.image} 
          alt={product.name} 
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
          loading="lazy"
        />
        <div className="absolute top-3 left-3">
           <span className="px-3 py-1 bg-white/90 backdrop-blur text-xs font-bold uppercase tracking-wider rounded-full text-slate-800 shadow-sm">
             {product.category}
           </span>
        </div>
      </div>
      
      <div className="p-5 flex flex-col flex-grow">
        <div className="flex justify-between items-start mb-2">
          <h3 className="text-lg font-bold text-slate-900 line-clamp-1">{product.name}</h3>
          <span className="text-lg font-bold text-indigo-600">${product.price}</span>
        </div>
        
        <p className="text-sm text-slate-500 mb-6 line-clamp-2 flex-grow">
          {product.description}
        </p>
        
        <button 
          onClick={() => onAddToCart(product)}
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