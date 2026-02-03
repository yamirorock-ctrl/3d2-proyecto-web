// MercadoLibre Service
// Handles Auth and Product Sync interactions

export function getMLConfig() {
  const appId = (import.meta as any).env?.VITE_ML_APP_ID;
  const redirect = (import.meta as any).env?.VITE_ML_REDIRECT_URI;
  return { appId, redirect };
}

export function getAuthUrl() {
  const { appId, redirect } = getMLConfig();
  if (!appId || !redirect) return null;
  const base = 'https://auth.mercadolibre.com.ar/authorization';
  const url = new URL(base);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', String(appId));
  url.searchParams.set('redirect_uri', String(redirect));
  // Request necessary scopes for posting items and refreshing tokens
  url.searchParams.set('scope', 'offline_access write read');
  return url.toString();
}

export async function predictCategory(title: string) {
  try {
    const response = await fetch(`https://api.mercadolibre.com/sites/MLA/domain_discovery/search?q=${encodeURIComponent(title)}`);
    const data = await response.json();
    if (Array.isArray(data) && data.length > 0) {
      return {
        categoryId: data[0].category_id,
        categoryName: data[0].category_name,
        domainId: data[0].domain_id
      };
    }
    return null;
  } catch (error) {
    console.error('Error predicting category:', error);
    return null;
  }
}

/**
 * Triggers the serverless function to sync a product to MercadoLibre.
 * @param productId ID of the product in Supabase
 * @param userId ID of the admin user (required to fetch the correct ML Token)
 */
export async function syncProductToML(productId: number, userId: string, markupPercentage: number = 25) {
  const apiUrl = (import.meta as any).env.VITE_API_URL || '/api'; // Fallback to relative /api if not set
  
  // Usually in Vercel dev, it's just /api/ml-sync-product
  // In production, also relative.
  const endpoint = `${window.location.origin}/api/ml-sync-product`;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ productId, userId, markupPercentage })
    });

    const data = await response.json();
    return { ok: response.ok, data };
  } catch (error) {
    console.error('Error syncing product to ML:', error);
    return { ok: false, data: { error: error.message } };
  }
}
