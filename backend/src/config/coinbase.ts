import { Coinbase } from '@coinbase/coinbase-sdk'

if (!process.env.CDP_API_KEY_NAME || !process.env.CDP_API_KEY_SECRET) {
  throw new Error(
    'CDP_API_KEY_NAME and CDP_API_KEY_SECRET must be set in environment variables'
  )
}

// Initialize Coinbase CDP SDK using static configure method
Coinbase.configure({
  apiKeyName: process.env.CDP_API_KEY_NAME,
  privateKey: process.env.CDP_API_KEY_SECRET,
})

// Export coinbase instance for backward compatibility
// Note: The SDK is now configured globally, use Wallet.create() directly
export const coinbase = Coinbase

export const CDP_NETWORK = process.env.CDP_NETWORK || 'base-sepolia'
export const X402_FACILITATOR_URL =
  process.env.X402_FACILITATOR_URL || 'https://x402.org/facilitator'

