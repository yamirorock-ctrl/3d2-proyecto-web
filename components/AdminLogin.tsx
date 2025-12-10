import React, { useState, useEffect } from 'react';
import { hashPassword, setAuthenticated, isAuthenticated, recordFailedAttempt, isLocked, getFailedAttempts, resetFailedAttempts, getLockUntil, getActiveSessions, closeAllSessions } from '../utils/auth';
import { adminExists, registerAdmin, validateAdmin, deleteAdmin, isSupabaseConfigured, logSessionAttempt, createSession } from '../services/authService';
import { useNavigate } from 'react-router-dom';

const ADMIN_USER_KEY = 'admin_user';
const ADMIN_HASH_KEY = 'admin_pass_hash';
const ADMIN_SESSION_KEY = 'admin_session_id';
const ADMIN_METADATA_KEY = 'system_metadata'; // Metadata del sistema compartida

const AdminLogin: React.FC = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login'|'setup'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [remember, setRemember] = useState(true);
  const [expiryDays, setExpiryDays] = useState<number>(7);
  const [lockedInfo, setLockedInfo] = useState<{locked:boolean; until?:number}>({ locked: false });
  const [failedAttempts, setFailedAttempts] = useState<number>(0);
  const [activeSessions, setActiveSessions] = useState<number>(0);
  const [useBackend, setUseBackend] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    // Verificación de token temporal (2 minutos de validez)
    if (!isAuthenticated()) {
      try {
        const token = sessionStorage.getItem('admin_entry_token');
        const tsRaw = sessionStorage.getItem('admin_entry_ts');
        
        // Si no hay token, simplemente redirigir a home sin log (evita falsos positivos al desloguearse)
        if (!token || !tsRaw) {
            navigate('/');
            return;
        }

        const secret = ((import.meta as any).env?.VITE_ADMIN_SECRET || 'modozen').trim();
        const now = Date.now();
        const ts = tsRaw ? parseInt(tsRaw, 10) : 0;
        let valid = false;

        const minute = Math.floor(ts / 60000);
        const raw = secret + ':' + minute;
        const expected = btoa(unescape(encodeURIComponent(raw))).replace(/=+$/,'');
        // válido si token coincide y no supera 2 minutos
        if (expected === token && (now - ts) <= 120000) {
          valid = true;
        }

        if (!valid) {
          // Log intento no autorizado SOLO si había token pero era inválido/viejo
          if (isSupabaseConfigured()) {
            logSessionAttempt('UNAUTHORIZED', false).catch(()=>{});
          }
          // Persistir intento local
            try {
              const attemptsRaw = localStorage.getItem('adminAccessAttempts');
              const arr = attemptsRaw ? JSON.parse(attemptsRaw) : [];
              arr.push({ t: Date.now(), type: 'invalid_token' });
              localStorage.setItem('adminAccessAttempts', JSON.stringify(arr.slice(-50)));
            } catch {}
          navigate('/');
          return;
        }
      } catch {
        navigate('/');
        return;
      }
    }

    const checkBackend = async () => {
      const configured = isSupabaseConfigured();
      setUseBackend(configured);
      
      if (configured) {
        // Verificar si existe admin en backend
        const { exists } = await adminExists();
        if (!exists) {
          setMode('setup');
        } else {
          setMode('login');
        }
      } else {
        // Fallback a sistema local
        const existing = localStorage.getItem(ADMIN_USER_KEY);
        setMode(existing ? 'login' : 'setup');
      }
    };
    
    checkBackend();
    
    // Permitir ver la pantalla de login con ?force=1 aunque esté autenticado
    const params = new URLSearchParams(window.location.search);
    const force = params.get('force') === '1';
    if (isAuthenticated() && !force) {
      navigate('/admin');
    }
    // load failed attempts / lock state
    setFailedAttempts(getFailedAttempts());
    setLockedInfo(isLocked());
    // load active sessions count
    setActiveSessions(getActiveSessions().length);
  }, [navigate]);

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username || !password) return alert('Usuario y contraseña requeridos');
    if (password !== password2) return alert('Las contraseñas no coinciden');
    
    setLoading(true);
    
    try {
      const hash = await hashPassword(password, username);
      
      if (useBackend) {
        // Registrar en backend (Supabase)
        const { success, error } = await registerAdmin(username, hash);
        
        if (!success) {
          setLoading(false);
          return alert(`Error al registrar: ${error}`);
        }
        
        // Log exitoso
        await logSessionAttempt(username, true);
      } else {
        // Fallback: sistema local
        const metadata = localStorage.getItem(ADMIN_METADATA_KEY);
        if (metadata) {
          const metadataData = JSON.parse(metadata);
          if (metadataData.adminExists) {
            setLoading(false);
            return alert('⚠️ Ya existe un administrador local.');
          }
        }
        
        const systemMetadata = {
          adminExists: true,
          registeredAt: Date.now(),
          version: '1.0'
        };
        localStorage.setItem(ADMIN_METADATA_KEY, JSON.stringify(systemMetadata));
      }
      
      // Guardar credenciales locales para sesión
      localStorage.setItem(ADMIN_USER_KEY, username);
      localStorage.setItem(ADMIN_HASH_KEY, hash);
      
      const authResult = setAuthenticated(remember, remember ? expiryDays : undefined);
      if (!authResult.success) {
        if (useBackend) {
          await deleteAdmin(username, hash);
        } else {
          localStorage.removeItem(ADMIN_METADATA_KEY);
        }
        setLoading(false);
        return alert(authResult.message || 'Error al autenticar');
      }
      
      resetFailedAttempts();
      setLoading(false);
      try { sessionStorage.removeItem('admin_entry_token'); sessionStorage.removeItem('admin_entry_ts'); } catch {}
      navigate('/admin');
    } catch (error) {
      setLoading(false);
      alert('Error inesperado: ' + (error as Error).message);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const locked = isLocked();
    if (locked.locked) {
      const until = locked.until || Date.now();
      return alert('Cuenta bloqueada hasta: ' + new Date(until).toLocaleString());
    }

    if (!username || !password) return alert('Usuario y contraseña requeridos');
    
    setLoading(true);
    
    try {
      const hash = await hashPassword(password, username);
      let isValid = false;
      
      if (useBackend) {
        // Validar con backend
        const { valid, error } = await validateAdmin(username, hash);
        
        if (error) {
          await logSessionAttempt(username, false);
          const res = recordFailedAttempt(4, 30);
          setFailedAttempts(res.attempts);
          setLockedInfo({ locked: res.locked, until: res.until });
          setLoading(false);
          
          if (res.locked) {
            return alert('Demasiados intentos. Cuenta bloqueada hasta: ' + new Date(res.until).toLocaleString());
          }
          const remaining = Math.max(0, 4 - res.attempts);
          return alert(`Error: ${error}\nIntentos restantes: ${remaining}`);
        }
        
        isValid = valid;
      } else {
        // Validar con sistema local
        const storedUser = localStorage.getItem(ADMIN_USER_KEY);
        const storedHash = localStorage.getItem(ADMIN_HASH_KEY);
        
        if (!storedUser || !storedHash) {
          setLoading(false);
          return alert('No hay cuenta configurada.');
        }
        
        isValid = (username === storedUser && hash === storedHash);
      }
      
      if (isValid) {
        // Crear sesión en Supabase si usamos backend
        if (useBackend) {
          const { success: sessionSuccess, sessionId, error: sessionError } = await createSession(username);
          
          if (!sessionSuccess || !sessionId) {
            setLoading(false);
            return alert('Error al crear sesión: ' + (sessionError || 'Desconocido'));
          }
          
          // Guardar session_id en localStorage
          localStorage.setItem(ADMIN_SESSION_KEY, sessionId);
          await logSessionAttempt(username, true);
        }
        
        // Guardar credenciales locales
        localStorage.setItem(ADMIN_USER_KEY, username);
        localStorage.setItem(ADMIN_HASH_KEY, hash);
        
        const authResult = setAuthenticated(remember, remember ? expiryDays : undefined);
        if (!authResult.success) {
          setLoading(false);
          return alert(authResult.message || 'Error al autenticar');
        }
        
        resetFailedAttempts();
        setLoading(false);
        try { sessionStorage.removeItem('admin_entry_token'); sessionStorage.removeItem('admin_entry_ts'); } catch {}
        navigate('/admin');
      } else {
        if (useBackend) {
          await logSessionAttempt(username, false);
        }
        
        const res = recordFailedAttempt(4, 30);
        setFailedAttempts(res.attempts);
        setLockedInfo({ locked: res.locked, until: res.until });
        setLoading(false);
        
        if (res.locked) {
          return alert('Demasiados intentos. Cuenta bloqueada hasta: ' + new Date(res.until).toLocaleString());
        }
        const remaining = Math.max(0, 4 - res.attempts);
        alert('Contraseña incorrecta. Intentos restantes: ' + remaining);
      }
    } catch (error) {
      setLoading(false);
      alert('Error inesperado: ' + (error as Error).message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">{mode === 'setup' ? 'Configurar cuenta Admin' : 'Ingresar Admin'}</h2>
        
        {/* Indicador de backend */}
        <div className={`p-2 mb-3 rounded-lg text-xs ${useBackend ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-yellow-50 border border-yellow-200 text-yellow-700'}`}>
          {useBackend ? (
            <><span className="font-bold">🔒 Seguridad: Backend activo</span> - Autenticación centralizada con base de datos</>
          ) : (
            <><span className="font-bold">⚠️ Modo local</span> - Configura Supabase para seguridad robusta</>
          )}
        </div>
        
        {/* Información de sesión única (auto-reemplazo) */}
        {mode === 'login' && (
          <div className={`p-3 mb-4 rounded-lg border ${activeSessions > 0 ? 'bg-blue-50 border-blue-200' : 'bg-green-50 border-green-200'}`}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700">Sesión actual (máx 1):</span>
              <span className={`text-sm font-bold ${activeSessions > 0 ? 'text-blue-600' : 'text-green-600'}`}>
                {activeSessions} / 1
              </span>
            </div>
            {activeSessions > 0 ? (
              <div className="mt-2 space-y-2">
                <p className="text-xs text-blue-600">Si inicias aquí, se reemplazará la sesión anterior automáticamente.</p>
                <button
                  type="button"
                  onClick={() => {
                    try {
                      closeAllSessions();
                      setActiveSessions(0);
                      alert('Sesión anterior cerrada. Puedes continuar.');
                    } catch (e) {
                      alert('No se pudo cerrar la sesión anterior');
                    }
                  }}
                  className="w-full px-3 py-2 rounded-md bg-red-600 text-white text-xs hover:bg-red-700"
                >
                  Cerrar sesión existente
                </button>
              </div>
            ) : (
              <p className="text-xs text-green-600 mt-1">No hay sesión previa, listo para iniciar.</p>
            )}
          </div>
        )}
        
        {mode === 'setup' && (
          <div className="p-3 mb-4 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm text-amber-800">
              ⚠️ <strong>Solo se permite 1 administrador.</strong> El primer usuario registrado será el único admin del sistema.
            </p>
          </div>
        )}
        
        <form onSubmit={mode === 'setup' ? handleSetup : handleLogin} className="space-y-4">
          {lockedInfo.locked && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded">
              Cuenta bloqueada hasta: {lockedInfo.until ? new Date(lockedInfo.until).toLocaleString() : '...'}
            </div>
          )}
          <div>
            <label className="block text-sm text-slate-700">Usuario</label>
            <input value={username} onChange={e=>setUsername(e.target.value)} className="mt-1 w-full rounded-md border-gray-200 p-2" />
          </div>
          <div>
            <label className="block text-sm text-slate-700">Contraseña</label>
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)} className="mt-1 w-full rounded-md border-gray-200 p-2" />
          </div>
          {mode === 'setup' && (
            <div>
              <label className="block text-sm text-slate-700">Confirmar contraseña</label>
              <input type="password" value={password2} onChange={e=>setPassword2(e.target.value)} className="mt-1 w-full rounded-md border-gray-200 p-2" />
            </div>
          )}
          <div className="flex items-center gap-3">
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)} />
              <span className="text-sm text-slate-600">Recordarme</span>
            </label>
            {remember && (
              <label className="text-sm text-slate-600">Expira en
                <input type="number" min={1} value={expiryDays} onChange={e=>setExpiryDays(Number(e.target.value))} className="ml-2 w-16 rounded-md border-gray-200 p-1" />
                días
              </label>
            )}
          </div>

          <div className="flex items-center justify-between">
            <button 
              type="submit" 
              disabled={lockedInfo.locked || loading} 
              className="px-4 py-2 bg-teal-600 text-white rounded-md disabled:opacity-50 flex items-center gap-2"
            >
              {loading && (
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              {mode === 'setup' ? 'Crear cuenta' : 'Entrar'}
            </button>
            {/* Botón de borrar cuenta eliminado por seguridad */}
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdminLogin;
