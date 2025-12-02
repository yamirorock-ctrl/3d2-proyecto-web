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
  created_at: string;
  updated_at: string;
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