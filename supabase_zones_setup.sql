-- Tabla para Zonas de Envío (Moto/Flete propio)
-- Permite definir costos fijos por rangos de Código Postal

CREATE TABLE IF NOT EXISTS public.shipping_zones (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at timestamp with time zone DEFAULT now(),
    name text NOT NULL, -- Ej: "CABA", "GBA Norte 1"
    price numeric NOT NULL DEFAULT 0,
    free_threshold numeric, -- Si la compra supera esto, es gratis en esta zona (NULL = usa global)
    zip_ranges jsonb DEFAULT '[]'::jsonb, -- Array de rangos: [{"min": 1000, "max": 1499}]
    active boolean DEFAULT true
);

-- Habilitar RLS
ALTER TABLE public.shipping_zones ENABLE ROW LEVEL SECURITY;

-- Políticas de seguridad (Público puede leer, Solo Admin puede editar)
CREATE POLICY "Public zones access" ON public.shipping_zones
  FOR SELECT USING (true);

-- Insertar datos iniciales de ejemplo (CABA y GBA)
INSERT INTO public.shipping_zones (name, price, zip_ranges, active)
VALUES 
    ('CABA', 4500, '[{"min": 1000, "max": 1499}]'::jsonb, true),
    ('GBA Zona 1', 7500, '[{"min": 1500, "max": 1899}]'::jsonb, true),
    ('GBA Zona 2', 9500, '[{"min": 1900, "max": 2999}]'::jsonb, true);

-- Comentarios
COMMENT ON TABLE public.shipping_zones IS 'Zonas de envío con precio fijo por rango de CP';
COMMENT ON COLUMN public.shipping_zones.zip_ranges IS 'Formato JSON: [{"min": 1000, "max": 1499}, ...]';
