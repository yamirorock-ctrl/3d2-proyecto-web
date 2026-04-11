
-- Agregar columnas JSONB para soportar Recetas y Colores
ALTER TABLE products ADD COLUMN IF NOT EXISTS consumables JSONB DEFAULT '[]';
ALTER TABLE products ADD COLUMN IF NOT EXISTS color_percentage JSONB DEFAULT '[]';
