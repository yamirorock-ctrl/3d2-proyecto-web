-- Add customization_options to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS customization_options jsonb DEFAULT '{}';

-- Example usage update (optional, just for documentation)
-- UPDATE products SET customization_options = '{"models": ["V1", "V2"], "colors": ["Red", "Black"]}' WHERE id = ...;
