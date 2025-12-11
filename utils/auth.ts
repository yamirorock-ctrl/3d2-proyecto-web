
// Deprecated auth utilities.
// Most functionality has been replaced by Supabase Auth (AuthContext.tsx).

export async function hashPassword(password: string, salt = ''): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(salt + password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

// Deprecated
export function isAuthenticated() { return false; }
export function isLocked() { return { locked: false }; }
export function getFailedAttempts() { return 0; }
export function resetFailedAttempts() {}
export function recordFailedAttempt() { return { attempts: 0, locked: false }; }
export function setAuthenticated() { return { success: false }; }
export function clearAuthenticated() {}

// User specific Deprecated
export function getUserFailedAttempts() { return 0; }
export function resetUserFailedAttempts() {}
export function isUserLocked() { return { locked: false }; }
export function recordUserFailedAttempt() { return { attempts: 0, locked: false }; }
export function setCurrentUser() {}
export function getCurrentUser() { return null; }
export function clearCurrentUser() {}
