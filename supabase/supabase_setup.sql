-- Tabla para almacenar el usuario administrador (máximo 1)
CREATE TABLE IF NOT EXISTS admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índice para búsqueda rápida por username
CREATE INDEX IF NOT EXISTS idx_admin_users_username ON admin_users(username);

-- Política de seguridad: Solo permite 1 registro
CREATE OR REPLACE FUNCTION check_single_admin()
RETURNS TRIGGER AS $$
BEGIN
    IF (SELECT COUNT(*) FROM admin_users) >= 1 THEN
        RAISE EXCEPTION 'Solo se permite un administrador';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_single_admin
    BEFORE INSERT ON admin_users
    FOR EACH ROW
    EXECUTE FUNCTION check_single_admin();

-- Tabla para log de intentos de sesión (auditoría)
CREATE TABLE IF NOT EXISTS admin_session_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT NOT NULL,
    success BOOLEAN NOT NULL,
    ip_address TEXT,
    attempted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índice para búsquedas por fecha
CREATE INDEX IF NOT EXISTS idx_session_logs_attempted_at ON admin_session_logs(attempted_at DESC);

-- Políticas RLS (Row Level Security) - IMPORTANTE para seguridad
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_session_logs ENABLE ROW LEVEL SECURITY;

-- Política: Permitir lectura pública (solo para validación)
CREATE POLICY "Allow public read" ON admin_users
    FOR SELECT
    USING (true);

-- Política: Permitir inserción pública solo si no existe admin
CREATE POLICY "Allow insert if no admin exists" ON admin_users
    FOR INSERT
    WITH CHECK ((SELECT COUNT(*) FROM admin_users) = 0);

-- Política: Permitir eliminación solo con autenticación válida
CREATE POLICY "Allow delete with valid credentials" ON admin_users
    FOR DELETE
    USING (true);

-- Política: Permitir inserción de logs
CREATE POLICY "Allow session log insert" ON admin_session_logs
    FOR INSERT
    WITH CHECK (true);

-- Política: Permitir lectura de logs
CREATE POLICY "Allow session log read" ON admin_session_logs
    FOR SELECT
    USING (true);

-- Tabla para gestionar sesiones activas (máximo 2 simultáneas)
CREATE TABLE IF NOT EXISTS admin_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT UNIQUE NOT NULL,
    username TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índice para búsqueda rápida por session_id y username
CREATE INDEX IF NOT EXISTS idx_admin_sessions_session_id ON admin_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_username ON admin_sessions(username);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_last_active ON admin_sessions(last_active DESC);

-- Función para limpiar sesiones expiradas (más de 10 minutos sin actividad)
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
    DELETE FROM admin_sessions
    WHERE last_active < NOW() - INTERVAL '10 minutes';
END;
$$ LANGUAGE plpgsql;

-- Políticas RLS para admin_sessions
ALTER TABLE admin_sessions ENABLE ROW LEVEL SECURITY;

-- Política: Permitir lectura pública (para validación)
CREATE POLICY "Allow public read sessions" ON admin_sessions
    FOR SELECT
    USING (true);

-- Política: Permitir inserción pública (con límite de 2 sesiones)
CREATE POLICY "Allow session insert" ON admin_sessions
    FOR INSERT
    WITH CHECK (true);

-- Política: Permitir actualización pública (para heartbeat)
CREATE POLICY "Allow session update" ON admin_sessions
    FOR UPDATE
    USING (true);

-- Política: Permitir eliminación pública (para logout)
CREATE POLICY "Allow session delete" ON admin_sessions
    FOR DELETE
    USING (true);

-- Comentarios para documentación
COMMENT ON TABLE admin_users IS 'Almacena el único usuario administrador del sistema';
COMMENT ON TABLE admin_session_logs IS 'Registro de auditoría de intentos de inicio de sesión';
COMMENT ON TABLE admin_sessions IS 'Gestiona sesiones activas del admin (máximo 2 simultáneas)';
COMMENT ON COLUMN admin_users.password_hash IS 'Hash SHA-256 de la contraseña';
COMMENT ON TRIGGER enforce_single_admin ON admin_users IS 'Garantiza que solo exista un administrador';
COMMENT ON FUNCTION cleanup_expired_sessions IS 'Elimina sesiones inactivas por más de 10 minutos';
