# Coinbase Payments, Testnet, and x402 Explained

## Testnet vs Mainnet

### Testnet (Base Sepolia)
**What it is:**
- A **testing environment** that mimics the real blockchain
- Uses **fake/test tokens** - no real money
- Free to use for development and testing
- Transactions are faster and cheaper (or free)

**Why use it:**
- ✅ Test your code without spending real money
- ✅ Learn how the system works
- ✅ Debug issues safely
- ✅ No financial risk

**Test USDC:**
- Get from faucets (free test tokens)
- Not real money - can't be converted to real USD
- Only works on testnet

**Example:**
```
Testnet: You have 1000 test USDC (fake money)
Mainnet: You have 10 real USDC (real money worth $10)
```

### Mainnet (Base)
**What it is:**
- The **real blockchain** with real money
- Uses **real USDC** - actual value
- Transactions cost real gas fees
- Permanent - transactions can't be undone

**When to use:**
- Production applications
- Real users
- Actual payments

**Real USDC:**
- Must be purchased or received
- Has real value (1 USDC = $1 USD)
- Can be converted to other currencies

## How Coinbase Moves Funds

### CDP Wallets (Coinbase Developer Platform)

**Wallet Types:**

1. **Developer-Managed Wallets**
   - You control via API
   - Perfect for autonomous agents
   - No user interaction needed
   - Created programmatically

2. **User-Managed Wallets (Embedded)**
   - User controls via UI
   - Better for user-facing apps
   - Requires user approval

### Fund Movement Flow

```
┌─────────────────────────────────────────┐
│      Coinbase Infrastructure            │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │  CDP Wallets (TEE - Secure)       │ │
│  │  - Keys stored in hardware        │ │
│  │  - Fast signing (<200ms)          │ │
│  └───────────────────────────────────┘ │
│              │                          │
│              ▼                          │
│  ┌───────────────────────────────────┐ │
│  │  x402 Facilitator                  │ │
│  │  - Verifies payments               │ │
│  │  - Settles on-chain                │ │
│  │  - ~200ms settlement               │ │
│  └───────────────────────────────────┘ │
│              │                          │
│              ▼                          │
│  ┌───────────────────────────────────┐ │
│  │  Base Network (L2 Blockchain)     │ │
│  │  - Low gas fees                    │ │
│  │  - Fast transactions               │ │
│  └───────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

### How Payments Work

**Step-by-Step:**

1. **Agent initiates payment**
   ```
   Agent: "I want to buy dataset for $0.10"
   ```

2. **Service returns HTTP 402**
   ```json
   {
     "scheme": "x402",
     "amount": "0.10",
     "currency": "USDC",
     "recipient": "0xSellerAddress...",
     "network": "base-sepolia",
     "nonce": "abc123",
     "facilitator": "https://x402.org/facilitator"
   }
   ```

3. **Agent signs payment with CDP wallet**
   ```
   Agent Wallet → Signs payment payload
   → Creates signature
   ```

4. **Agent sends X-PAYMENT header**
   ```http
   X-PAYMENT: {
     "scheme": "x402",
     "amount": "0.10",
     "recipient": "0xSellerAddress...",
     "signature": "0xabc123..."
   }
   ```

5. **x402 Facilitator verifies**
   ```
   Facilitator checks:
   - Signature is valid
   - Amount matches
   - Nonce hasn't been used
   - Timestamp is recent
   ```

6. **Facilitator settles on-chain**
   ```
   Facilitator → Base Network
   → Transfers USDC from buyer to seller
   → ~200ms total time
   ```

7. **Service delivers data**
   ```
   Payment verified → Data served
   ```

## Credits and Billing

### How Coinbase Charges

**CDP API Usage:**
- **Wallet operations**: Free (within limits)
- **Transaction signing**: Free
- **Account creation**: Free
- **API calls**: Free tier available

**x402 Payments:**
- **Facilitator fees**: 
  - Testnet: Usually free
  - Mainnet: Coinbase-hosted facilitator is fee-free for Base
- **Gas fees**: 
  - Paid by facilitator (gas abstraction)
  - Very low on Base L2 (~$0.001 per transaction)
  - Often subsidized by Coinbase

**No Credits System:**
- Coinbase doesn't use a credits system for x402
- Payments are **direct USDC transfers**
- Real-time settlement
- No pre-funding required (except wallet balance)

### Wallet Funding

**Testnet:**
```typescript
// Get test USDC from faucets
// Free - no real money needed
const faucet = await getTestUSDC(walletAddress);
```

**Mainnet:**
```typescript
// Fund wallet with real USDC
// Options:
// 1. Transfer from Coinbase exchange
// 2. Buy USDC directly
// 3. Receive from another wallet
```

## Crypto Exchange Within x402

### Payment Flow (No Exchange Needed)

**x402 uses USDC directly:**
- No conversion needed
- USDC is a stablecoin (1 USDC = $1 USD)
- Works across Base network
- Fast and cheap

**Flow:**
```
Buyer Wallet (USDC) 
  → x402 Payment 
  → Seller Wallet (USDC)
```

**No exchange happens** - it's a direct transfer of USDC.

### If You Need Different Tokens

**Current x402 Support:**
- **Base**: USDC
- **Solana**: USDC (planned)
- More tokens coming

**For other tokens:**
- Would need to use a DEX (Decentralized Exchange)
- Or convert outside x402 system
- x402 focuses on stablecoin payments

## Agent Payment Flow

### Complete Agent Payment Example

```typescript
class DataMonkeyAgent {
  private cdp: CdpClient;
  private walletAddress: string;

