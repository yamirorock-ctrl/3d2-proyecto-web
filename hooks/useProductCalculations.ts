import { useMemo } from 'react';
import { Product } from '../types';

export const useProductCalculations = (product: Product) => {
  return useMemo(() => {
    const unitsPerPack = product.unitsPerPack || 1;
    const wholesaleUnits = product.wholesaleUnits || 20;
    const wholesaleDiscount = product.wholesaleDiscount || 20;
    const wholesaleImage = product.wholesaleImage;
    const wholesaleDescription = product.wholesaleDescription;
    
    // Fix: Get discount and apply it
    const packDiscount = product.packDiscount || 0;
    const packPrice = Math.round(product.price * unitsPerPack * (1 - packDiscount / 100));
    
    const wholesalePrice = Math.round(product.price * wholesaleUnits * (1 - wholesaleDiscount / 100));

    const availableSaleTypes = (['unidad', 'pack', 'mayorista'] as const).filter(type => {
      if (type === 'unidad') return product.unitEnabled !== false; // Default true
      if (type === 'pack') return product.packEnabled;
      if (type === 'mayorista') return product.mayoristaEnabled;
      return false;
    });

    return {
      unitsPerPack,
      wholesaleUnits,
      wholesaleDiscount,
      wholesaleImage,
      wholesaleDescription,
      packPrice,
      wholesalePrice,
      availableSaleTypes,
    };
  }, [product]);
};
