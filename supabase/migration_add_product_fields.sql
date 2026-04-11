-- Add new columns for MercadoLibre 2026 Policy Compliance
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS brand text,
ADD COLUMN IF NOT EXISTS model text,
ADD COLUMN IF NOT EXISTS gtin text,
ADD COLUMN IF NOT EXISTS mpn text;