  async initialize() {
    // Agent has its own CDP wallet
    this.cdp = new CdpClient();
    const account = await this.cdp.evm.createAccount();
    this.walletAddress = account.address;
    
    // Fund wallet (testnet: faucet, mainnet: real USDC)
    await this.fundWallet();
  }

  async purchaseDataset(datasetId: string, quantity: number) {
    // 1. Request data
    const response = await fetch(
      `http://datamonkey.com/api/datasets/${datasetId}/data?quantity=${quantity}`
    );

    // 2. Get HTTP 402 payment instructions
    if (response.status === 402) {
      const paymentInstructions = await response.json();
      
      // 3. Sign payment with CDP wallet
      const signed = await this.cdp.evm.signMessage({
        message: JSON.stringify(paymentInstructions),
      });

      // 4. Retry with X-PAYMENT header
      const paidResponse = await fetch(
        `http://datamonkey.com/api/datasets/${datasetId}/data?quantity=${quantity}`,
        {
          headers: {
            'X-PAYMENT': JSON.stringify({
              ...paymentInstructions,
              signature: signed.signature,
            }),
          },
        }
      );

      // 5. Receive data
      return await paidResponse.json();
    }
  }
}
```

## Cost Breakdown

### Testnet (Free)
```
Wallet Creation: Free
API Calls: Free
Test USDC: Free (from faucets)
Gas Fees: Free (testnet)
Facilitator: Free (testnet)
Total: $0.00
```

### Mainnet (Real Costs)
```
Wallet Creation: Free
API Calls: Free (within limits)
Real USDC: $1 per USDC (you buy it)
Gas Fees: ~$0.001 per transaction (very low on Base)
Facilitator: Free (Coinbase-hosted)
Total: Only pay for USDC you use
```

## Network Comparison

### Base Sepolia (Testnet)
- **Network ID**: `base-sepolia`
- **USDC**: Test tokens (free)
- **Gas**: Free or very cheap
- **Speed**: Fast
- **Purpose**: Development/testing

### Base (Mainnet)
- **Network ID**: `base`
- **USDC**: Real money
- **Gas**: ~$0.001 per transaction
- **Speed**: Fast (~2 seconds)
- **Purpose**: Production

## x402 Facilitator

### What It Does

**Coinbase-Hosted Facilitator:**
- Verifies payment signatures
- Settles payments on-chain
- Handles gas fees (gas abstraction)
- Provides fast settlement (~200ms)

**Benefits:**
- No need to manage blockchain infrastructure
- Fast payments
- Low/no fees
- Reliable settlement

### How It Works

```
1. Agent sends signed payment
2. Facilitator verifies signature
3. Facilitator creates on-chain transaction
4. Facilitator pays gas fees
5. USDC transferred to seller
6. Payment confirmed
```

## Agent Wallet Management

### Creating Agent Wallets

```typescript
// Each agent gets its own wallet
const agent1 = await cdp.evm.createAccount();
const agent2 = await cdp.evm.createAccount();

// Each has its own address
console.log(agent1.address); // 0x...
console.log(agent2.address); // 0x...
```

### Funding Agents

**Testnet:**
```typescript
// Get test USDC from faucet
await requestTestUSDC(agentWalletAddress);
```

**Mainnet:**
```typescript
// Transfer real USDC to agent wallet
await transferUSDC({
  from: buyerWallet,
  to: agentWallet,
  amount: "10.0", // $10 USDC
});
```

### Agent Budget Management

```typescript
class Agent {
  budget: number = 10.0; // $10 USDC
  spent: number = 0.0;

  async canAfford(price: number): boolean {
    return (this.budget - this.spent) >= price;
  }

  async spend(amount: number) {
    if (!this.canAfford(amount)) {
      throw new Error("Insufficient budget");
    }
    this.spent += amount;
  }
}
```

## Summary

### Key Points

1. **Testnet = Free Testing**
   - Use for development
   - No real money
   - Get test tokens from faucets

2. **Mainnet = Real Money**
   - Production use
   - Real USDC required
   - Low fees on Base

3. **x402 = Direct USDC Transfer**
   - No exchange needed
   - Fast settlement (~200ms)
   - Low/no fees

4. **CDP Wallets = Secure & Fast**
   - Keys in hardware (TEE)
   - Fast signing (<200ms)
   - Perfect for agents

5. **Facilitator = Payment Handler**
   - Verifies payments
   - Settles on-chain
   - Handles gas fees

### Cost Structure

**For Agents:**
- Only pay for data/services you use
- Pay-per-request model
- No subscriptions
- No credits system

**For Sellers:**
- Receive USDC directly
- No platform fees (in your case)
- Fast settlement
- Real-time payments

### Example Transaction

```
Agent wants 100 records @ $0.001 each = $0.10

1. Agent wallet balance: $1.00 USDC
2. Agent requests data
3. Gets HTTP 402: "Pay $0.10"
4. Agent signs payment
5. Facilitator verifies & settles
6. Seller receives $0.10 USDC
7. Agent receives data
8. Agent balance: $0.90 USDC
```

**Total time**: ~200ms
**Cost**: $0.10 USDC (no additional fees on Base with Coinbase facilitator)

