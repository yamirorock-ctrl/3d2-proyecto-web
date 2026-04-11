-- Tabla para almacenar tokens de MercadoLibre
create table if not exists ml_tokens (
  user_id text primary key,
  access_token text not null,
  refresh_token text not null,
  expires_in integer,
  scope text,
  token_type text,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- Habilitar RLS
alter table ml_tokens enable row level security;

-- Políticas permisivas para permitir que la API (con anon key) lea y escriba
-- NOTA: En producción idealmente usaríamos service_role, pero la implementación actual usa anon key.
CREATE POLICY "Enable read access for all users" ON ml_tokens FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON ml_tokens FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON ml_tokens FOR UPDATE USING (true);

comment on table ml_tokens is 'Tokens de acceso de MercadoLibre para cotización de envíos';
