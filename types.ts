export interface ProductImage {
  url: string;
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
}

export interface CartItem extends Product {
  quantity: number;
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