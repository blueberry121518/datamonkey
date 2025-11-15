-- Migration: Convert to wallet-based authentication
-- This migration updates the users table to support wallet-based auth
-- while maintaining backward compatibility

-- Make password_hash nullable (existing users can keep passwords, new users won't need them)
ALTER TABLE users 
  ALTER COLUMN password_hash DROP NOT NULL;

-- Make email nullable (wallet-only users may not have email)
-- First drop the NOT NULL constraint, then update unique constraint if needed
ALTER TABLE users 
  ALTER COLUMN email DROP NOT NULL;

-- Drop existing unique constraint on email if it exists and recreate as partial unique
-- This allows multiple NULL emails but unique non-null emails
ALTER TABLE users 
  DROP CONSTRAINT IF EXISTS users_email_key;

CREATE UNIQUE INDEX IF NOT EXISTS unique_users_email 
  ON users(email) 
  WHERE email IS NOT NULL;

-- Make wallet_address unique (this is the primary auth method now)
-- Drop existing unique constraint if it exists
ALTER TABLE users 
  DROP CONSTRAINT IF EXISTS unique_wallet_address;

ALTER TABLE users 
  ADD CONSTRAINT unique_wallet_address UNIQUE (wallet_address);

-- Create index on wallet_address for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_wallet_address ON users(wallet_address) 
  WHERE wallet_address IS NOT NULL;

-- Add comment explaining the migration
COMMENT ON COLUMN users.password_hash IS 'Legacy password hash (nullable for wallet-based auth)';
COMMENT ON COLUMN users.wallet_address IS 'User wallet address from Coinbase CDP Embedded Wallet (primary auth method)';

