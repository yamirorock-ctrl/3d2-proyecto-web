-- AGREGAR COLUMNA FLEXIBLE PARA ATRIBUTOS DE MERCADOLIBRE
-- Esto permite guardar cosas como:
-- {"MATE_GOURD_TYPE": "Bocón", "MATE_GOURD_MATERIALS": "Madera"}
-- sin tener que crear una columna por cada atributo nuevo que invente ML.

ALTER TABLE products 
ADD COLUMN IF NOT EXISTS ml_attributes JSONB DEFAULT '{}'::jsonb;

-- Opcional: Índice para búsquedas rápidas dentro del JSONB
CREATE INDEX IF NOT EXISTS idx_products_ml_attributes ON products USING gin (ml_attributes);
