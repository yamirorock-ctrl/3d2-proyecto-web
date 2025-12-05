// Simple client-side auth helpers using Web Crypto API
export async function hashPassword(password: string, salt = ''): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(salt + password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

// Generate unique session token
function generateSessionToken(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

// Session management constants
const MAX_ACTIVE_SESSIONS = 1; // Solo una sesión admin simultánea
const SESSION_STORAGE_KEY = 'admin_sessions';
const CURRENT_SESSION_KEY = 'admin_current_session';

interface Session {
  token: string;
  createdAt: number;
  lastActivity: number;
  userAgent: string;
}

// Get all active sessions
export function getActiveSessions(): Session[] {
  try {
    const data = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!data) return [];
    const sessions: Session[] = JSON.parse(data);
    // Filter out expired sessions (older than 7 days)
    const now = Date.now();
    const validSessions = sessions.filter(s => (now - s.lastActivity) < 7 * 24 * 60 * 60 * 1000);
    if (validSessions.length !== sessions.length) {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(validSessions));
    }
    return validSessions;
  } catch (e) {
    return [];
  }
}

// Create new session (returns false if limit reached)
export function createSession(): { success: boolean; message?: string; replaced?: boolean } {
  let sessions = getActiveSessions();
  // Si ya hay una sesión activa, reemplazar la más antigua automáticamente
  let replaced = false;
  if (sessions.length >= MAX_ACTIVE_SESSIONS) {
    // Ordenar por createdAt asc y quitar la primera (más vieja)
    sessions.sort((a,b) => a.createdAt - b.createdAt);
    sessions = sessions.slice(1); // descartar la más antigua
    replaced = true;
  }
  const newSession: Session = {
    token: generateSessionToken(),
    createdAt: Date.now(),
    lastActivity: Date.now(),
    userAgent: navigator.userAgent.substring(0, 100)
  };
  sessions.push(newSession);
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessions));
  sessionStorage.setItem(CURRENT_SESSION_KEY, newSession.token);
  return { success: true, replaced };
}

// Update session activity
export function updateSessionActivity(): void {
  const currentToken = sessionStorage.getItem(CURRENT_SESSION_KEY);
  if (!currentToken) return;
  
  const sessions = getActiveSessions();
  const session = sessions.find(s => s.token === currentToken);
  if (session) {
    session.lastActivity = Date.now();
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessions));
  }
}

// Validate current session
export function isSessionValid(): boolean {
  const currentToken = sessionStorage.getItem(CURRENT_SESSION_KEY);
  if (!currentToken) return false;
  
  const sessions = getActiveSessions();
  return sessions.some(s => s.token === currentToken);
}

// Close current session
export function closeCurrentSession(): void {
  const currentToken = sessionStorage.getItem(CURRENT_SESSION_KEY);
  if (!currentToken) return;
  
  const sessions = getActiveSessions();
  const filtered = sessions.filter(s => s.token !== currentToken);
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(filtered));
  sessionStorage.removeItem(CURRENT_SESSION_KEY);
}

// Close all sessions (for logout)
export function closeAllSessions(): void {
  localStorage.removeItem(SESSION_STORAGE_KEY);
  sessionStorage.removeItem(CURRENT_SESSION_KEY);
}

// Set authenticated state. If `persistent` is true, use localStorage and optionally set expiry (in days).
export function setAuthenticated(persistent = false, days?: number): { success: boolean; message?: string; replaced?: boolean } {
  const sessionResult = createSession();
  if (!sessionResult.success) {
    return sessionResult;
  }
  
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
  
  return { success: true, replaced: sessionResult.replaced };
}

export function clearAuthenticated() {
  closeCurrentSession();
  try {
    sessionStorage.removeItem('admin_authenticated');
  } catch (e) {}
  try {
    localStorage.removeItem('admin_authenticated');
    localStorage.removeItem('admin_auth_expires');
  } catch (e) {}
}

