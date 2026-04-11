-- Add last_cost column to raw_materials to track unit price history
ALTER TABLE raw_materials
ADD COLUMN IF NOT EXISTS last_cost numeric;
