# Coinbase Configuration Requirements

## Overview

For Data Monkey to maximize Coinbase usage, you need to configure the following:

## Required Configuration

### 1. CDP API Keys

**Location**: Coinbase Developer Platform Dashboard
- Go to: https://www.coinbase.com/developer-platform
- Navigate to: API Keys → Secret API Keys
- Create a new API key with:
  - **Signature Algorithm**: Ed25519 (recommended for CDP APIs)
  - **Permissions**: Wallet operations, signing

**Environment Variables**:
```env
CDP_API_KEY_NAME=your-api-key-name
CDP_API_KEY_SECRET=your-api-key-secret-private-key
```

### 2. Network Configuration

**Current Setup**: Base Sepolia (testnet)
```env
CDP_NETWORK=base-sepolia
```

**For Production**: Base Mainnet
```env
CDP_NETWORK=base
```

### 3. x402 Facilitator

**Testnet**:
```env
X402_FACILITATOR_URL=https://x402.org/facilitator
```

**Production** (Coinbase-hosted):
```env
X402_FACILITATOR_URL=https://facilitator.cdp.coinbase.com
```

### 4. Wallet Creation

**Automatic**: Wallets are created automatically when:
- Users sign up (seller/buyer wallets)
- Agents are initialized (agent wallets)

**No additional configuration needed** - handled by `WalletService`

## What's Already Configured

✅ **CDP SDK Initialization** - `backend/src/config/coinbase.ts`
✅ **Wallet Service** - Automatic wallet creation
✅ **x402 Payment Service** - Payment instruction generation
✅ **x402 Middleware** - Payment verification

## What You Need to Do

### Step 1: Get CDP API Keys

1. Sign up/login to Coinbase Developer Platform
2. Create a new project
3. Generate API keys (Ed25519)
4. Copy to `.env` file

### Step 2: Fund Wallets (Testnet)

For testing, you'll need test USDC:
- Use Base Sepolia faucets
- Or request test tokens from Coinbase

### Step 3: Verify Configuration

Test the setup:
```bash
# Check wallet creation
curl -X POST http://localhost:8000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123456"}'

# Check agent initialization
curl -X POST http://localhost:8000/api/agents \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Agent",
    "goal": "Find cat images",
    "requirements": {"category": "Images"},
    "budget": 10.0
  }'
```

## No Additional Coinbase Configuration Needed

The system is designed to work with:
- ✅ Standard CDP API keys
- ✅ Base network (Sepolia for test, Base for prod)
- ✅ Coinbase-hosted facilitator (for production)
- ✅ Automatic wallet management

## Production Checklist

Before going to production:

1. ✅ Switch to Base mainnet: `CDP_NETWORK=base`
2. ✅ Use production facilitator URL
3. ✅ Fund wallets with real USDC
4. ✅ Set up monitoring for wallet balances
5. ✅ Configure spending limits (optional)

## Architecture Summary

```
Data Monkey Marketplace (Independent)
├── Seller Data Storage (Unlimited uploads)
├── Query Endpoints (Agents ask "do you have X?")
├── Sample/Probe Endpoints (Quality assessment)
└── x402 Payment (Coinbase CDP)

Buyer Agents
├── CDP Wallets (Auto-created)
├── Discover datasets (Independent marketplace)
├── Query sellers (Do you have X data?)
├── Assess quality (Sample endpoints)
└── Purchase via x402 (Coinbase payments)

AI/Generation Services
└── Use x402 Bazaar (Coinbase ecosystem)
```

## Support

If you encounter issues:
1. Check CDP API key permissions
2. Verify network configuration
3. Ensure wallets are funded (for testnet)
4. Check Coinbase Developer Platform status

No special Coinbase configuration beyond standard CDP setup is required!

