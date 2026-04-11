-- Actualización de esquema para Packs y Mayoristas
-- Ejecutar en Supabase SQL Editor

-- 1. Agregar columnas para descuentos y configuración
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS pack_discount numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS wholesale_discount numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS wholesale_min_units numeric DEFAULT 10,
ADD COLUMN IF NOT EXISTS wholesale_image text,
ADD COLUMN IF NOT EXISTS wholesale_description text;

-- Asegurarse de que las columnas existentes también estén (si no se crearon antes)
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS pack_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS mayorista_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS units_per_pack numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS wholesale_units numeric DEFAULT 0; -- Alias para min units legacy

-- Comentarios para documentación
COMMENT ON COLUMN public.products.pack_discount IS 'Porcentaje de descuento para packs (0-100)';
COMMENT ON COLUMN public.products.wholesale_discount IS 'Porcentaje de descuento para mayorista/crudo (0-100)';
