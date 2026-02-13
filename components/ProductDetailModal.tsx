import React, { useState, useMemo, useEffect } from 'react';
import { X, Plus, Star } from 'lucide-react';
import { Product, ProductImage } from '../types';
import SmartImage from './SmartImage';
import { useProductCalculations } from '../hooks/useProductCalculations';

interface ProductDetailModalProps {
  product: Product;
  isOpen: boolean;
  onClose: () => void;
  onAddToCart: (product: Product, quantity?: number) => void;
}

const ProductDetailModal: React.FC<ProductDetailModalProps> = ({ product, isOpen, onClose, onAddToCart }) => {
  const images = useMemo(() => {
    if (product.images && product.images.length > 0) return product.images;
    return product.image ? [{ url: product.image }] : [];
  }, [product.images, product.image]);

  const [active, setActive] = useState(0);

  const {
    unitsPerPack,
    wholesaleUnits,
    packPrice,
    wholesalePrice,
    availableSaleTypes,
    wholesaleImage
  } = useProductCalculations(product);



  const [selectedSaleType, setSelectedSaleType] = useState<'unidad' | 'pack' | 'mayorista'>('unidad');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [selectedColor, setSelectedColor] = useState<string>('');

  // Auto-select first option if available
  useEffect(() => {
    if (product.customizationOptions?.models?.length && !selectedModel) {
        setSelectedModel(product.customizationOptions.models[0]);
    }
    if (product.customizationOptions?.colors?.length && !selectedColor) {
        setSelectedColor(product.customizationOptions.colors[0]);
    }
  }, [product, isOpen]);

  useEffect(() => {
      if (availableSaleTypes.length > 0 && !availableSaleTypes.includes(selectedSaleType)) {
          setSelectedSaleType(availableSaleTypes[0]);
      } else if (availableSaleTypes.length > 0 && selectedSaleType === 'unidad' && !availableSaleTypes.includes('unidad')) {
        // Fallback specific
        setSelectedSaleType(availableSaleTypes[0]);
      }
  }, [isOpen, availableSaleTypes]);

  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = 'unset';
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAddToCart = () => {
    // Logic duplicated/shared ideally this logic should be in a hook too or passed down, 
    // but for now we replicate the concise logic from card to ensure correctness in modal context
    let finalPrice = product.price;
    let quantityToAdd = 1;
    let finalImage = images[active]?.url || product.image;

    if (selectedSaleType === 'pack') {
        const packDiscount = product.packDiscount || 0;
        finalPrice = Math.round(product.price * unitsPerPack * (1 - packDiscount/100));
        quantityToAdd = 1;
        if (product.weight) product.weight = product.weight * unitsPerPack;
    } else if (selectedSaleType === 'mayorista') {
        finalPrice = wholesalePrice;
        quantityToAdd = 1;
        if (wholesaleImage) finalImage = wholesaleImage;
        if (product.weight) product.weight = product.weight * wholesaleUnits;
    }

    onAddToCart({ 
        ...product, 
        price: finalPrice, 
        saleType: selectedSaleType,
        image: finalImage,
        selectedOptions: {
            model: selectedModel || undefined,
            color: selectedColor || undefined
        }
    }, quantityToAdd);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose} />
      
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto flex flex-col md:flex-row animate-scale-in">
        <button 
            onClick={onClose}
            className="absolute top-4 right-4 z-10 p-2 bg-white/80 hover:bg-white rounded-full shadow-md text-slate-500 hover:text-red-500 transition-colors"
        >
            <X size={24} />
        </button>

        {/* Mobile Header (Visible only on mobile) */}
        <div className="md:hidden p-4 pb-0 border-b border-gray-50">
           <span className="text-indigo-600 font-bold tracking-wider text-xs uppercase mb-1 block">{product.category}</span>
           <h2 className="text-2xl font-bold text-slate-900 leading-tight">{product.name}</h2>
        </div>

        {/* Galería */}
        <div className="w-full md:w-1/2 bg-white md:bg-gray-50 flex flex-col p-0 sm:p-6 items-center justify-center relative min-h-[300px]">
           <div className="relative w-full h-[45vh] sm:h-80 flex items-center justify-center p-4">
             <SmartImage 
                src={images[active].url} 
                storageKey={images[active].storageKey} 
                alt={product.name} 
                wrapperClassName="!flex w-full h-full items-center justify-center"
                className="max-h-full max-w-full object-contain drop-shadow-xl"
             />
           </div>
           {images.length > 1 && (
             <div className="flex gap-2 mt-2 px-4 pb-4 overflow-x-auto w-full justify-center">
               {images.map((img, idx) => (
                 <button 
                   key={idx} 
                   onClick={() => setActive(idx)}
                   className={`h-14 w-14 border-2 rounded-lg overflow-hidden shrink-0 transition-all ${idx === active ? 'border-indigo-600 ring-2 ring-indigo-200' : 'border-gray-200 opacity-60 hover:opacity-100'}`}
                 >
                   <SmartImage src={img.url} storageKey={img.storageKey} className="w-full h-full object-cover" />
                 </button>
               ))}
             </div>
           )}
        </div>

        {/* Info */}
        <div className="w-full md:w-1/2 p-4 md:p-8 flex flex-col">
           {/* Desktop Header (Hidden on mobile) */}
           <div className="mb-4 hidden md:block">
             <span className="text-indigo-600 font-bold tracking-wider text-xs uppercase mb-1 block">{product.category}</span>
             <h2 className="text-3xl font-bold text-slate-900 leading-tight">{product.name}</h2>
           </div>

           <div className="grow overflow-y-auto pr-2 mb-6 max-h-60 custom-scrollbar">
             <p className="text-slate-600 leading-relaxed text-base whitespace-pre-wrap">
               {product.description}
             </p>
             {product.dimensions && (
               <div className="mt-4 p-3 bg-slate-50 rounded-lg text-sm text-slate-600 border border-slate-100">
                 <strong>Dimensiones:</strong> {product.dimensions.width}cm x {product.dimensions.height}cm x {product.dimensions.length}cm
                 {product.technology === 'Láser' && (
                    <span className="ml-2 block text-xs text-slate-500">(Espesor: {Math.round(product.dimensions.height*10)}mm)</span>
                 )}
               </div>
             )}
           </div>



            {/* Selectores de Personalización */}
            {(product.customizationOptions?.models?.length || product.customizationOptions?.colors?.length) ? (
                <div className="mb-6 space-y-4 border-t pt-4 border-gray-100">
                    {product.customizationOptions.models && product.customizationOptions.models.length > 0 && (
                        <div>
                            <span className="block text-sm font-medium text-slate-700 mb-2">Modelo</span>
                            <div className="flex flex-wrap gap-2">
                                {product.customizationOptions.models.map(m => (
                                    <button
                                        key={m}
                                        onClick={() => setSelectedModel(m)}
                                        className={`px-3 py-1.5 rounded-lg border text-sm transition-all ${
                                            selectedModel === m 
                                            ? 'border-indigo-600 bg-indigo-50 text-indigo-700 font-medium ring-1 ring-indigo-600' 
                                            : 'border-gray-200 text-slate-600 hover:border-gray-300'
                                        }`}
                                    >
                                        {m}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {product.customizationOptions.colors && product.customizationOptions.colors.length > 0 && (
                        <div>
                            <span className="block text-sm font-medium text-slate-700 mb-2">Color</span>
                            <div className="flex flex-wrap gap-2">
                                {product.customizationOptions.colors.map(c => (
                                    <button
                                        key={c}
                                        onClick={() => setSelectedColor(c)}
                                        className={`px-3 py-1.5 rounded-lg border text-sm transition-all ${
                                            selectedColor === c 
                                            ? 'border-indigo-600 bg-indigo-50 text-indigo-700 font-medium ring-1 ring-indigo-600' 
                                            : 'border-gray-200 text-slate-600 hover:border-gray-300'
                                        }`}
                                    >
                                        {c}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            ) : null}
           <div className="mt-auto pt-6 border-t border-gray-100">
              <div className="flex flex-wrap gap-2 mb-4">
                 {availableSaleTypes.map(type => (
                    <button
                        key={type}
                        onClick={() => setSelectedSaleType(type)}
                        className={`flex-1 py-2 px-3 rounded-lg border text-sm font-bold transition-all ${
                            selectedSaleType === type 
                            ? type === 'mayorista' ? 'bg-amber-50 border-amber-500 text-amber-700' 
                              : type === 'pack' ? 'bg-indigo-50 border-indigo-500 text-indigo-700'
                              : 'bg-slate-800 text-white border-slate-800'
                            : 'bg-white border-gray-200 text-slate-600 hover:border-gray-300'
                        }`}
                    >
                        {type === 'unidad' && 'Unidad'}
                        {type === 'pack' && `Pack x${unitsPerPack}`}
                        {type === 'mayorista' && `Mayorista x${wholesaleUnits}`}
                    </button>
                 ))}
              </div>

              <div className="flex items-center justify-between mb-4">
                 <div className="flex flex-col">
                    <span className="text-3xl font-bold text-slate-900">
                        {selectedSaleType === 'unidad' && `$${product.price}`}
                        {selectedSaleType === 'pack' && `$${packPrice}`}
                        {selectedSaleType === 'mayorista' && `$${wholesalePrice}`}
                    </span>
                    {selectedSaleType === 'pack' && (
                       <span className="text-xs text-green-600 font-medium bg-green-50 px-2 py-0.5 rounded-full w-fit">Ahorras {product.packDiscount}%</span>
                    )}
                 </div>
              </div>

              <button 
                onClick={handleAddToCart}
                disabled={product.stock === 0}
                className={`w-full py-4 text-lg font-bold rounded-xl shadow-xl transition-transform active:scale-95 flex items-center justify-center gap-2 ${
                    product.stock === 0 ? 'bg-gray-200 text-gray-400' :
                    selectedSaleType === 'mayorista' ? 'bg-amber-500 hover:bg-amber-600 text-white' :
                    selectedSaleType === 'pack' ? 'bg-indigo-600 hover:bg-indigo-700 text-white' :
                    'bg-slate-900 hover:bg-slate-800 text-white'
                }`}
              >
                  {product.stock === 0 ? 'Agotado' : 'Agregar al Carrito'}
                  {product.stock !== 0 && <Plus size={24} />}
              </button>
           </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetailModal;
