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

<<<<<<< HEAD
      // Lógica para mostrar info de venta y selector
      const [selectedSaleType, setSelectedSaleType] = useState<'unidad' | 'pack' | 'mayorista'>(product.saleType || 'unidad');
      // Simulación de props extendidas para packs y mayorista
      const unitsperpack = product.unitsperpack || 1;
      const wholesaleUnits = product.wholesaleUnits || 20;
      const wholesaleDiscount = product.wholesaleDiscount || 20;
      const wholesaleImage = product.wholesaleImage;
      const wholesaledescription = product.wholesaledescription;
      const packPrice = product.price * unitsperpack;
      const wholesalePrice = Math.round(product.price * wholesaleUnits * (1 - wholesaleDiscount / 100));
  // Simulación de props extendidas para packs y mayorista
  const unitsperpack = product.unitsperpack || 1;
  const wholesaleUnits = product.wholesaleUnits || 20;
  const wholesaleDiscount = product.wholesaleDiscount || 20;
  const wholesaleImage = product.wholesaleImage;
  const wholesaledescription = product.wholesaledescription;
  const packPrice = product.price * unitsperpack;
  const wholesalePrice = Math.round(product.price * wholesaleUnits * (1 - wholesaleDiscount / 100));

>>>>>>> a99aad31460ce26d9264c105a3b3a48ba941a898
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
        
<<<<<<< HEAD
=======
        {/* Info de tipo de venta y selector */}
        <div className="mb-2">
          <span className="inline-block px-2 py-1 bg-indigo-50 text-indigo-700 text-xs font-medium rounded mr-2">
            {selectedSaleType === 'unidad' && 'Venta por unidad'}
            {selectedSaleType === 'pack' && `Pack x${unitsperpack} unidades`}
            {selectedSaleType === 'mayorista' && `Mayorista x${wholesaleUnits} (desc. ${wholesaleDiscount}%)`}
          </span>
          {/* Selector si hay más de una opción */}
          {(['unidad','pack','mayorista'].filter(t => product[t+'Enabled'] || t === product.saleType).length > 1) && (
            <select className="ml-2 text-xs border rounded px-2 py-1" value={selectedSaleType} onChange={e => setSelectedSaleType(e.target.value as any)}>
              {product.saleType === 'unidad' && <option value="unidad">Unidad</option>}
              {product.packEnabled && <option value="pack">Pack</option>}
              {product.mayorista_enabled && <option value="mayorista">Mayorista</option>}
            </select>
          )}
        </div>
        {/* Mostrar detalles según tipo de venta seleccionado */}
        {selectedSaleType === 'pack' && (
          <div className="mb-2 text-xs text-slate-700">Pack de {unitsperpack} unidades. Precio: <b>${packPrice}</b></div>
        )}
        {selectedSaleType === 'mayorista' && (
          <div className="mb-2 text-xs text-slate-700">
            <div>Mayorista: {wholesaleUnits} unidades. Descuento: {wholesaleDiscount}%</div>
            <div>Precio final: <b>${wholesalePrice}</b></div>
            {wholesaleImage && <img src={wholesaleImage} alt="Mayorista" className="mt-1 w-20 h-20 object-cover rounded" />}
            {wholesaledescription && <div className="mt-1 text-slate-500">{wholesaledescription}</div>}
          </div>
        )}
        
>>>>>>> a99aad31460ce26d9264c105a3b3a48ba941a898
        <p className="text-sm text-slate-500 mb-4 line-clamp-3 flex-grow">
          {product.description}
        </p>

        {/* Dimensiones y peso */}
        {(product.dimensions || product.weight) && (
          <div className="mb-3 text-xs text-slate-600">
            {product.dimensions && (
              <>
                <p>
                  Dimensiones: {product.dimensions.width}×{product.dimensions.height}×{product.dimensions.length} cm
                </p>
                {product.technology === 'Láser' && product.dimensions.height && (
                  <p>Grosor: {Math.round(product.dimensions.height * 10)} mm</p>
                )}
              </>
            )}
            {product.weight && (
              <p>Peso: {product.weight} g</p>
            )}
          </div>
        )}
        
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