-- Add MercadoLibre specific columns to the products table
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS ml_item_id text,
ADD COLUMN IF NOT EXISTS ml_status text DEFAULT 'pending', -- active, paused, closed, pending
ADD COLUMN IF NOT EXISTS ml_title text, -- Title optimized for MercadoLibre
ADD COLUMN IF NOT EXISTS ml_permalink text, -- Public URL of the item
ADD COLUMN IF NOT EXISTS last_ml_sync timestamp with time zone;

-- Optional: Index on ml_item_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_products_ml_item_id ON public.products(ml_item_id);

-- Comment
COMMENT ON COLUMN public.products.ml_item_id IS 'MercadoLibre Item ID (e.g. MLA123456)';
