export interface ProductImage {
  url?: string; // URL pública o dataURL
  storageKey?: string; // Clave en IndexedDB (localforage)
  color?: string;
}

export interface Product {
  id: number;
  name: string;
  price: number;
  category: string;
  image: string;
  images?: ProductImage[];
  description: string;
  technology?: '3D' | 'Láser';
  featured?: boolean;
  stock?: number; // Cantidad disponible en inventario
  dimensions?: {
    width: number;  // cm
    height: number; // cm
    length: number; // cm
  };
  weight?: number; // gramos

  // Propiedades para tipos de venta (pack, mayorista)
  saleType?: 'unidad' | 'pack' | 'mayorista'; // DEPRECATED for product config (used for cart items)
  
  // Configuración de Packs
  packEnabled?: boolean;
  unitsPerPack?: number;
  packDiscount?: number; // Porcentaje de descuento (0-100)

  // Configuración Mayorista (Crudo)
  mayoristaEnabled?: boolean;
  wholesaleUnits?: number; // Mínimo de unidades para precio mayorista
  wholesaleDiscount?: number; // Porcentaje de descuento (0-100)
  wholesaleImage?: string; // Imagen del producto crudo
  wholesaleDescription?: string; // Nota legal o descripción crudo
}

export interface CartItem extends Product {
  quantity: number;
}

export type OrderStatus = 'pending' | 'payment_pending' | 'paid' | 'preparing' | 'shipped' | 'delivered' | 'cancelled' | 'to_coordinate';

export type ShippingMethod = 'moto' | 'correo' | 'retiro' | 'to_coordinate';

export interface OrderItem {
  product_id: number;
  name: string;
  price: number;
  quantity: number;
  image: string;
}

export interface Order {
  id: string;
  order_number: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  customer_address?: string;
  customer_city?: string;
  customer_province?: string;
  customer_postal_code?: string;
  items: OrderItem[];
  subtotal: number;
  shipping_cost: number;
  total: number;
  shipping_method: ShippingMethod;
  status: OrderStatus;
  payment_id?: string;
  payment_status?: string;
  tracking_number?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface ShippingConfig {
  id: string;
  store_address: string;
  store_lat: number;
  store_lng: number;
  store_hours: string;
  moto_free_threshold: number; // Monto mínimo para envío gratis en moto
  moto_radius_km: number; // Radio en km para envío en moto
  correo_cost: number; // Costo fijo de envío por correo
  // Campos legacy o calculados en runtime si fuera necesario
  moto_base_fee?: number;
  moto_fee_per_km?: number;
  moto_base_distance_km?: number;
  created_at: string;
  updated_at: string;
}

export interface ShippingZone {
  id: string;
  name: string;
  price: number;
  free_threshold?: number;
  zip_ranges: { min: number; max: number }[];
  active: boolean;
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
}

export enum ViewState {
  HOME = 'HOME',
  CHECKOUT = 'CHECKOUT',
  SUCCESS = 'SUCCESS'
}