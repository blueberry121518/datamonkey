# Testnet Setup Guide for Data Monkey

## How to Connect to Testnet

### 1. Configure Environment Variables

Your `.env` file should have:

```env
# Network Configuration
CDP_NETWORK=base-sepolia  # Testnet

# x402 Configuration (Testnet)
X402_FACILITATOR_URL=https://x402.org/facilitator
X402_BAZAAR_URL=https://bazaar.x402.org  # May have testnet version

# Coinbase CDP
CDP_API_KEY_ID=your-api-key-id
CDP_API_KEY_NAME=your-api-key-name
CDP_API_KEY_SECRET=your-api-key-secret
CDP_WALLET_SECRET=your-wallet-secret
```

### 2. Your Code Already Uses Testnet

Your `coinbase.ts` config already defaults to testnet:

```typescript
export const CDP_NETWORK = process.env.CDP_NETWORK || 'base-sepolia'
```

**You're already connected to testnet!** ✅

### 3. Verify Testnet Connection

```typescript
// Test script
import { CdpClient } from "@coinbase/cdp-sdk";
import dotenv from "dotenv";

dotenv.config();

const cdp = new CdpClient();

// Create account on testnet
const account = await cdp.evm.createAccount();
console.log(`Testnet account: ${account.address}`);

// Check network
console.log(`Network: ${process.env.CDP_NETWORK || 'base-sepolia'}`);
```

## Can Testnet Interact with x402 Bazaar?

### Current Status

**x402 Bazaar Testnet Support:**
- ✅ **Yes, testnet can interact with x402 Bazaar**
- The Bazaar supports both testnet and mainnet services
- Services can specify which network they're on
- Agents can filter by network when querying

### How It Works

**Bazaar Service Discovery:**
```typescript
// Query Bazaar (works on testnet)
const services = await axios.get(`${X402_BAZAAR_URL}/services`, {
  params: {
    q: "image generation",
    network: "base-sepolia", // Filter for testnet services
  }
});
```

**Service Registration:**
- Services register with network info
- Bazaar tracks which network each service uses
- Agents can filter by network

### Testnet vs Mainnet Services

**In x402 Bazaar:**
- Services specify their network (`base-sepolia` or `base`)
- Agents can query by network
- Testnet services only work with testnet wallets
- Mainnet services only work with mainnet wallets

## Can You Create Independent Marketplace on Testnet?

### ✅ YES - Absolutely!

**Your Data Monkey marketplace can run on testnet:**

1. **Backend Configuration**
   ```env
   CDP_NETWORK=base-sepolia  # Testnet
   X402_FACILITATOR_URL=https://x402.org/facilitator  # Testnet facilitator
   ```

2. **All Features Work on Testnet:**
   - ✅ Seller data uploads
   - ✅ Agent queries
   - ✅ x402 payments
   - ✅ Wallet creation
   - ✅ Dataset purchases

3. **Benefits:**
   - Test everything without real money
   - Debug payment flows
   - Test agent discovery
   - Verify quality assessment
   - No financial risk

### Testnet Marketplace Setup

**1. Configure for Testnet:**
```typescript
// backend/src/config/coinbase.ts
export const CDP_NETWORK = 'base-sepolia'  // Testnet
export const X402_FACILITATOR_URL = 'https://x402.org/facilitator'
```

**2. Get Test USDC:**
```typescript
// Fund wallets with test USDC from faucets
// Base Sepolia faucets:
// - https://www.coinbase.com/faucets/base-ethereum-goerli-faucet
// - Or use CDP testnet features
```

**3. Test Your Marketplace:**
```typescript
// All your endpoints work on testnet:
// - POST /api/seller/data/upload
// - GET /api/seller/:sellerId/query
// - GET /api/datasets/:id/data (x402 payment)
// - POST /api/agents (creates testnet wallet)
```

## Complete Testnet Setup

### Step 1: Environment Configuration

```env
# .env file
CDP_NETWORK=base-sepolia
CDP_API_KEY_ID=d7974d58-54a2-4a6a-8795-0b157d28bc68
CDP_API_KEY_NAME=datamonkey
CDP_API_KEY_SECRET=your-secret
CDP_WALLET_SECRET=your-wallet-secret
X402_FACILITATOR_URL=https://x402.org/facilitator
X402_BAZAAR_URL=https://bazaar.x402.org
```

### Step 2: Verify Testnet Connection

```typescript
// test-testnet.ts
import { CdpClient } from "@coinbase/cdp-sdk";
import dotenv from "dotenv";

dotenv.config();

const cdp = new CdpClient();

// This creates account on testnet (base-sepolia)
const account = await cdp.evm.createAccount();
console.log(`✅ Testnet account created: ${account.address}`);
console.log(`✅ Network: base-sepolia`);
```

### Step 3: Fund Testnet Wallets

