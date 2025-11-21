// Simple client-side auth helpers using Web Crypto API
export async function hashPassword(password: string, salt = ''): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(salt + password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

// Set authenticated state. If `persistent` is true, use localStorage and optionally set expiry (in days).
export function setAuthenticated(persistent = false, days?: number) {
  if (persistent) {
    localStorage.setItem('admin_authenticated', '1');
    if (days && days > 0) {
      const expiresAt = Date.now() + days * 24 * 60 * 60 * 1000;
      localStorage.setItem('admin_auth_expires', String(expiresAt));
    } else {
      localStorage.removeItem('admin_auth_expires');
    }
    // remove any session flag
    sessionStorage.removeItem('admin_authenticated');
  } else {
    sessionStorage.setItem('admin_authenticated', '1');
    sessionStorage.removeItem('admin_auth_expires');
    // do not touch localStorage so persistent login remains if present
  }
}

export function clearAuthenticated() {
  try {
    sessionStorage.removeItem('admin_authenticated');
  } catch (e) {}
  try {
    localStorage.removeItem('admin_authenticated');
    localStorage.removeItem('admin_auth_expires');
  } catch (e) {}
}

export function isAuthenticated(): boolean {
  // sessionStorage takes precedence
  try {
    if (sessionStorage.getItem('admin_authenticated') === '1') return true;
  } catch (e) {}

  try {
    const flag = localStorage.getItem('admin_authenticated');
    if (flag !== '1') return false;
    const exp = localStorage.getItem('admin_auth_expires');
    if (!exp) return true;
    const expiresAt = Number(exp);
    if (Number.isNaN(expiresAt)) return true;
    if (Date.now() > expiresAt) {
      // expired -> clear
      clearAuthenticated();
      return false;
    }
    return true;
  } catch (e) {
    return false;
  }
}
