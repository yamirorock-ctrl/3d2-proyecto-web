import React, { useMemo, useState } from 'react';
import { Plus, Star } from 'lucide-react';
import { Product, ProductImage } from '../types';
import SmartImage from './SmartImage';
import { useProductCalculations } from '../hooks/useProductCalculations';
import ProductDetailModal from './ProductDetailModal';

interface ProductCardProps {
  product: Product;
  onAddToCart: (product: Product, quantity?: number) => void;
}

// --- Sub-componentes para mejorar la legibilidad ---

const StockIndicator: React.FC<{ stock: number | undefined }> = ({ stock }) => {
  if (stock === undefined) return null;

  if (stock === 0) {
    return <span className="inline-block px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded">Agotado</span>;
  }
  if (stock < 5) {
    return <span className="inline-block px-2 py-1 bg-yellow-100 text-yellow-700 text-xs font-medium rounded">¡Pocas unidades!</span>;
  }
  return <span className="inline-block px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">Disponible</span>;
};

const ImageCarousel: React.FC<{
  images: ProductImage[];
  productName: string;
  active: number;
  setActive: (index: number) => void;
  onImageClick: () => void;
}> = ({ images, productName, active, setActive, onImageClick }) => {
  const handleInteraction = (e: React.MouseEvent, action: () => void) => {
    e.preventDefault();
    e.stopPropagation();
    action();
  };

  const prev = () => setActive((a) => (a - 1 + images.length) % images.length);
  const next = () => setActive((a) => (a + 1) % images.length);

  return (
    <div 
      className="relative h-64 overflow-hidden bg-white p-8 flex items-center justify-center cursor-pointer group/image" 
      onClick={onImageClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onImageClick(); }}
      aria-label={`Ver detalles de ${productName}`}
    >
       {/* Zoom hint */}
      <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/5 opacity-0 group-hover/image:opacity-100 transition-opacity pointer-events-none">
          <span className="bg-white/90 backdrop-blur px-3 py-1 rounded-full text-xs font-medium text-slate-700 shadow-sm">Ver detalles</span>
      </div>

      {images.length > 0 && (
        <SmartImage
          src={images[active].url}
          storageKey={images[active].storageKey}
          alt={productName}
          className="max-h-full max-w-full object-contain transition-transform duration-300 group-hover/image:scale-105"
          loading="lazy"
          showError
        />
      )}
      {images.length > 1 && (
        <>
          <button aria-label="Anterior" onClick={(e) => handleInteraction(e, prev)} className="absolute left-2 top-1/2 -translate-y-1/2 z-30 bg-white/80 hover:bg-white text-slate-700 rounded-full h-8 w-8 flex items-center justify-center shadow">‹</button>
          <button aria-label="Siguiente" onClick={(e) => handleInteraction(e, next)} className="absolute right-2 top-1/2 -translate-y-1/2 z-30 bg-white/80 hover:bg-white text-slate-700 rounded-full h-8 w-8 flex items-center justify-center shadow">›</button>
          <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-2 z-30">
            {images.map((_, idx) => (
              <button key={idx} onClick={(e) => handleInteraction(e, () => setActive(idx))} className={`h-2.5 w-2.5 rounded-full ${idx === active ? 'bg-white' : 'bg-white/50'} border border-white/60`}></button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

const ProductCard: React.FC<ProductCardProps> = ({ product, onAddToCart }) => {
  const images = useMemo(() => {
    if (product.images && product.images.length > 0) return product.images;
    return product.image ? [{ url: product.image }] : [];
  }, [product.images, product.image]);
  const [active, setActive] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const {
    unitsPerPack,
    wholesaleUnits,
    wholesaleDiscount,
    wholesaleImage,
    wholesaleDescription,
    packPrice,
    wholesalePrice,
    availableSaleTypes,
  } = useProductCalculations(product);

  // Initialize with the first available sale type. Default to 'unidad' if something fails, but logic below handles it.
  const [selectedSaleType, setSelectedSaleType] = useState<'unidad' | 'pack' | 'mayorista'>(
      availableSaleTypes.length > 0 ? availableSaleTypes[0] : 'unidad'
  );

  // Update selected if current selection becomes unavailable (e.g. data refresh)
  // This effect ensures if props change, we don't get stuck on a disabled type
  React.useEffect(() => {
     if (!availableSaleTypes.includes(selectedSaleType) && availableSaleTypes.length > 0) {
         setSelectedSaleType(availableSaleTypes[0]);
     }
  }, [availableSaleTypes, selectedSaleType]);

  const handleThumbnailClick = (e: React.MouseEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    setActive(index);
  };

  const handleAddToCart = () => {
    let finalPrice = product.price;
    let quantityToAdd = 1;
    let finalImage = images[active]?.url || product.image;

    if (selectedSaleType === 'pack') {
        const packDiscount = product.packDiscount || 0;
        const singlePackPrice = Math.round(product.price * unitsPerPack * (1 - packDiscount/100)); // Fixed calc
        finalPrice = singlePackPrice; 
        quantityToAdd = 1; 
        if (product.weight) {
             product = { ...product, weight: product.weight * unitsPerPack };
        }
    } else if (selectedSaleType === 'mayorista') {
        finalPrice = wholesalePrice; 
        quantityToAdd = 1; 
        if (wholesaleImage) finalImage = wholesaleImage;
        if (product.weight) {
             product = { ...product, weight: product.weight * wholesaleUnits };
        }
    }

    onAddToCart({ 
        ...product, 
        price: finalPrice, 
        saleType: selectedSaleType,
        image: finalImage,
    }, quantityToAdd);
  };

  return (
    <>
      <div className={`group bg-white rounded-2xl border transition-all duration-300 overflow-hidden flex flex-col h-full ${
          selectedSaleType === 'pack' ? 'border-indigo-400 shadow-indigo-100 hover:shadow-indigo-200' :
          selectedSaleType === 'mayorista' ? 'border-amber-400 shadow-amber-100 hover:shadow-amber-200' :
          'border-gray-100 shadow-sm hover:shadow-xl'
      }`}>
        <div className="relative">
          <ImageCarousel 
              images={images} 
              productName={product.name} 
              active={active} 
              setActive={setActive} 
              onImageClick={() => setIsModalOpen(true)}
          />
          
          {/* Badges de Tipo de Venta sobre la imagen */}
          {selectedSaleType === 'pack' && (
             <div className="absolute top-12 left-3 bg-indigo-600/90 text-white px-3 py-1 rounded-lg font-bold text-sm shadow-md backdrop-blur-sm pointer-events-none z-10 animate-fade-in">
               PACK x{unitsPerPack}
             </div>
          )}
          {selectedSaleType === 'mayorista' && (
             <div className="absolute top-12 left-3 bg-amber-600/90 text-white px-3 py-1 rounded-lg font-bold text-sm shadow-md backdrop-blur-sm pointer-events-none z-10 animate-fade-in">
               MAYORISTA x{wholesaleUnits}
             </div>
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
          {(product.customizationOptions?.models?.length || product.customizationOptions?.colors?.length) ? (
            <div className="absolute top-3 left-3 mt-8">
               <span className="px-2.5 py-1 bg-purple-100/90 backdrop-blur text-purple-700 text-[10px] font-bold uppercase tracking-wider rounded-lg shadow-sm border border-purple-200">
                  Personalizable
               </span>
            </div>
          ) : null}
        </div>

        {images.length > 1 && (
          <div className="px-4 pt-2 pb-1 flex gap-2 items-center overflow-x-auto scrollbar-hide">
            {images.map((img, idx) => (
              <button
                key={idx}
                title={img.color || `Variante ${idx+1}`}
                onClick={(e) => handleThumbnailClick(e, idx)}
                className={`h-8 w-8 shrink-0 rounded-lg border ${idx===active ? 'border-indigo-500' : 'border-gray-200'} overflow-hidden bg-white p-0.5 flex items-center justify-center`}
              >
                <SmartImage src={img.url} storageKey={img.storageKey} alt={img.color || `var-${idx+1}`} className="max-h-full max-w-full object-contain" showError />
              </button>
            ))}
          </div>
        )}
        
        <div className={`p-5 flex flex-col grow ${images.length > 1 ? 'pt-3' : ''}`}>
          <div className="flex justify-between items-start mb-2">
            <h3 
              className="text-lg font-bold text-slate-900 overflow-hidden text-ellipsis display-webkit-box webkit-line-clamp-2 webkit-box-orient-vertical hover:text-indigo-600 cursor-pointer transition-colors"
              style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}
              onClick={() => setIsModalOpen(true)}
              title={product.name}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setIsModalOpen(true); }}
            >
              {product.name}
            </h3>
            <span className="text-lg font-bold text-indigo-600 ml-2 shrink-0">
              {selectedSaleType === 'unidad' && `$${product.price}`}
              {selectedSaleType === 'pack' && `$${packPrice}`}
              {selectedSaleType === 'mayorista' && `$${wholesalePrice}`}
            </span>
          </div>
          
          <div className="mb-2">
            <StockIndicator stock={product.stock} />
          </div>
          
          {/* Info de tipo de venta y selector */}
          <div className="mb-2">
            <div className="flex flex-wrap gap-2 items-center">
              <span className={`inline-block px-2 py-1 text-xs font-medium rounded ${
                  selectedSaleType === 'unidad' ? 'bg-slate-100 text-slate-700' : 
                  selectedSaleType === 'pack' ? 'bg-indigo-100 text-indigo-700' : 
                  'bg-amber-100 text-amber-800'
              }`}>
                {selectedSaleType === 'unidad' && 'Unidad'}
                {selectedSaleType === 'pack' && `Pack x${unitsPerPack}`}
                {selectedSaleType === 'mayorista' && `Mayorista x${wholesaleUnits}`}
              </span>
              
              {availableSaleTypes.length > 1 && (
                <select 
                  className="text-xs border border-gray-300 rounded px-2 py-1 bg-white focus:ring-2 focus:ring-indigo-500 outline-none" 
                  value={selectedSaleType} 
                  onChange={e => setSelectedSaleType(e.target.value as any)}
                >
                  {availableSaleTypes.map(type => (
                    <option key={type} value={type}>
                      {type === 'unidad' ? 'Unidad' : 
                       type === 'pack' ? `Pack` : 
                       'Mayorista'}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Mostrar detalles según tipo de venta seleccionado */}
          {selectedSaleType === 'pack' && (
            <div className="mb-2 text-xs text-slate-700 bg-indigo-50 p-2 rounded border border-indigo-100 animate-fade-in">
               🔥 <b>Pack Ahorro:</b> Llevando {unitsPerPack} pagas <b>${packPrice}</b> (Cada uno queda en ${Math.round(packPrice/unitsPerPack)})
            </div>
          )}
          {selectedSaleType === 'mayorista' && (
            <div className="mb-2 text-xs text-amber-900 bg-amber-50 p-2 rounded border border-amber-100 animate-fade-in">
              <div>📦 <b>Lote Mayorista (Crudo):</b> {wholesaleUnits} unidades.</div>
              <div>Precio Lote: <b>${wholesalePrice}</b> (Unidad: ${Math.round(wholesalePrice/wholesaleUnits)})</div>
              <div className="text-amber-700/80 mt-1 italic">Nota: Se entrega sin pintar/lijar.</div>
              {wholesaleImage && <SmartImage src={wholesaleImage} className="mt-2 w-full h-24 object-cover rounded" />}
            </div>
          )}

          <p className="text-sm text-slate-500 mb-4 line-clamp-3 grow cursor-pointer hover:text-slate-700" onClick={() => setIsModalOpen(true)}>
            {product.description}
          </p>

          {/* Dimensiones y peso */}
          {(product.dimensions || product.weight) && (
            <div className="mb-3 text-xs text-slate-600">
              {product.dimensions && (
                <>
                  <span>Dim: {product.dimensions.width}×{product.dimensions.height}×{product.dimensions.length}cm</span>
                  {product.technology === 'Láser' && product.dimensions.height && (
                    <span className="ml-2">({Math.round(product.dimensions.height * 10)}mm)</span>
                  )}
                </>
              )}
              {/* Ocultamos peso para no saturar, o lo dejamos si es necesario para el usuario */}
            </div>
          )}
          
          <button 
            onClick={handleAddToCart}
            disabled={product.stock === 0}
            className={`w-full py-3 px-4 font-medium rounded-xl flex items-center justify-center gap-2 transition-all duration-200 ease-out active:scale-95 ${
              product.stock === 0
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : selectedSaleType === 'mayorista' 
                   ? 'bg-amber-500 text-white hover:bg-amber-600 shadow-lg shadow-amber-200'
                   : selectedSaleType === 'pack'
                      ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-200'
                      : 'bg-slate-900 text-white hover:bg-slate-800'
            }`}
          >
            <Plus size={18} />
            {product.stock === 0 ? 'Agotado' : 'Agregar al Carrito'}
          </button>
        </div>
      </div>
      
      {/* Modal de Detalle */}
      <ProductDetailModal 
        product={product} 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onAddToCart={onAddToCart}
      />
    </>
  );
};

export default ProductCard;