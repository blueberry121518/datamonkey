-- Create dataset_listings table for seller datasets
-- Run this migration in your Supabase SQL editor

-- Create dataset_listings table
CREATE TABLE IF NOT EXISTS dataset_listings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  seller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  endpoint_path VARCHAR(255) UNIQUE NOT NULL, -- e.g., '/api/datasets/abc123'
  type VARCHAR(20) CHECK (type IN ('api', 'agent')) DEFAULT 'api',
  price_per_record DECIMAL(10, 6) NOT NULL DEFAULT 0.001,
  metadata JSONB DEFAULT '{}',
  schema JSONB, -- JSON Schema for data structure
  total_rows INTEGER,
  quality_score DECIMAL(3, 2), -- 0.00 to 1.00
  content_summary TEXT, -- Auto-generated or manual
  probe_endpoint TEXT, -- URL for /probe endpoint
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_dataset_listings_seller_id ON dataset_listings(seller_id);
CREATE INDEX IF NOT EXISTS idx_dataset_listings_category ON dataset_listings(category);
CREATE INDEX IF NOT EXISTS idx_dataset_listings_is_active ON dataset_listings(is_active);
CREATE INDEX IF NOT EXISTS idx_dataset_listings_endpoint_path ON dataset_listings(endpoint_path);

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_dataset_listings_updated_at
  BEFORE UPDATE ON dataset_listings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comments
COMMENT ON TABLE dataset_listings IS 'Dataset listings created by sellers';
COMMENT ON COLUMN dataset_listings.endpoint_path IS 'Unique path for the dataset endpoint (e.g., /api/datasets/abc123)';
COMMENT ON COLUMN dataset_listings.metadata IS 'Additional metadata (tags, format, etc.)';
COMMENT ON COLUMN dataset_listings.schema IS 'JSON Schema defining the data structure';
COMMENT ON COLUMN dataset_listings.quality_score IS 'Quality score from 0.00 to 1.00';

