import { CartItem, Product } from '../types';

// Densidades aproximadas
// Impresión 3D: PLA ~1.24 g/cm3; usamos factor de relleno 20-30%
// Láser (madera): densidad media ~0.7 g/cm3 (pino/álamo), puede variar por material
const DENSITY_PLA_G_CM3 = 1.24;
const INFILL_FACTOR = 0.25; // 25% de volumen efectivo

const DENSITY_WOOD_G_CM3 = 0.7;

// Grosor estándar para corte láser si no se indica (en mm)
const LASER_DEFAULT_THICKNESS_MM = 3;

// Utilidad: cm a cm3
const volumeCm3 = (widthCm: number, heightCm: number, lengthCm: number) => widthCm * heightCm * lengthCm;

// Utilidad: área en cm2 a volumen por grosor en mm => cm3
const laserVolumeFromArea = (widthCm: number, lengthCm: number, thicknessMm: number) => {
  const areaCm2 = widthCm * lengthCm;
  const thicknessCm = thicknessMm / 10; // mm a cm
  return areaCm2 * thicknessCm;
};

export function estimateProductWeight(product: Product): number {
  // Si tiene peso cargado, usarlo directo
  if (product.weight && product.weight > 0) return product.weight;

  const dims = product.dimensions || { width: 10, height: 10, length: 10 };

  if (product.technology === 'Láser') {
    // Para láser estimamos como placa plana: ancho x largo x grosor
    // Si la altura es muy baja (< 1 cm), asumimos grosor a partir de altura si está presente
    const thicknessMm = Math.max(
      Math.round((dims.height || 0) * 10),
      LASER_DEFAULT_THICKNESS_MM
    );
    const volCm3 = laserVolumeFromArea(dims.width, dims.length, thicknessMm);
    const weightG = volCm3 * DENSITY_WOOD_G_CM3;
    // Redondeo y mínimo razonable
    return Math.max(50, Math.round(weightG));
  }

  // Para 3D: volumen del bounding box con factor de relleno (muy aproximado)
  const volCm3 = volumeCm3(dims.width, dims.height, dims.length) * INFILL_FACTOR;
  const weightG = volCm3 * DENSITY_PLA_G_CM3;
  return Math.max(30, Math.round(weightG));
}

export function estimateCartWeight(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + estimateProductWeight(item) * item.quantity, 0);
}
