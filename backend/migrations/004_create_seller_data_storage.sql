-- Create seller_data_storage table for storing actual dataset records
-- Sellers can upload unlimited data to their account
-- Run this migration in your Supabase SQL editor

-- Create seller_data_storage table
CREATE TABLE IF NOT EXISTS seller_data_storage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  seller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  dataset_listing_id UUID REFERENCES dataset_listings(id) ON DELETE CASCADE,
  data_record JSONB NOT NULL, -- The actual data record
  metadata JSONB DEFAULT '{}', -- Additional metadata per record
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_seller_data_seller_id ON seller_data_storage(seller_id);
CREATE INDEX IF NOT EXISTS idx_seller_data_dataset_id ON seller_data_storage(dataset_listing_id);
CREATE INDEX IF NOT EXISTS idx_seller_data_created_at ON seller_data_storage(created_at);

-- GIN index for JSONB queries (allows fast searching within data records)
CREATE INDEX IF NOT EXISTS idx_seller_data_record_gin ON seller_data_storage USING GIN (data_record);
CREATE INDEX IF NOT EXISTS idx_seller_data_metadata_gin ON seller_data_storage USING GIN (metadata);

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_seller_data_storage_updated_at
  BEFORE UPDATE ON seller_data_storage
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comments
COMMENT ON TABLE seller_data_storage IS 'Actual data records uploaded by sellers';
COMMENT ON COLUMN seller_data_storage.data_record IS 'The actual data record (JSONB for flexible schema)';
COMMENT ON COLUMN seller_data_storage.metadata IS 'Per-record metadata (tags, quality flags, etc.)';