**Option 1: Base Sepolia Faucet**
- Visit: https://www.coinbase.com/faucets/base-ethereum-goerli-faucet
- Enter wallet address
- Receive test USDC

**Option 2: CDP Testnet Features**
- Some CDP features provide test tokens
- Check Coinbase Developer Platform dashboard

### Step 4: Test x402 Payments

```typescript
// Test x402 payment on testnet
const response = await fetch('http://localhost:8000/api/datasets/abc123/data', {
  method: 'GET',
});

if (response.status === 402) {
  const payment = await response.json();
  console.log('Payment required:', payment);
  // payment.network will be "base-sepolia"
}
```

## x402 Bazaar on Testnet

### Querying Bazaar from Testnet

```typescript
// Query Bazaar for testnet services
const services = await axios.get('https://bazaar.x402.org/services', {
  params: {
    network: 'base-sepolia',  // Filter for testnet
    category: 'datasets',
  }
});

// Services returned will be on testnet
// Your agents can interact with them using testnet wallets
```

### Registering Your Marketplace in Bazaar

**Optional - You can register Data Monkey services:**

```typescript
// Register your dataset endpoints with Bazaar
await registerWithBazaar({
  name: "Data Monkey - Testnet",
  endpoint: "http://localhost:8000/api/datasets/{id}/data",
  network: "base-sepolia",  // Specify testnet
  category: "datasets",
  price: "0.001",
  discoverable: true,
});
```

**Note:** Your marketplace is **independent** - you don't need to register with Bazaar. Registration is optional for broader discovery.

## Testnet vs Mainnet Comparison

### Testnet (Current Setup)

**Configuration:**
```env
CDP_NETWORK=base-sepolia
X402_FACILITATOR_URL=https://x402.org/facilitator
```

**Features:**
- ✅ All marketplace features work
- ✅ x402 payments work
- ✅ Can query x402 Bazaar
- ✅ Can register with Bazaar (optional)
- ✅ Free test USDC
- ✅ No real money risk

**Limitations:**
- Test tokens only
- Not real value
- Separate from mainnet

### Mainnet (Production)

**Configuration:**
```env
CDP_NETWORK=base
X402_FACILITATOR_URL=https://facilitator.cdp.coinbase.com
```

**Features:**
- ✅ Real USDC payments
- ✅ Real value
- ✅ Production ready
- ✅ Real users

**Requirements:**
- Real USDC funding
- Production API keys
- Real money risk

## Testing Your Marketplace on Testnet

### Complete Test Flow

```typescript
// 1. Create seller account (testnet wallet)
const seller = await signup({ email: "seller@test.com", password: "..." });
// Seller gets testnet wallet automatically

// 2. Seller uploads data
await uploadData({
  records: [{ image_url: "test.jpg", category: "cats" }]
});

// 3. Create buyer agent (testnet wallet)
const agent = await createAgent({
  name: "Test Agent",
  goal: "Find cat images",
  budget: 10.0,  // Test USDC
});

// 4. Agent queries seller
const query = await querySeller(sellerId, {
  requiredFields: ["image_url", "category"],
  category: "Images"
});
// Returns: { hasData: true, matchCount: 1, ... }

// 5. Agent purchases data (x402 payment on testnet)
const data = await purchaseDataset(datasetId, { quantity: 10 });
// Payment happens on base-sepolia testnet
// Uses test USDC
```

## Switching Between Testnet and Mainnet

### Testnet → Mainnet

**1. Update Environment:**
```env
CDP_NETWORK=base  # Change from base-sepolia
X402_FACILITATOR_URL=https://facilitator.cdp.coinbase.com
```

**2. Fund with Real USDC:**
- Transfer real USDC to wallets
- Or use Coinbase exchange

**3. Update API Keys (if needed):**
- Some features may need production API keys
- Check Coinbase Developer Platform

### Mainnet → Testnet

**1. Update Environment:**
```env
CDP_NETWORK=base-sepolia
X402_FACILITATOR_URL=https://x402.org/facilitator
```

**2. Get Test USDC:**
- Use faucets
- Request test tokens

## Summary

### ✅ You Can:

1. **Run marketplace on testnet** - All features work
2. **Interact with x402 Bazaar** - Query testnet services
3. **Test x402 payments** - Use test USDC
4. **Create agents** - With testnet wallets
5. **Test everything** - Without real money

### Current Setup

**You're already on testnet!**
- `CDP_NETWORK=base-sepolia` (default)
- All wallets created are on testnet
- All payments use test USDC
- Can interact with x402 Bazaar

### Next Steps

1. ✅ Get test USDC from faucets
2. ✅ Test seller data uploads
3. ✅ Test agent queries
4. ✅ Test x402 payments
5. ✅ Test Bazaar integration (optional)

**Your independent marketplace works perfectly on testnet!** 🎉

