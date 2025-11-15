# Coinbase CDP & x402 Integration

## Overview

This document shows where all Coinbase-related logic is implemented in the Data Monkey codebase.

## File Structure

### Backend Coinbase Integration

```
backend/
├── src/
│   ├── config/
│   │   └── coinbase.ts              # Coinbase SDK initialization
│   ├── services/
│   │   ├── wallet.service.ts        # CDP wallet management
│   │   ├── x402.service.ts          # x402 payment protocol
│   │   └── auth.service.ts          # Creates wallet on signup
│   └── migrations/
│       └── 003_add_wallet_to_users.sql  # Adds wallet_id to users table
```

## Implementation Details

### 1. Coinbase SDK Configuration
**File:** `backend/src/config/coinbase.ts`

- Initializes the Coinbase CDP SDK
- Exports `coinbase` instance for use across the app
- Configures network (base-sepolia by default)
- Sets x402 facilitator URL

### 2. Wallet Service
**File:** `backend/src/services/wallet.service.ts`

**Functions:**
- `createWallet(userId, walletName)` - Creates a CDP wallet for a user
- `getWallet(userId)` - Retrieves wallet info from database
- `getBalance(walletId, assetType)` - Gets wallet balance (USDC)
- `signPaymentPayload(walletId, paymentInstructions)` - Signs payment for x402

**Usage:**
- Automatically called during user signup
- Used when agents need to make payments

### 3. x402 Payment Service
**File:** `backend/src/services/x402.service.ts`

**Functions:**
- `generatePaymentInstructions(amount, recipient)` - Creates payment instructions
- `verifyPayment(signedPayment)` - Verifies payment signature
- `signPayment(walletId, instructions)` - Signs payment with wallet

**Payment Flow:**
1. Seller's dataset endpoint returns HTTP 402 with payment instructions
2. Buyer's agent receives 402 response
3. Agent signs payment with CDP wallet
4. Agent retries request with `X-PAYMENT` header
5. Seller verifies payment and serves data

### 4. Automatic Wallet Creation
**File:** `backend/src/services/auth.service.ts`

- When a user signs up, a CDP wallet is automatically created
- Wallet ID and address are stored in the `users` table
- If wallet creation fails, signup still succeeds (wallet can be created later)

### 5. Database Schema
**Migration:** `backend/migrations/003_add_wallet_to_users.sql`

Adds to `users` table:
- `wallet_id` - CDP Wallet ID from Coinbase
- `wallet_address` - On-chain wallet address

## Environment Variables

Required in `backend/.env`:

```env
CDP_API_KEY_NAME=your-api-key-name
CDP_API_KEY_SECRET=your-api-key-secret-private-key
CDP_NETWORK=base-sepolia
X402_FACILITATOR_URL=https://x402.org/facilitator
```

## Current Status

✅ **Implemented:**
- Coinbase SDK initialization
- Wallet creation service
- Wallet storage in database
- Automatic wallet creation on signup
- x402 payment instruction generation
- Payment signing

⏳ **Not Yet Implemented:**
- Dataset endpoint that returns HTTP 402
- Agent-side payment interceptor
- Payment verification on dataset purchase
- Balance checking in frontend
- Transaction history

## Next Steps

1. **Create dataset purchase endpoint** that:
   - Returns HTTP 402 with payment instructions
   - Verifies X-PAYMENT header
   - Serves dataset data after payment

2. **Add wallet routes** for:
   - Getting wallet balance
   - Viewing transaction history
   - Funding wallet

3. **Frontend integration**:
   - Show wallet balance in dashboard
   - Display wallet address
   - Show payment history

## Testing

To test the Coinbase integration:

1. Set up CDP API keys in `.env`
2. Run migration: `003_add_wallet_to_users.sql`
3. Sign up a new user (wallet will be created automatically)
4. Check Supabase `users` table for `wallet_id` and `wallet_address`

## Documentation

See `AGENTIC_COMMERCE_GUIDE.md` for:
- Complete x402 protocol documentation
- CDP Wallet API reference
- Example implementations
- Testing procedures

