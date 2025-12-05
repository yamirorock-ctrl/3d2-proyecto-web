/**
 * Servicio de MercadoEnvíos - Integración con MercadoLibre Shipping API
 */

const ML_ACCESS_TOKEN_KEY = 'ml_access_token';

interface ShippingOption {
  id: number;
  name: string;
  shipping_method_id: number;
  cost: number;
  currency_id: string;
  estimated_delivery: {
    date: string;
    time_from: string;
    time_to: string;
  } | null;
  list_cost: number;
  free_shipping: boolean;
}

interface ShippingQuoteParams {
  zipCodeFrom: string;
  zipCodeTo: string;
  dimensions: {
    width: number;  // cm
    height: number; // cm
    length: number; // cm
    weight: number; // gramos
  };
}

interface CreateShipmentParams {
  mode: 'me2' | 'custom'; // me2 = MercadoEnvíos, custom = logística propia
  orderId: string;
  receiver: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    address: {
      street_name: string;
      street_number: string;
      zip_code: string;
      city: string;
      state: string;
      country: string;
      floor?: string;
      apartment?: string;
      comments?: string;
    };
  };
  items: Array<{
    id: string;
    title: string;
    quantity: number;
    dimensions: string; // "10x10x10,1000" (ancho x alto x largo, peso en gramos)
  }>;
  shippingMethodId?: number; // ID del método de envío seleccionado
}

/**
 * Obtener token de acceso de ML desde localStorage
 */
function getMLAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ML_ACCESS_TOKEN_KEY);
}

/**
 * Cotizar opciones de envío con MercadoEnvíos
 */
export async function getShippingOptions(params: ShippingQuoteParams): Promise<ShippingOption[]> {
  const token = getMLAccessToken();
  
  if (!token) {
    console.error('[ML Shipping] No hay token de acceso. Conecta MercadoLibre primero.');
    return [];
  }

  try {
    const { zipCodeFrom, zipCodeTo, dimensions } = params;
    
    // API de cotización de envíos: GET /shipments/options
    const url = new URL('https://api.mercadolibre.com/shipments/options');
    url.searchParams.append('zip_code_from', zipCodeFrom);
    url.searchParams.append('zip_code_to', zipCodeTo);
    url.searchParams.append('dimensions', `${dimensions.width}x${dimensions.height}x${dimensions.length},${dimensions.weight}`);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.error('[ML Shipping] Error al obtener opciones de envío:', error);
      return [];
    }

    const data = await response.json();
    
    // La respuesta contiene un array de opciones
    return data.options || [];
  } catch (error) {
    console.error('[ML Shipping] Excepción al cotizar envío:', error);
    return [];
  }
}

/**
 * Crear envío en MercadoLibre después de confirmar pago
 * Debe llamarse desde el backend (Vercel serverless function)
 */
export async function createShipment(params: CreateShipmentParams, accessToken: string): Promise<any> {
  try {
    const body = {
      mode: params.mode,
      order_id: params.orderId,
      receiver_address: params.receiver.address,
      receiver_phone: params.receiver.phone,
      site_id: 'MLA', // Argentina - cambiar según país
      dimensions: params.items[0]?.dimensions, // Usar dimensiones del primer item
      ...(params.shippingMethodId && { shipping_method_id: params.shippingMethodId }),
    };

    const response = await fetch('https://api.mercadolibre.com/shipments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.error('[ML Shipping] Error al crear envío:', error);
      throw new Error('Failed to create shipment');
    }

    return await response.json();
  } catch (error) {
    console.error('[ML Shipping] Excepción al crear envío:', error);
    throw error;
  }
}

/**
 * Obtener información de un envío
 */
export async function getShipmentInfo(shipmentId: string): Promise<any> {
  const token = getMLAccessToken();
  
  if (!token) {
    throw new Error('No ML access token available');
  }

  try {
    const response = await fetch(`https://api.mercadolibre.com/shipments/${shipmentId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to get shipment info');
    }

    return await response.json();
  } catch (error) {
    console.error('[ML Shipping] Error al obtener info de envío:', error);
    throw error;
  }
}

/**
 * Calcular dimensiones estimadas del carrito
 * Esto es temporal - idealmente cada producto debería tener dimensiones en BD
 */
export function estimateCartDimensions(items: any[]): {
  width: number;
  height: number;
  length: number;
  weight: number;
} {
  // Valores por defecto para productos de impresión 3D
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  
  return {
    width: 15,  // cm
    height: 15, // cm
    length: 15 * itemCount, // aumenta con cantidad
    weight: 500 * itemCount, // gramos - 500g por item aprox
  };
}
