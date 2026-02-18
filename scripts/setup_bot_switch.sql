-- COPIA Y PEGA ESTO EN EL SQL EDITOR DE SUPABASE

-- 1. Crear tabla de configuración (si no existe)
CREATE TABLE IF NOT EXISTS app_settings (
  id INT PRIMARY KEY DEFAULT 1,
  bot_enabled BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Insertar configuración por defecto (Bot Encendido)
INSERT INTO app_settings (id, bot_enabled)
VALUES (1, TRUE)
ON CONFLICT (id) DO NOTHING;

-- 3. Habilitar acceso público (para que el Admin Panel pueda cambiarlo)
-- IMPORTANTE: En producción deberías restringir esto a solo usuarios autenticados.
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON app_settings
  FOR SELECT USING (true);

CREATE POLICY "Enable update access for all users" ON app_settings
  FOR UPDATE USING (true);

-- 4. Notificar al usuario
SELECT 'Tabla app_settings creada y bot activado' as result;
