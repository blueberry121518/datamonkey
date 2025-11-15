-- Create agent_actions table for tracking agent activities
-- Run this migration in your Supabase SQL editor

-- Create agent_actions table
CREATE TABLE IF NOT EXISTS agent_actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID REFERENCES buyer_agents(id) ON DELETE CASCADE,
  action_type VARCHAR(50) NOT NULL, -- 'query', 'probe', 'payment_402', 'payment_sent', 'payment_verified', 'data_received', etc.
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'success', 'failed'
  details JSONB DEFAULT '{}', -- Action-specific details
  metadata JSONB DEFAULT '{}', -- Additional metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_agent_actions_agent_id ON agent_actions(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_actions_action_type ON agent_actions(action_type);
CREATE INDEX IF NOT EXISTS idx_agent_actions_status ON agent_actions(status);
CREATE INDEX IF NOT EXISTS idx_agent_actions_created_at ON agent_actions(created_at);

-- Add comments
COMMENT ON TABLE agent_actions IS 'Tracks all agent actions for real-time frontend updates';
COMMENT ON COLUMN agent_actions.action_type IS 'Type of action: query, probe, payment_402, payment_sent, etc.';
COMMENT ON COLUMN agent_actions.details IS 'Action-specific data (endpoint, amount, response, etc.)';

