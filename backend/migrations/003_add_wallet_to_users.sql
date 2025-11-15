-- Add wallet_id column to users table for CDP wallet integration
-- Run this migration in your Supabase SQL editor

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS wallet_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS wallet_address VARCHAR(255);

-- Create index on wallet_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_wallet_id ON users(wallet_id);

-- Add comments
COMMENT ON COLUMN users.wallet_id IS 'CDP Wallet ID from Coinbase Developer Platform';
COMMENT ON COLUMN users.wallet_address IS 'On-chain wallet address';

