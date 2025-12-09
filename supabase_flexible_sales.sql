-- Add unit_enabled column to products table
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS unit_enabled boolean DEFAULT true;

-- Update existing products to have unit_enabled = true (safe default)
UPDATE public.products SET unit_enabled = true WHERE unit_enabled IS NULL;
