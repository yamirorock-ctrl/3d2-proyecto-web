-- Tabla para almacenar información de envíos de MercadoLibre
-- Ejecutar en Supabase SQL Editor

CREATE TABLE IF NOT EXISTS shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  ml_shipment_id TEXT, -- ID del envío en MercadoLibre
  tracking_number TEXT, -- Número de seguimiento
  carrier TEXT, -- Transportista (andreani, correo_argentino, custom, etc.)
  status TEXT DEFAULT 'pending', -- Estado: pending, ready_to_ship, shipped, delivered, cancelled
  estimated_delivery TIMESTAMP, -- Fecha estimada de entrega
  shipping_method_id INTEGER, -- ID del método de envío seleccionado en ML
  cost DECIMAL(10, 2), -- Costo del envío
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Índices para mejorar las consultas
CREATE INDEX IF NOT EXISTS shipments_order_id_idx ON shipments(order_id);
CREATE INDEX IF NOT EXISTS shipments_ml_shipment_id_idx ON shipments(ml_shipment_id);
CREATE INDEX IF NOT EXISTS shipments_status_idx ON shipments(status);

-- Agregar columnas a la tabla orders si no existen
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'tracking_number'
  ) THEN
    ALTER TABLE orders ADD COLUMN tracking_number TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'ml_shipment_id'
  ) THEN
    ALTER TABLE orders ADD COLUMN ml_shipment_id TEXT;
  END IF;
END $$;

-- Comentarios para documentación
COMMENT ON TABLE shipments IS 'Información de envíos sincronizados con MercadoLibre';
COMMENT ON COLUMN shipments.ml_shipment_id IS 'ID del envío en la API de MercadoLibre';
COMMENT ON COLUMN shipments.tracking_number IS 'Número de seguimiento del paquete';
COMMENT ON COLUMN shipments.status IS 'Estados: pending, ready_to_ship, shipped, delivered, cancelled';
