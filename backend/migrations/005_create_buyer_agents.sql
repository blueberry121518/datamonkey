-- Create buyer_agents table for agent initialization and management
-- Run this migration in your Supabase SQL editor

-- Create buyer_agents table
CREATE TABLE IF NOT EXISTS buyer_agents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  buyer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  goal TEXT NOT NULL, -- What data the agent is looking for
  requirements JSONB NOT NULL, -- Structured requirements (category, fields, quality, etc.)
  wallet_id VARCHAR(255), -- CDP wallet ID for the agent
  wallet_address VARCHAR(255), -- Agent's wallet address
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'failed')),
  budget DECIMAL(10, 6) DEFAULT 0, -- Total budget in USDC
  spent DECIMAL(10, 6) DEFAULT 0, -- Amount spent so far
  quality_threshold DECIMAL(3, 2) DEFAULT 0.7, -- Minimum quality score (0.00-1.00)
  quantity_required INTEGER, -- Total quantity of data needed
  quantity_acquired INTEGER DEFAULT 0, -- Quantity acquired so far
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_buyer_agents_buyer_id ON buyer_agents(buyer_id);
CREATE INDEX IF NOT EXISTS idx_buyer_agents_status ON buyer_agents(status);
CREATE INDEX IF NOT EXISTS idx_buyer_agents_requirements_gin ON buyer_agents USING GIN (requirements);

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_buyer_agents_updated_at
  BEFORE UPDATE ON buyer_agents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comments
COMMENT ON TABLE buyer_agents IS 'Buyer agents that discover and purchase datasets';
COMMENT ON COLUMN buyer_agents.requirements IS 'Structured requirements: {category, requiredFields, format, etc.}';
COMMENT ON COLUMN buyer_agents.wallet_id IS 'CDP wallet ID for autonomous payments';

