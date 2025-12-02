import { SupabaseClient } from '@supabase/supabase-js';
import { getClient } from './supabaseService';

// Usar el cliente singleton de supabaseService
function getSupabase(): SupabaseClient | null {
  try {
    return getClient();
  } catch {
    return null;
  }
}

export interface AdminUser {
  id?: string;
  username: string;
  password_hash: string;
  created_at?: string;
}

/**
 * Verifica si Supabase está configurado
 */
export function isSupabaseConfigured(): boolean {
  return getSupabase() !== null;
}

/**
 * Verifica si ya existe un administrador registrado
 */
export async function adminExists(): Promise<{ exists: boolean; error?: string }> {
  const supabase = getSupabase(); if (!supabase) {
    return { exists: false, error: 'Supabase no configurado' };
  }

  try {
    const { data, error } = await supabase
      .from('admin_users')
      .select('id')
      .limit(1);

    if (error) {
      console.error('Error checking admin:', error);
      return { exists: false, error: error.message };
    }

    return { exists: (data && data.length > 0) };
  } catch (e) {
    console.error('Exception checking admin:', e);
    return { exists: false, error: (e as Error).message };
  }
}

/**
 * Registra un nuevo administrador (solo si no existe ninguno)
 */
export async function registerAdmin(username: string, passwordHash: string): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabase(); if (!supabase) {
    return { success: false, error: 'Supabase no configurado' };
  }

  try {
    // Verificar que no exista admin
    const { exists, error: checkError } = await adminExists();
    
    if (checkError) {
      return { success: false, error: checkError };
    }

    if (exists) {
      return { success: false, error: 'Ya existe un administrador registrado' };
    }

    // Insertar nuevo admin
    const { error } = await supabase
      .from('admin_users')
      .insert([
        {
          username,
          password_hash: passwordHash,
          created_at: new Date().toISOString()
        }
      ]);

    if (error) {
      console.error('Error registering admin:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (e) {
    console.error('Exception registering admin:', e);
    return { success: false, error: (e as Error).message };
  }
}

/**
 * Valida las credenciales del administrador
 */
export async function validateAdmin(username: string, passwordHash: string): Promise<{ valid: boolean; error?: string }> {
  const supabase = getSupabase(); if (!supabase) {
    return { valid: false, error: 'Supabase no configurado' };
  }

  try {
    const { data, error } = await supabase
      .from('admin_users')
      .select('username, password_hash')
      .eq('username', username)
      .eq('password_hash', passwordHash)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No se encontró el usuario
        return { valid: false, error: 'Usuario o contraseña incorrectos' };
      }
      console.error('Error validating admin:', error);
      return { valid: false, error: error.message };
    }

    return { valid: data !== null };
  } catch (e) {
    console.error('Exception validating admin:', e);
    return { valid: false, error: (e as Error).message };
  }
}

/**
 * Elimina el administrador (para reset)
 */
