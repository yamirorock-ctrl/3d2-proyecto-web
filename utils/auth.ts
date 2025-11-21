// Simple client-side auth helpers using Web Crypto API
export async function hashPassword(password: string, salt = ''): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(salt + password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

export function setSessionAuthenticated() {
  sessionStorage.setItem('admin_authenticated', '1');
}

export function clearSessionAuthenticated() {
  sessionStorage.removeItem('admin_authenticated');
}

export function isSessionAuthenticated(): boolean {
  return sessionStorage.getItem('admin_authenticated') === '1';
}