export function isAuthenticated(): boolean {
  // Validate session first
  if (!isSessionValid()) {
    clearAuthenticated();
    return false;
  }
  
  // Update activity
  updateSessionActivity();
  
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

// --- Failed attempts / lockout helpers ---
const FAILED_KEY = 'admin_failed_attempts';
const LOCK_UNTIL_KEY = 'admin_lock_until';

export function getFailedAttempts(): number {
  try {
    const v = localStorage.getItem(FAILED_KEY);
    return v ? Number(v) || 0 : 0;
  } catch (e) {
    return 0;
  }
}

export function resetFailedAttempts() {
  try {
    localStorage.removeItem(FAILED_KEY);
    localStorage.removeItem(LOCK_UNTIL_KEY);
  } catch (e) {}
}

export function getLockUntil(): number | null {
  try {
    const v = localStorage.getItem(LOCK_UNTIL_KEY);
    if (!v) return null;
    const n = Number(v);
    if (Number.isNaN(n)) return null;
    return n;
  } catch (e) {
    return null;
  }
}

export function isLocked(): { locked: boolean; until?: number } {
  const until = getLockUntil();
  if (!until) return { locked: false };
  if (Date.now() > until) {
    // expired -> clear
    resetFailedAttempts();
    return { locked: false };
  }
  return { locked: true, until };
}

// Record a failed attempt. If attempts reach `maxAttempts`, set a lock for `lockMinutes`.
export function recordFailedAttempt(maxAttempts = 4, lockMinutes = 30): { attempts: number; locked: boolean; until?: number } {
  try {
    const cur = getFailedAttempts();
    const next = cur + 1;
    localStorage.setItem(FAILED_KEY, String(next));
    if (next >= maxAttempts) {
      const until = Date.now() + lockMinutes * 60 * 1000;
      localStorage.setItem(LOCK_UNTIL_KEY, String(until));
      return { attempts: next, locked: true, until };
    }
    return { attempts: next, locked: false };
  } catch (e) {
    return { attempts: 0, locked: false };
  }
}

// --- Per-user failed attempts / lockout helpers (for registered users) ---
function userKey(base: string, username: string) {
  // keep key simple but avoid collisions
  return `${base}_${encodeURIComponent(username)}`;
}

export function getUserFailedAttempts(username: string): number {
  try {
    const v = localStorage.getItem(userKey(FAILED_KEY, username));
    return v ? Number(v) || 0 : 0;
  } catch (e) {
    return 0;
  }
}

export function resetUserFailedAttempts(username: string) {
  try {
    localStorage.removeItem(userKey(FAILED_KEY, username));
    localStorage.removeItem(userKey(LOCK_UNTIL_KEY, username));
  } catch (e) {}
}

export function getUserLockUntil(username: string): number | null {
  try {
    const v = localStorage.getItem(userKey(LOCK_UNTIL_KEY, username));
    if (!v) return null;
    const n = Number(v);
    if (Number.isNaN(n)) return null;
    return n;
  } catch (e) {
    return null;
  }
}

export function isUserLocked(username: string): { locked: boolean; until?: number } {
  const until = getUserLockUntil(username);
  if (!until) return { locked: false };
  if (Date.now() > until) {
    resetUserFailedAttempts(username);
    return { locked: false };
  }
  return { locked: true, until };
}

export function recordUserFailedAttempt(username: string, maxAttempts = 4, lockMinutes = 30): { attempts: number; locked: boolean; until?: number } {
  try {
    const key = userKey(FAILED_KEY, username);
    const cur = Number(localStorage.getItem(key)) || 0;
    const next = cur + 1;
    localStorage.setItem(key, String(next));
    if (next >= maxAttempts) {
      const until = Date.now() + lockMinutes * 60 * 1000;
      localStorage.setItem(userKey(LOCK_UNTIL_KEY, username), String(until));
      return { attempts: next, locked: true, until };
    }
    return { attempts: next, locked: false };
  } catch (e) {
    return { attempts: 0, locked: false };
  }
}

// --- Simple current user session helpers (for non-admin users) ---
const CURRENT_USER_KEY = 'current_user';
const CURRENT_USER_EXPIRES = 'current_user_expires';

export function setCurrentUser(username: string, persistent = false, days?: number) {
  try {
    if (persistent) {
      localStorage.setItem(CURRENT_USER_KEY, username);
      if (days && days > 0) {
        const expiresAt = Date.now() + days * 24 * 60 * 60 * 1000;
        localStorage.setItem(CURRENT_USER_EXPIRES, String(expiresAt));
      } else {
        localStorage.removeItem(CURRENT_USER_EXPIRES);
      }
    } else {
      sessionStorage.setItem(CURRENT_USER_KEY, username);
      sessionStorage.removeItem(CURRENT_USER_EXPIRES);
    }
  } catch (e) {}
}

export function getCurrentUser(): string | null {
  try {
    const s = sessionStorage.getItem(CURRENT_USER_KEY);
    if (s) return s;
    const l = localStorage.getItem(CURRENT_USER_KEY);
    if (!l) return null;
    const exp = localStorage.getItem(CURRENT_USER_EXPIRES);
    if (!exp) return l;
    const n = Number(exp);
    if (Number.isNaN(n)) return l;
    if (Date.now() > n) {
      // expired
      localStorage.removeItem(CURRENT_USER_KEY);
      localStorage.removeItem(CURRENT_USER_EXPIRES);
      return null;
    }
    return l;
  } catch (e) {
    return null;
  }
}

export function clearCurrentUser() {
  try { sessionStorage.removeItem(CURRENT_USER_KEY); } catch (e) {}
  try { localStorage.removeItem(CURRENT_USER_KEY); localStorage.removeItem(CURRENT_USER_EXPIRES); } catch (e) {}
}

