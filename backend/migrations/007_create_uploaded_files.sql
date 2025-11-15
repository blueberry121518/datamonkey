-- Create uploaded_files table for storing file metadata
-- Run this migration in your Supabase SQL editor

-- Create uploaded_files table
CREATE TABLE IF NOT EXISTS uploaded_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  seller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  original_filename VARCHAR(255) NOT NULL,
  file_type VARCHAR(100), -- 'image', 'text', 'json', 'csv', etc.
  mime_type VARCHAR(255),
  file_size BIGINT, -- Size in bytes
  storage_path TEXT, -- Path to stored file (or URL)
  parsed_data JSONB, -- Parsed/structured data from file
  parsing_status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'parsing', 'completed', 'failed'
  parsing_service_id VARCHAR(255), -- x402 service used for parsing
  category VARCHAR(100), -- Auto-detected or manual
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_uploaded_files_seller_id ON uploaded_files(seller_id);
CREATE INDEX IF NOT EXISTS idx_uploaded_files_file_type ON uploaded_files(file_type);
CREATE INDEX IF NOT EXISTS idx_uploaded_files_parsing_status ON uploaded_files(parsing_status);
CREATE INDEX IF NOT EXISTS idx_uploaded_files_category ON uploaded_files(category);

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_uploaded_files_updated_at
  BEFORE UPDATE ON uploaded_files
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comments
COMMENT ON TABLE uploaded_files IS 'Stores uploaded file metadata and parsed data';
COMMENT ON COLUMN uploaded_files.parsed_data IS 'Structured data extracted from unstructured file';
COMMENT ON COLUMN uploaded_files.parsing_service_id IS 'x402 service ID used for parsing';

