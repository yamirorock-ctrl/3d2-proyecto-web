-- =====================================================
-- SISTEMA DE PEDIDOS Y ENVÍOS - 3D2 STORE
-- =====================================================
-- Ejecutar en Supabase SQL Editor

-- 1. TABLA DE CONFIGURACIÓN DE ENVÍOS
CREATE TABLE IF NOT EXISTS shipping_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_address text NOT NULL,
  store_lat numeric(10, 8) NOT NULL,
  store_lng numeric(11, 8) NOT NULL,
  store_hours text NOT NULL,
  moto_free_threshold numeric(10, 2) DEFAULT 40000,
  moto_radius_km numeric(5, 2) DEFAULT 20,
  correo_cost numeric(10, 2) DEFAULT 3000,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. TABLA DE PEDIDOS
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text UNIQUE NOT NULL,
  customer_name text NOT NULL,
  customer_email text NOT NULL,
  customer_phone text NOT NULL,
  customer_address text,
  customer_city text,
  customer_province text,
  customer_postal_code text,
  items jsonb NOT NULL,
  subtotal numeric(10, 2) NOT NULL,
  shipping_cost numeric(10, 2) DEFAULT 0,
  total numeric(10, 2) NOT NULL,
  shipping_method text NOT NULL CHECK (shipping_method IN ('moto', 'correo', 'retiro', 'to_coordinate')),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'payment_pending', 'paid', 'preparing', 'shipped', 'delivered', 'cancelled', 'to_coordinate')),
  payment_id text,
  payment_status text,
  tracking_number text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. ÍNDICES PARA OPTIMIZAR BÚSQUEDAS
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);

-- 4. FUNCIÓN PARA GENERAR NÚMEROS DE ORDEN
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS text AS $$
DECLARE
  new_number text;
  exists boolean;
BEGIN
  LOOP
    -- Formato: 3D2-YYYYMMDD-XXXX (ej: 3D2-20251130-0001)
    new_number := '3D2-' || to_char(now(), 'YYYYMMDD') || '-' || 
                  LPAD(floor(random() * 10000)::text, 4, '0');
    
    -- Verificar si ya existe
    SELECT EXISTS(SELECT 1 FROM orders WHERE order_number = new_number) INTO exists;
    
    EXIT WHEN NOT exists;
  END LOOP;
  
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- 5. TRIGGER PARA AUTO-GENERAR NÚMERO DE ORDEN
CREATE OR REPLACE FUNCTION set_order_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    NEW.order_number := generate_order_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_order_number
BEFORE INSERT ON orders
FOR EACH ROW
EXECUTE FUNCTION set_order_number();

-- 6. TRIGGER PARA ACTUALIZAR updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_orders_updated_at
BEFORE UPDATE ON orders
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_shipping_config_updated_at
BEFORE UPDATE ON shipping_config
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- 7. ROW LEVEL SECURITY (RLS)
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_config ENABLE ROW LEVEL SECURITY;

-- Políticas para orders
DROP POLICY IF EXISTS "Permitir lectura pública de orders" ON orders;
CREATE POLICY "Permitir lectura pública de orders" ON orders
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir inserción pública de orders" ON orders;
CREATE POLICY "Permitir inserción pública de orders" ON orders
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir actualización pública de orders" ON orders;
CREATE POLICY "Permitir actualización pública de orders" ON orders
  FOR UPDATE USING (true);

-- Políticas para shipping_config
DROP POLICY IF EXISTS "Permitir lectura pública de shipping_config" ON shipping_config;
CREATE POLICY "Permitir lectura pública de shipping_config" ON shipping_config
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir actualización pública de shipping_config" ON shipping_config;
CREATE POLICY "Permitir actualización pública de shipping_config" ON shipping_config
  FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Permitir inserción pública de shipping_config" ON shipping_config;
CREATE POLICY "Permitir inserción pública de shipping_config" ON shipping_config
  FOR INSERT WITH CHECK (true);

-- 8. INSERTAR CONFIGURACIÓN INICIAL
-- Coordenadas de Amado Nervo 85, El Jagüel, Esteban Echeverría
INSERT INTO shipping_config (
  store_address,
  store_lat,
  store_lng,
  store_hours,
  moto_free_threshold,
  moto_radius_km,
  correo_cost
) VALUES (
  'Amado Nervo 85, El Jagüel, Esteban Echeverría, Buenos Aires (CP 1842)',
  -34.8014,
  -58.4622,
  'Lunes a Viernes de 10:00 a 18:00 hs',
  40000,
  20,
  3000
)
ON CONFLICT DO NOTHING;

-- =====================================================
-- VERIFICACIÓN
-- =====================================================
-- Ejecutá estas queries para verificar que todo se creó correctamente:

-- SELECT * FROM shipping_config;
-- SELECT * FROM orders;
