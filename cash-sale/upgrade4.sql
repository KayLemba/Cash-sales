-- ShopDesk Feature Migration
-- Run this in Supabase SQL Editor after upgrade3.sql

-- 1. Add barcode column to products
ALTER TABLE products ADD COLUMN IF NOT EXISTS barcode TEXT UNIQUE;

-- 2. Settings table for receipt customization
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Default settings
INSERT INTO settings (key, value) VALUES
  ('shop_name', 'ShopDesk'),
  ('shop_address', ''),
  ('shop_phone', ''),
  ('receipt_footer', 'Thank you for your business!')
ON CONFLICT (key) DO NOTHING;

-- 3. Sales targets table
CREATE TABLE IF NOT EXISTS sales_targets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  period_type TEXT NOT NULL CHECK (period_type IN ('daily', 'weekly')),
  target_amount NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Insert a default daily target
INSERT INTO sales_targets (period_type, target_amount)
VALUES ('daily', 5000)
ON CONFLICT DO NOTHING;

-- 4. Enable Realtime for tables
ALTER PUBLICATION supabase_realtime ADD TABLE sales;
ALTER PUBLICATION supabase_realtime ADD TABLE products;
ALTER PUBLICATION supabase_realtime ADD TABLE sale_returns;
