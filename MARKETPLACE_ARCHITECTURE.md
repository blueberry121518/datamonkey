# Data Monkey Marketplace Architecture

## Overview

Data Monkey is an **independent marketplace** that hosts seller API endpoints with x402 payment protocol integration. The marketplace acts as the payment gateway and endpoint host, while payments go directly to sellers' wallets.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│              Data Monkey Marketplace                     │
│  (Independent - hosts all seller endpoints)              │
└─────────────────────────────────────────────────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
        ▼                 ▼                 ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   Seller 1   │  │   Seller 2   │  │   Seller N   │
│  Endpoint:   │  │  Endpoint:   │  │  Endpoint:   │
│ /api/.../1   │  │ /api/.../2   │  │ /api/.../N   │
└──────────────┘  └──────────────┘  └──────────────┘
        │                 │                 │
        └─────────────────┼─────────────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │   Buyer Agents        │
              │   (Discover & Pay)    │
              └───────────────────────┘
```

## Key Components

### 1. Marketplace Hosts All Endpoints

**Every seller dataset gets an endpoint hosted on the marketplace:**

- **Discovery**: `GET /api/datasets` - List all active datasets
- **Metadata**: `GET /api/datasets/:id` - Get dataset info
- **Probe**: `GET /api/datasets/:id/probe` - Free metadata (no payment)
- **Data**: `GET /api/datasets/:id/data?quantity=100` - Requires x402 payment

### 2. x402 Payment Flow

```
Agent Request Flow:
1. Agent: GET /api/datasets/abc123/data?quantity=100
2. Marketplace: HTTP 402 Payment Required
   {
     "scheme": "x402",
     "amount": "0.1",  // 100 records × $0.001
     "currency": "USDC",
     "recipient": "0x...",  // Seller's wallet address
     "network": "base-sepolia",
     "nonce": "...",
     "timestamp": ...,
     "facilitator": "https://x402.org/facilitator"
   }
3. Agent: Signs payment with CDP wallet
4. Agent: GET /api/datasets/abc123/data?quantity=100
   Header: X-PAYMENT: {"scheme":"x402","amount":"0.1",...}
5. Marketplace: Verifies payment → Serves data
```

### 3. Payment Recipient

**Payments go directly to seller wallets**, not the marketplace:

- Each user has a CDP wallet (created on signup)
- Wallet address stored in `users.wallet_address`
- Marketplace verifies payment but doesn't receive funds
- Seller receives payment directly via x402 facilitator

### 4. Endpoint Structure

```
/api/datasets/:id/data
├── Without X-PAYMENT header → HTTP 402 with payment instructions
└── With X-PAYMENT header → Verify payment → Serve data

/api/datasets/:id/probe
└── Always free (no payment required) → Returns metadata
```

## Implementation Details

### Database Schema

**Users Table:**
- `wallet_id` - CDP Wallet ID
- `wallet_address` - On-chain address (payment recipient)

**Dataset Listings Table:**
- `endpoint_path` - Unique endpoint path
- `seller_id` - References users table
- `price_per_record` - Price in USDC
- `schema` - JSON Schema for data structure

### Middleware Flow

**x402PaymentMiddleware:**
1. Extract dataset ID from route
2. Fetch dataset and seller wallet address
3. Check for `X-PAYMENT` header
4. If no header → Return HTTP 402 with payment instructions
5. If header exists → Verify payment signature
6. If valid → Attach dataset to request, proceed
7. If invalid → Return HTTP 402 again

### Payment Verification

Currently uses basic validation. In production, should:
1. Verify signature on-chain via x402 facilitator
2. Check payment amount matches requested quantity
3. Verify nonce hasn't been reused
4. Check timestamp is recent (prevent replay attacks)

## API Endpoints

### Public Endpoints

```
GET  /api/datasets              # List all active datasets
GET  /api/datasets/:id          # Get dataset metadata
GET  /api/datasets/:id/probe    # Free probe (metadata only)
GET  /api/datasets/:id/data     # Purchase data (x402 payment)
```

### Protected Endpoints (Seller)

```
POST   /api/datasets            # Create dataset listing
GET    /api/datasets/my         # Get seller's datasets
PUT    /api/datasets/:id        # Update dataset
DELETE /api/datasets/:id        # Delete dataset
```

## x402 Protocol Compliance

### HTTP 402 Response Format

```json
{
  "scheme": "x402",
  "amount": "0.1",
  "currency": "USDC",
  "recipient": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "network": "base-sepolia",
  "nonce": "unique-nonce-123",
  "timestamp": 1730000000,
  "facilitator": "https://x402.org/facilitator",
  "metadata": {
    "dataset_id": "...",
    "dataset_name": "...",
    "quantity": 100,
    "price_per_record": "0.001"
  }
}
```

### X-PAYMENT Header Format

```http
X-PAYMENT: {"scheme":"x402","amount":"0.1","recipient":"0x...","signature":"0x..."}
```

## Independent Marketplace Benefits

1. **Full Control**: Complete control over discovery, pricing, and quality
2. **Specialized**: Optimized for dataset transactions
3. **Fast Iteration**: Can add features without external dependencies
4. **Seller Protection**: Marketplace can implement quality checks, dispute resolution
5. **Buyer Trust**: Centralized reputation system

## Future: x402 Bazaar Integration

Can optionally register marketplace endpoints with x402 Bazaar:

```typescript
// Register dataset endpoints with x402 Bazaar
await registerWithBazaar({
  endpoint: '/api/datasets/:id/data',
  category: 'datasets',
  description: 'Data Monkey dataset marketplace',
  discoverable: true,
})
```

This allows agents to discover Data Monkey datasets via:
- Direct Data Monkey API (specialized, faster)
- x402 Bazaar (broader ecosystem)

## Testing

### Test Payment Flow

```bash
# 1. Probe endpoint (free)
curl http://localhost:8000/api/datasets/{id}/probe

# 2. Request data (will get 402)
curl http://localhost:8000/api/datasets/{id}/data?quantity=10

# 3. With payment header (after signing)
curl http://localhost:8000/api/datasets/{id}/data?quantity=10 \
  -H "X-PAYMENT: {\"scheme\":\"x402\",\"amount\":\"0.01\",...}"
```

## Environment Variables

```env
# Coinbase CDP
CDP_API_KEY_NAME=your-api-key-name
CDP_API_KEY_SECRET=your-api-key-secret
CDP_NETWORK=base-sepolia

# x402
X402_FACILITATOR_URL=https://x402.org/facilitator
```

## Next Steps

1. ✅ Marketplace hosts endpoints
2. ✅ x402 payment middleware
3. ✅ Probe endpoints
4. ⏳ On-chain payment verification
5. ⏳ Purchase tracking
6. ⏳ Actual data storage/retrieval
7. ⏳ x402 Bazaar registration (optional)