export async function deleteAdmin(username: string, passwordHash: string): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabase(); if (!supabase) {
    return { success: false, error: 'Supabase no configurado' };
  }

  try {
    // Primero validar credenciales
    const { valid, error: validError } = await validateAdmin(username, passwordHash);
    
    if (validError || !valid) {
      return { success: false, error: 'Credenciales incorrectas' };
    }

    // Eliminar admin
    const { error } = await supabase
      .from('admin_users')
      .delete()
      .eq('username', username)
      .eq('password_hash', passwordHash);

    if (error) {
      console.error('Error deleting admin:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (e) {
    console.error('Exception deleting admin:', e);
    return { success: false, error: (e as Error).message };
  }
}

/**
 * Registra un intento de sesión
 */
export async function logSessionAttempt(username: string, success: boolean, ipAddress?: string): Promise<void> {
  const supabase = getSupabase(); if (!supabase) return;

  try {
    await supabase
      .from('admin_session_logs')
      .insert([
        {
          username,
          success,
          ip_address: ipAddress || 'unknown',
          attempted_at: new Date().toISOString()
        }
      ]);
  } catch (e) {
    console.error('Error logging session:', e);
  }
}

/**
 * Limpia sesiones expiradas (más de 10 minutos sin actividad)
 */
export async function cleanupExpiredSessions(): Promise<void> {
  const supabase = getSupabase(); if (!supabase) return;

  try {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    await supabase
      .from('admin_sessions')
      .delete()
      .lt('last_active', tenMinutesAgo);
  } catch (e) {
    console.error('Error cleaning expired sessions:', e);
  }
}

/**
 * Crea una nueva sesión de administrador (máximo 2 simultáneas)
 */
export async function createSession(username: string): Promise<{ success: boolean; sessionId?: string; error?: string }> {
  const supabase = getSupabase(); if (!supabase) {
    return { success: false, error: 'Supabase no configurado' };
  }

  try {
    // Limpiar sesiones expiradas primero
    await cleanupExpiredSessions();

    // Contar sesiones activas
    const { data: activeSessions, error: countError } = await supabase
      .from('admin_sessions')
      .select('id, created_at')
      .eq('username', username)
      .order('created_at', { ascending: true });

    if (countError) {
      console.error('Error counting sessions:', countError);
      return { success: false, error: countError.message };
    }

    // Si hay 2 o más sesiones, eliminar la más antigua
    if (activeSessions && activeSessions.length >= 2) {
      const oldestSession = activeSessions[0];
      await supabase
        .from('admin_sessions')
        .delete()
        .eq('id', oldestSession.id);
    }

    // Generar session_id único
    const sessionId = `${username}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Insertar nueva sesión
    const { error: insertError } = await supabase
      .from('admin_sessions')
      .insert([
        {
          session_id: sessionId,
          username,
          created_at: new Date().toISOString(),
          last_active: new Date().toISOString()
        }
      ]);

    if (insertError) {
      console.error('Error creating session:', insertError);
      return { success: false, error: insertError.message };
    }

    return { success: true, sessionId };
  } catch (e) {
    console.error('Exception creating session:', e);
    return { success: false, error: (e as Error).message };
  }
}

/**
 * Valida que una sesión siga activa
 */
export async function validateSession(sessionId: string): Promise<{ valid: boolean; error?: string }> {
  const supabase = getSupabase(); if (!supabase) {
    return { valid: false, error: 'Supabase no configurado' };
  }

  try {
    // Limpiar sesiones expiradas
    await cleanupExpiredSessions();

    const { data, error } = await supabase
      .from('admin_sessions')
      .select('session_id')
      .eq('session_id', sessionId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return { valid: false, error: 'Sesión no encontrada o expirada' };
      }
      console.error('Error validating session:', error);
      return { valid: false, error: error.message };
    }

    return { valid: data !== null };
  } catch (e) {
    console.error('Exception validating session:', e);
    return { valid: false, error: (e as Error).message };
  }
}

/**
 * Renueva una sesión (actualiza last_active para heartbeat)
 */
export async function renewSession(sessionId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabase(); if (!supabase) {
    return { success: false, error: 'Supabase no configurado' };
  }

  try {
    const { error } = await supabase
      .from('admin_sessions')
      .update({ last_active: new Date().toISOString() })
      .eq('session_id', sessionId);

    if (error) {
      console.error('Error renewing session:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (e) {
    console.error('Exception renewing session:', e);
    return { success: false, error: (e as Error).message };
  }
}

/**
 * Elimina una sesión (logout)
 */
export async function deleteSession(sessionId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabase(); if (!supabase) {
    return { success: false, error: 'Supabase no configurado' };
  }

  try {
    const { error } = await supabase
      .from('admin_sessions')
      .delete()
      .eq('session_id', sessionId);

    if (error) {
      console.error('Error deleting session:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (e) {
    console.error('Exception deleting session:', e);
    return { success: false, error: (e as Error).message };
  }
}

