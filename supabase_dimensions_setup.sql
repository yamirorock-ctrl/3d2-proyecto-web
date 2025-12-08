-- Add dimensions column to products table
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS dimensions jsonb DEFAULT '{"width": 10, "height": 10, "length": 10}';

-- Add weight column if it doesn't exist (it should, but safety first)
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS weight numeric DEFAULT 0;
