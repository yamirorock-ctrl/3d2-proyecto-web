
// This file is deprecated as we migrated to Supabase Auth.
// It is kept temporarily to avoid breaking unresolved imports, but should be removed.

export const isSupabaseConfigured = () => true;

// Deprecated functions
export const adminExists = async () => ({ exists: false });
export const registerAdmin = async () => ({ success: false, error: 'Deprecated' });
export const validateAdmin = async () => ({ valid: false, error: 'Deprecated' });
export const deleteAdmin = async () => ({ success: false });
export const logSessionAttempt = async () => {};
export const cleanupExpiredSessions = async () => {};
export const createSession = async () => ({ success: false, error: 'Deprecated' });
export const validateSession = async () => ({ valid: false, error: 'Deprecated' });
export const renewSession = async () => ({ success: false });
export const deleteSession = async () => ({ success: false });
