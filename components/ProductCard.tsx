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
  setActive: React.Dispatch<React.SetStateAction<number>>;
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
      <div className={`group glass-card rounded-2xl transition-all duration-500 overflow-hidden flex flex-col h-full border border-white/5 hover:border-cyan-500/50 ${
          selectedSaleType === 'pack' ? 'shadow-[0_0_20px_rgba(99,102,241,0.15)]' :
          selectedSaleType === 'mayorista' ? 'shadow-[0_0_20px_rgba(245,158,11,0.15)]' :
          'hover:shadow-[0_0_30px_rgba(0,243,255,0.1)]'
      }`}>
        <div className="relative overflow-hidden">
          <ImageCarousel 
              images={images} 
              productName={product.name} 
              active={active} 
              setActive={setActive} 
              onImageClick={() => setIsModalOpen(true)}
          />
          
          {/* Scanline Overlay Effect */}
          <div className="absolute inset-0 pointer-events-none bg-linear-to-b from-transparent via-white/5 to-transparent h-1 opacity-20 animate-pulse -top-full group-hover:top-full transition-all duration-[2s]"></div>

          {/* Badges de Tipo de Venta sobre la imagen */}
          {selectedSaleType === 'pack' && (
             <div className="absolute top-12 left-3 bg-indigo-600/90 text-white px-3 py-1 rounded-lg font-black text-[10px] uppercase shadow-lg backdrop-blur-md pointer-events-none z-10 animate-fade-in border border-indigo-400/30">
               PACK x{unitsPerPack}
             </div>
          )}
          {selectedSaleType === 'mayorista' && (
             <div className="absolute top-12 left-3 bg-amber-600/90 text-white px-3 py-1 rounded-lg font-black text-[10px] uppercase shadow-lg backdrop-blur-md pointer-events-none z-10 animate-fade-in border border-amber-400/30">
               MAYORISTA x{wholesaleUnits}
             </div>
          )}

          <div className="absolute top-3 left-3">
            <span className="px-3 py-1 bg-black/60 backdrop-blur-xl text-[10px] font-black uppercase tracking-widest rounded-md text-cyan-400 border border-cyan-500/30 shadow-[0_0_10px_rgba(0,243,255,0.2)]">
              {product.category}
            </span>
          </div>
          {product.featured && (
            <div className="absolute top-3 right-3">
              <span className="px-2.5 py-1 bg-yellow-400 text-black text-[10px] font-black uppercase rounded-sm shadow-[0_0_10px_rgba(250,204,21,0.5)] flex items-center gap-1">
                <Star size={10} fill="currentColor" />
                LEGENDARY
              </span>
            </div>
          )}
          {(product.customizationOptions?.models?.length || product.customizationOptions?.colors?.length) ? (
            <div className="absolute top-3 left-3 mt-8">
               <span className="px-2.5 py-1 bg-magenta-500/20 backdrop-blur-md text-magenta-400 text-[9px] font-black uppercase tracking-widest rounded-sm shadow-sm border border-magenta-500/30">
                  MODIFICABLE
               </span>
            </div>
          ) : null}
        </div>

        {images.length > 1 && (
          <div className="px-4 pt-3 pb-1 flex gap-2 items-center overflow-x-auto no-scrollbar">
            {images.map((img, idx) => (
              <button
                key={idx}
                title={img.color || `Variante ${idx+1}`}
                onClick={(e) => handleThumbnailClick(e, idx)}
                className={`h-10 w-10 shrink-0 rounded-lg border transition-all ${idx===active ? 'border-cyan-500 shadow-[0_0_10px_rgba(0,243,255,0.3)] bg-cyan-500/10' : 'border-white/10 hover:border-white/30 bg-white/5'} overflow-hidden p-0.5 flex items-center justify-center`}
              >
                <SmartImage src={img.url} storageKey={img.storageKey} alt={img.color || `var-${idx+1}`} className="max-h-full max-w-full object-contain" showError />
              </button>
            ))}
          </div>
        )}
        
        <div className={`p-5 flex flex-col grow ${images.length > 1 ? 'pt-3' : ''}`}>
          <div className="flex justify-between items-start mb-3">
            <h3 
              className="text-base font-bold text-white leading-snug overflow-hidden text-ellipsis display-webkit-box webkit-line-clamp-2 webkit-box-orient-vertical hover:text-cyan-400 cursor-pointer transition-colors"
              style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}
              onClick={() => setIsModalOpen(true)}
              title={product.name}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setIsModalOpen(true); }}
            >
              {product.name}
            </h3>
            <div className="flex flex-col items-end shrink-0 ml-3">
                <span className="text-xl font-black text-white glow-cyan">
                  {selectedSaleType === 'unidad' && `$${product.price.toLocaleString()}`}
                  {selectedSaleType === 'pack' && `$${packPrice.toLocaleString()}`}
                  {selectedSaleType === 'mayorista' && `$${wholesalePrice.toLocaleString()}`}
                </span>
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">ARS / CRÉDITOS</span>
            </div>
          </div>
          
          <div className="mb-4">
            <StockIndicator stock={product.stock} />
          </div>
          
          {/* Info de tipo de venta y selector */}
          <div className="mb-4">
            <div className="flex flex-wrap gap-2 items-center">
              <span className={`inline-block px-2 py-1 text-[10px] font-black uppercase tracking-wider rounded border ${
                  selectedSaleType === 'unidad' ? 'bg-white/5 text-slate-400 border-white/10' : 
                  selectedSaleType === 'pack' ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' : 
                  'bg-amber-500/20 text-amber-400 border-amber-500/30'
              }`}>
                {selectedSaleType === 'unidad' && 'SOLO UNA'}
                {selectedSaleType === 'pack' && `LOTE x${unitsPerPack}`}
                {selectedSaleType === 'mayorista' && `WHOLESALE x${wholesaleUnits}`}
              </span>
              
              {availableSaleTypes.length > 1 && (
                <select 
                  className="text-[10px] font-bold uppercase tracking-widest border border-white/10 rounded px-2 py-1 bg-slate-900 text-slate-300 focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 outline-none cursor-pointer" 
                  value={selectedSaleType} 
                  onChange={e => setSelectedSaleType(e.target.value as any)}
                >
                  {availableSaleTypes.map(type => (
                    <option key={type} value={type}>
                      {type === 'unidad' ? 'ESTÁNDAR' : 
                       type === 'pack' ? `PACK` : 
                       'MAYORISTA'}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <p className="text-sm text-slate-400 mb-6 line-clamp-3 grow cursor-pointer hover:text-slate-200 transition-colors leading-relaxed" onClick={() => setIsModalOpen(true)}>
            {product.description}
          </p>

          {/* Dimensiones y peso - Tech Style */}
          {(product.dimensions || product.weight) && (
            <div className="mb-5 flex items-center gap-4 text-[10px] font-mono text-slate-500 border-t border-white/5 pt-4">
              {product.dimensions && (
                <div className="flex items-center gap-1">
                  <span className="text-cyan-500 opacity-50">SIZE:</span>
                  <span>{product.dimensions.width}×{product.dimensions.height}×{product.dimensions.length}cm</span>
                </div>
              )}
            </div>
          )}
          
          <button 
            onClick={handleAddToCart}
            disabled={product.stock === 0}
            className={`w-full py-4 px-4 font-black uppercase tracking-[0.2em] text-xs rounded-xl flex items-center justify-center gap-2 transition-all duration-300 active:scale-95 group/btn overflow-hidden relative ${
              product.stock === 0
                ? 'bg-white/5 text-slate-600 cursor-not-allowed grayscale'
                : selectedSaleType === 'mayorista' 
                   ? 'bg-amber-500 text-black hover:bg-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.4)]'
                   : selectedSaleType === 'pack'
                      ? 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-[0_0_20px_rgba(79,70,229,0.4)]'
                      : 'bg-cyan-500 text-black hover:bg-cyan-400 shadow-[0_0_20px_rgba(0,243,255,0.4)]'
            }`}
          >
            <div className="absolute inset-0 bg-white/20 -translate-x-full group-hover/btn:translate-x-full transition-transform duration-500"></div>
            <Plus size={16} strokeWidth={3} className="relative z-10" />
            <span className="relative z-10">
                {product.stock === 0 ? 'LOG OUT' : 'SISTEMA > ADD'}
            </span>
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