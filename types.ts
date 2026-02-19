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
  ml_title?: string; // Título específico para MercadoLibre
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
  
  // MercadoLibre / Identificación
  brand?: string;
  model?: string;
  gtin?: string; // EAN/UPC
  mpn?: string; // Part Number
  
  // Atributos Flexibles de ML (JSON)
  ml_attributes?: Record<string, any>; 
  
  // Estado de Sincronización ML
  ml_item_id?: string | null;
  ml_status?: string | null;
  ml_permalink?: string | null;
  last_ml_sync?: string | null; 

  // Propiedades para tipos de venta (pack, mayorista)
  saleType?: 'unidad' | 'pack' | 'mayorista'; // DEPRECATED for product config (used for cart items)
  
  // Configuración de Packs
  unitEnabled?: boolean; // Habilitar venta por unidad
  packEnabled?: boolean;
  unitsPerPack?: number;
  packDiscount?: number; // Porcentaje de descuento (0-100)

  // Configuración Mayorista (Crudo)
  mayoristaEnabled?: boolean;
  wholesaleUnits?: number; // Mínimo de unidades para precio mayorista
  wholesaleDiscount?: number; // Porcentaje de descuento (0-100)
  wholesaleImage?: string; // Imagen del producto crudo
  wholesaleDescription?: string; // Nota legal o descripción crudo
  
  // Customization Options
  customizationOptions?: {
    models?: string[];
    colors?: string[];
  };

  // Opciones seleccionadas por el usuario (Contexto de compra)
  selectedOptions?: {
    model?: string;
    color?: string;
  };

  // Consumibles / Receta (Gestión de Stock de Materia Prima)
  consumables?: {
    material: string; // Nombre exacto del insumo en 'raw_materials'
    quantity: number; // Cantidad a descontar por unidad vendida
  }[];

  // Distribución de Color (Estimación de Filamento)
  colorPercentage?: {
    color: string; // 'Blanco', 'Rojo', etc.
    percentage: number; // 0-100
  }[];
}

export interface CartItem extends Product {
  quantity: number;
  selectedOptions?: {
    model?: string;
    color?: string;
  };
}

export type OrderStatus = 'pending' | 'payment_pending' | 'paid' | 'preparing' | 'shipped' | 'delivered' | 'cancelled' | 'to_coordinate' | 'processing' | 'completed';

export type ShippingMethod = 'moto' | 'correo' | 'retiro' | 'to_coordinate';

export interface OrderItem {
  product_id: number;
  name: string;
  price: number;
  quantity: number;
  image: string;
  selected_options?: {
    model?: string;
    color?: string;
  };
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
  payment_method?: string;
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

export interface Expense {
  id: string;
  date: string; // ISO Date string (YYYY-MM-DD)
  amount: number;
  category: 'Filamento' | 'Madera' | 'Insumos' | 'Mantenimiento' | 'Publicidad' | 'Otros';
  subcategory?: string; // e.g. 'PLA', 'PETG', 'MDF 3mm'
  description?: string;
  created_at?: string;
}

export interface RawMaterial {
  id: string;
  name: string;
  category: 'Filamento' | 'Madera' | 'Insumos' | 'Otros';
  quantity: number;
  unit: string; // 'rollos', 'placas', 'kg'
  min_threshold: number;
}

export interface SocialQueueItem {
  id: string;
  original_source: 'instagram' | 'manual' | 'other';
  original_post_id?: string;
  status: 'pending' | 'posted' | 'failed' | 'skipped';
  scheduled_for: string; // ISO Date String
  platform_target: 'pinterest' | 'google_business' | 'facebook' | 'all';
  metadata?: {
    product_link?: string;
    image_url?: string;
    pinterest_title?: string;
    pinterest_description?: string;
    caption?: string;
  };
  created_at?: string;
  updated_at?: string;
}