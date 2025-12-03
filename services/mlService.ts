// Minimal MercadoLibre service placeholders
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
  return url.toString();
}
