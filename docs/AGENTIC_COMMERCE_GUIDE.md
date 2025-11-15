# Agentic Commerce via CDP Wallets + x402-Driven Tool Chaining
## Comprehensive Setup and Implementation Guide (November 2025)

### Table of Contents
1. [Overview](#overview)
2. [Architecture & How Pieces Connect](#architecture--how-pieces-connect)
3. [Step-by-Step Setup](#step-by-step-setup)
4. [CDP Wallets Implementation](#cdp-wallets-implementation)
5. [x402 Protocol Implementation](#x402-protocol-implementation)
6. [x402 Bazaar Integration](#x402-bazaar-integration)
7. [Complete Agent Example](#complete-agent-example)
8. [API Reference](#api-reference)
9. [Testing & Deployment](#testing--deployment)

---

## Overview

This guide covers building autonomous agents that:
- Use **CDP Wallets** (Embedded or Server-hosted) to manage funds and sign transactions
- Leverage **x402 protocol** for HTTP 402-based micropayments
- Discover services via **x402 Bazaar**
- Chain multiple tool calls with autonomous payment handling

### Key Technologies

**CDP Wallets**
- **Embedded Wallets**: Invisible to users, full on-chain functionality
- **Server Wallets v2**: Backend-controlled wallets for signing, gas abstraction, cross-chain flows
- Zero key management - keys stored in Trusted Execution Environments (TEEs)
- Wallet creation: <500ms, signing latency: <200ms

**x402 Protocol**
- Open-source payment standard using HTTP 402 "Payment Required"
- Machine-to-machine stablecoin payments over HTTP
- Chain and token agnostic
- No accounts or complex authentication required

**x402 Bazaar**
- Service discovery platform for agents
- Enables autonomous finding, probing, and paying for capabilities

---

## Architecture & How Pieces Connect

```
┌─────────────────┐
│   User Intent   │
│  (e.g., "Design │
│  social media   │
│    campaign")   │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────┐
│         Autonomous Agent            │
│  ┌───────────────────────────────┐ │
│  │  1. Query x402 Bazaar         │ │
│  │     - Discover services       │ │
│  │     - Get pricing info        │ │
│  └──────────────┬────────────────┘ │
│                 │                   │
│  ┌──────────────▼────────────────┐ │
│  │  2. Request Tool/Service      │ │
│  │     GET /api/generate-image   │ │
│  └──────────────┬────────────────┘ │
│                 │                   │
│  ┌──────────────▼────────────────┐ │
│  │  3. Receive HTTP 402          │ │
│  │     Payment Required          │ │
│  │     { amount, address, ... }  │ │
│  └──────────────┬────────────────┘ │
│                 │                   │
│  ┌──────────────▼────────────────┐ │
│  │  4. CDP Wallet Signs Payment  │ │
│  │     - Create payment payload  │ │
│  │     - Sign with wallet        │ │
│  └──────────────┬────────────────┘ │
│                 │                   │
│  ┌──────────────▼────────────────┐ │
│  │  5. Retry with X-PAYMENT      │ │
│  │     Header: X-PAYMENT: {...}  │ │
│  └──────────────┬────────────────┘ │
│                 │                   │
│  ┌──────────────▼────────────────┐ │
│  │  6. Receive Resource          │ │
│  │     Chain to next tool        │ │
│  └───────────────────────────────┘ │
└─────────────────────────────────────┘
         │
         ▼
┌─────────────────┐
│  Completed Task  │
└─────────────────┘
```

### Payment Flow Sequence

1. **Agent → Service**: `GET /api/resource`
2. **Service → Agent**: `402 Payment Required` with payment instructions
3. **Agent**: Evaluates cost vs. value
4. **Agent → CDP Wallet**: Signs payment payload
5. **Agent → Service**: `GET /api/resource` with `X-PAYMENT` header
6. **Service → Facilitator**: Verifies payment
7. **Service → Agent**: `200 OK` with resource

---

## Step-by-Step Setup

### 1. Create Coinbase Developer Platform Account

1. Go to [Coinbase Developer Platform](https://www.coinbase.com/developer-platform/)
2. Sign up or log in
3. Navigate to your project dashboard

### 2. Generate CDP API Keys

**For CDP APIs (Recommended: Ed25519)**

1. In CDP dashboard, go to **"API Keys"** → **"Secret API Keys"**
2. Click **"Create API key"**
3. Provide a nickname (e.g., "Agent Wallet Key")
4. Select signature algorithm: **Ed25519** (default for CDP APIs)
5. Configure permissions:
   - Wallet creation
   - Transaction signing
   - Balance queries
6. Click **"Create & Download"**
7. **IMPORTANT**: Save the key pair securely - it won't be shown again!

**For Coinbase App APIs (Use ECDSA)**

- If integrating with Coinbase App APIs, select **ECDSA** instead

### 3. Generate Wallet Secret (For Server Wallets)

1. In Server Wallet dashboard, select your project
2. Navigate to **"Wallet Secret"** section
3. Click **"Generate"**
4. Save the Wallet Secret securely - it won't be displayed again
5. Use this to generate Wallet Authentication JWTs

### 4. Install Dependencies

**TypeScript/Node.js:**
```bash
npm install @coinbase/coinbase-sdk
npm install @coinbase/x402
npm install x402-axios  # For automatic payment handling
npm install axios
npm install dotenv
```

**Python:**
```bash
pip install coinbase-sdk
pip install x402-python  # If available
pip install requests
pip install python-dotenv
```

### 5. Configure Environment Variables

Create a `.env` file:

```env
# CDP API Credentials
CDP_API_KEY_NAME=your-api-key-name
CDP_API_KEY_SECRET=your-api-key-secret-private-key
CDP_WALLET_SECRET=your-wallet-secret  # For Server Wallets

# Network Configuration
CDP_NETWORK=base-sepolia  # or 'base', 'solana-devnet', 'solana-mainnet'

# x402 Facilitator (for testing)
X402_FACILITATOR_URL=https://x402.org/facilitator

# x402 Bazaar
X402_BAZAAR_URL=https://bazaar.x402.org  # Update with actual URL
```

---

## CDP Wallets Implementation

### TypeScript/Node.js Example

```typescript
import { Coinbase } from "@coinbase/coinbase-sdk";
import dotenv from "dotenv";

dotenv.config();

// Initialize CDP SDK
const coinbase = new Coinbase({
  apiKeyName: process.env.CDP_API_KEY_NAME!,
  privateKey: process.env.CDP_API_KEY_SECRET!,
});

// Create a Developer-Managed Wallet
async function createWallet() {
  const wallet = await coinbase.wallets.createWallet({
    name: "Agent Wallet",
    type: "developer_managed",
  });
  
  console.log(`Wallet created: ${wallet.address}`);
  console.log(`Wallet ID: ${wallet.id}`);
  
  return wallet;
}

// Get Wallet Balance
async function getBalance(walletId: string) {
  const balance = await coinbase.wallets.getBalance({
    walletId,
    assetType: "USDC",
  });
  
  return balance;
}

// Sign a Transaction
async function signTransaction(walletId: string, to: string, amount: string) {
  const transaction = await coinbase.wallets.signTransaction({
    walletId,
    to,
    value: amount,
    assetType: "USDC",
    networkId: process.env.CDP_NETWORK || "base-sepolia",
  });
  
  return transaction;
}

// Sign Payment Payload for x402
async function signPaymentPayload(
  walletId: string,
  paymentInstructions: {
    amount: string;
    recipient: string;
    nonce: string;
    timestamp: number;
  }
) {
  // Create payment payload
  const payload = {
    amount: paymentInstructions.amount,
    recipient: paymentInstructions.recipient,
    nonce: paymentInstructions.nonce,
    timestamp: paymentInstructions.timestamp,
  };
  
  // Sign with wallet
  const signedPayload = await coinbase.wallets.signMessage({
    walletId,
    message: JSON.stringify(payload),
  });
  
  return {
    payload,
    signature: signedPayload.signature,
  };
}
```

### Python Example

```python
from coinbase_sdk import Coinbase
import os
from dotenv import load_dotenv

load_dotenv()

# Initialize CDP SDK
coinbase = Coinbase(
    api_key_name=os.getenv("CDP_API_KEY_NAME"),
    private_key=os.getenv("CDP_API_KEY_SECRET"),
)

# Create a Developer-Managed Wallet
def create_wallet():
    wallet = coinbase.wallets.create_wallet(
        name="Agent Wallet",
        type="developer_managed"
    )
    print(f"Wallet created: {wallet.address}")
    print(f"Wallet ID: {wallet.id}")
    return wallet

# Get Wallet Balance
def get_balance(wallet_id: str):
    balance = coinbase.wallets.get_balance(
        wallet_id=wallet_id,
        asset_type="USDC"
    )
    return balance

# Sign Payment Payload for x402
def sign_payment_payload(wallet_id: str, payment_instructions: dict):
    payload = {
        "amount": payment_instructions["amount"],
        "recipient": payment_instructions["recipient"],
        "nonce": payment_instructions["nonce"],
        "timestamp": payment_instructions["timestamp"],
    }
    
    signed_payload = coinbase.wallets.sign_message(
        wallet_id=wallet_id,
        message=json.dumps(payload)
    )
    
    return {
        "payload": payload,
        "signature": signed_payload.signature,
    }
```

### Wallet Types

**Developer-Managed Wallets**
- Full control via API
- Suitable for autonomous agents
- No user interaction required

**User-Managed Wallets (Embedded)**
- User controls via UI
- Better for user-facing applications
- Requires user approval for transactions

---

## x402 Protocol Implementation

### Understanding HTTP 402 Response

When a service requires payment, it responds with:

```http
HTTP/1.1 402 Payment Required
Content-Type: application/json

{
  "scheme": "x402",
  "amount": "0.01",
  "currency": "USDC",
  "recipient": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "network": "base-sepolia",
  "nonce": "unique-nonce-123",
  "timestamp": 1730000000,
  "facilitator": "https://x402.org/facilitator"
}
```

### Client-Side Implementation (TypeScript)

```typescript
import axios from "axios";
import { withPaymentInterceptor } from "x402-axios";
import { Coinbase } from "@coinbase/coinbase-sdk";

// Initialize CDP SDK
const coinbase = new Coinbase({
  apiKeyName: process.env.CDP_API_KEY_NAME!,
  privateKey: process.env.CDP_API_KEY_SECRET!,
});

// Create axios instance with x402 payment interceptor
const apiClient = withPaymentInterceptor(axios.create(), {
  walletId: "your-wallet-id",
  signPayment: async (paymentInstructions) => {
    // Sign payment using CDP Wallet
    const signed = await coinbase.wallets.signMessage({
      walletId: "your-wallet-id",
      message: JSON.stringify(paymentInstructions),
    });
    
    return {
      ...paymentInstructions,
      signature: signed.signature,
    };
  },
});

// Make request - payment handled automatically
async function callPaidService() {
  try {
    const response = await apiClient.get("https://api.example.com/resource");
    return response.data;
  } catch (error) {
    if (error.response?.status === 402) {
      console.log("Payment required, will retry automatically");
    }
    throw error;
  }
}
```

### Manual Payment Handling

```typescript
import axios from "axios";

async function handle402Response(url: string, walletId: string) {
  // Initial request
  let response = await axios.get(url);
  
  // If 402, handle payment
  if (response.status === 402) {
    const paymentInstructions = response.data;
    
    // Sign payment with CDP Wallet
    const signedPayment = await signPaymentPayload(walletId, paymentInstructions);
    
    // Retry with X-PAYMENT header
    response = await axios.get(url, {
      headers: {
        "X-PAYMENT": JSON.stringify(signedPayment),
      },
    });
  }
  
  return response.data;
}
```

### Server-Side Implementation (Express.js)

```typescript
import express from "express";
import { paymentMiddleware } from "x402-express";

const app = express();

// Configure payment middleware
app.use(
  paymentMiddleware(
    "0xYourWalletAddress", // Your wallet address
    {
      "/api/generate-image": "$0.01",
      "/api/write-caption": "$0.005",
      "/api/post-social": "$0.02",
    },
    {
      facilitator: process.env.X402_FACILITATOR_URL,
      network: "base-sepolia",
    }
  )
);

// Protected endpoint
app.get("/api/generate-image", (req, res) => {
  // Payment already verified by middleware
  res.json({
    imageUrl: "https://example.com/generated-image.png",
  });
});

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
```

### Python Implementation (Flask)

```python
from flask import Flask, request, jsonify
from x402_flask import payment_middleware

app = Flask(__name__)

# Configure payment middleware
app.wsgi_app = payment_middleware(
    app.wsgi_app,
    "0xYourWalletAddress",
    {
        "/api/generate-image": "0.01",
        "/api/write-caption": "0.005",
    },
    facilitator=os.getenv("X402_FACILITATOR_URL"),
    network="base-sepolia"
)

@app.route("/api/generate-image", methods=["GET"])
def generate_image():
    # Payment verified by middleware
    return jsonify({
        "imageUrl": "https://example.com/generated-image.png"
    })

if __name__ == "__main__":
    app.run(port=3000)
```

---

## x402 Bazaar Integration

The x402 Bazaar enables agents to discover available services.

### Querying the Bazaar

```typescript
import axios from "axios";

interface BazaarService {
  id: string;
  name: string;
  description: string;
  endpoint: string;
  price: string;
  category: string;
  metadata: Record<string, any>;
}

async function discoverServices(query: string): Promise<BazaarService[]> {
  const response = await axios.get(
    `${process.env.X402_BAZAAR_URL}/services`,
    {
      params: {
        q: query,
        category: "ai-tools", // Optional filter
      },
    }
  );
  
  return response.data.services;
}

// Example: Find image generation services
async function findImageGenerators() {
  const services = await discoverServices("image generation");
  return services.filter(s => s.category === "image-generation");
}
```

### Probing Services

```typescript
async function probeService(serviceId: string) {
  const service = await axios.get(
    `${process.env.X402_BAZAAR_URL}/services/${serviceId}`
  );
  
  // Get pricing and capabilities
  const probe = await axios.get(
    `${process.env.X402_BAZAAR_URL}/services/${serviceId}/probe`
  );
  
  return {
    service: service.data,
    pricing: probe.data.pricing,
    capabilities: probe.data.capabilities,
  };
}
```

---

## Complete Agent Example

### TypeScript Agent Implementation

```typescript
import { Coinbase } from "@coinbase/coinbase-sdk";
import axios from "axios";
import { withPaymentInterceptor } from "x402-axios";
import dotenv from "dotenv";

dotenv.config();

class AgenticCommerceAgent {
  private coinbase: Coinbase;
  private walletId: string;
  private apiClient: any;
  
  constructor() {
    this.coinbase = new Coinbase({
      apiKeyName: process.env.CDP_API_KEY_NAME!,
      privateKey: process.env.CDP_API_KEY_SECRET!,
    });
  }
  
  async initialize() {
    // Create or get wallet
    const wallet = await this.coinbase.wallets.createWallet({
      name: "Agent Wallet",
      type: "developer_managed",
    });
    
    this.walletId = wallet.id;
    
    // Setup API client with payment interceptor
    this.apiClient = withPaymentInterceptor(axios.create(), {
      walletId: this.walletId,
      signPayment: async (instructions) => {
        return await this.signPayment(instructions);
      },
    });
    
    console.log(`Agent initialized with wallet: ${wallet.address}`);
  }
  
  async signPayment(instructions: any) {
    const signed = await this.coinbase.wallets.signMessage({
      walletId: this.walletId,
      message: JSON.stringify(instructions),
    });
    
    return {
      ...instructions,
      signature: signed.signature,
    };
  }
  
  async discoverServices(task: string): Promise<any[]> {
    const response = await axios.get(
      `${process.env.X402_BAZAAR_URL}/services`,
      {
        params: { q: task },
      }
    );
    
    return response.data.services;
  }
  
  async executeTask(userIntent: string) {
    console.log(`Executing task: ${userIntent}`);
    
    // 1. Discover relevant services
    const services = await this.discoverServices(userIntent);
    console.log(`Found ${services.length} services`);
    
    // 2. Evaluate and select services
    const selectedServices = this.selectServices(services, userIntent);
    
    // 3. Execute chained tool calls
    const results = [];
    for (const service of selectedServices) {
      try {
        console.log(`Calling service: ${service.name}`);
        const result = await this.apiClient.post(service.endpoint, {
          task: userIntent,
          previousResults: results,
        });
        
        results.push({
          service: service.name,
          result: result.data,
          cost: service.price,
        });
      } catch (error) {
        console.error(`Error calling ${service.name}:`, error);
      }
    }
    
    // 4. Aggregate results
    return this.aggregateResults(results);
  }
  
  private selectServices(services: any[], task: string): any[] {
    // Simple selection logic - can be enhanced with LLM reasoning
    return services
      .sort((a, b) => parseFloat(a.price) - parseFloat(b.price))
      .slice(0, 3); // Select top 3 cheapest
  }
  
  private aggregateResults(results: any[]): any {
    return {
      task: "completed",
      steps: results.length,
      totalCost: results.reduce((sum, r) => sum + parseFloat(r.cost), 0),
      results: results,
    };
  }
  
  async getBalance() {
    const balance = await this.coinbase.wallets.getBalance({
      walletId: this.walletId,
      assetType: "USDC",
    });
    
    return balance;
  }
}

// Usage
async function main() {
  const agent = new AgenticCommerceAgent();
  await agent.initialize();
  
  const balance = await agent.getBalance();
  console.log(`Wallet balance: ${balance.total}`);
  
  const result = await agent.executeTask(
    "Design and launch a social media campaign for product X"
  );
  
  console.log("Task completed:", result);
}

main().catch(console.error);
```

---

## API Reference

### CDP Wallet API

**Base URL**: `https://api.cdp.coinbase.com`

**Create Wallet**
```http
POST /v1/wallets
Authorization: Bearer {JWT}
Content-Type: application/json

{
  "name": "Agent Wallet",
  "type": "developer_managed"
}
```

**Get Balance**
```http
GET /v1/wallets/{walletId}/balances?assetType=USDC
Authorization: Bearer {JWT}
```

**Sign Transaction**
```http
POST /v1/wallets/{walletId}/transactions
Authorization: Bearer {JWT}
Content-Type: application/json

{
  "to": "0x...",
  "value": "0.01",
  "assetType": "USDC",
  "networkId": "base-sepolia"
}
```

**Sign Message**
```http
POST /v1/wallets/{walletId}/sign
Authorization: Bearer {JWT}
Content-Type: application/json

{
  "message": "payment payload string"
}
```

### x402 Protocol

**Payment Instructions (402 Response)**
```json
{
  "scheme": "x402",
  "amount": "0.01",
  "currency": "USDC",
  "recipient": "0x...",
  "network": "base-sepolia",
  "nonce": "unique-nonce",
  "timestamp": 1730000000,
  "facilitator": "https://x402.org/facilitator"
}
```

**X-PAYMENT Header Format**
```http
X-PAYMENT: {"scheme":"x402","amount":"0.01","recipient":"0x...","signature":"0x..."}
```

### x402 Bazaar API

**Discover Services**
```http
GET /services?q={query}&category={category}
```

**Get Service Details**
```http
GET /services/{serviceId}
```

**Probe Service**
```http
GET /services/{serviceId}/probe
```

---

## Testing & Deployment

### Testnet Configuration

**Base Sepolia (Ethereum L2)**
- Network ID: `base-sepolia`
- Facilitator: `https://x402.org/facilitator`
- Test USDC available via faucets

**Solana Devnet**
- Network: `solana-devnet`
- Facilitator: Community-maintained
- Test tokens available

### Testing Checklist

1. ✅ Create CDP Wallet on testnet
2. ✅ Fund wallet with test USDC
3. ✅ Test x402 payment flow with test service
4. ✅ Verify payment interceptor works
5. ✅ Test service discovery via Bazaar
6. ✅ Test chained tool calls
7. ✅ Monitor transaction costs
8. ✅ Test error handling (insufficient funds, network errors)

### Mainnet Deployment

1. **Switch to Mainnet**
   - Update `CDP_NETWORK` to `base` or `solana-mainnet`
   - Use production facilitator URL
   - Fund wallet with real USDC

2. **Security Considerations**
   - Rotate API keys regularly
   - Implement IP whitelisting
   - Set spending limits on wallet
   - Monitor transactions
   - Use environment variables for secrets

3. **Production Facilitator**
   - CDP-hosted facilitator for Base mainnet
   - Fee-free USDC payments
   - Requires CDP account

### Monitoring

```typescript
async function monitorAgent(agent: AgenticCommerceAgent) {
  const balance = await agent.getBalance();
  
  console.log(`Current balance: ${balance.total} USDC`);
  console.log(`Available: ${balance.available} USDC`);
  
  // Set up alerts for low balance
  if (parseFloat(balance.available) < 1.0) {
    console.warn("Low balance warning!");
  }
}
```

---

## Additional Resources

### Official Documentation
- [CDP Wallets Documentation](https://docs.cdp.coinbase.com/embedded-wallets/welcome)
- [Server Wallets v2 Quickstart](https://docs.cdp.coinbase.com/server-wallets/v2/introduction/quickstart)
- [x402 Protocol Documentation](https://docs.cdp.coinbase.com/x402/welcome)
- [x402 GitHub Repository](https://github.com/coinbase/x402)
- [x402 Whitepaper](https://www.x402.org/x402-whitepaper.pdf)

### Community
- x402 Discord Community
- Coinbase Developer Forums
- GitHub Issues and Discussions

### Network Support
- **Base**: Mainnet and Sepolia testnet
- **Solana**: Mainnet and Devnet
- More networks coming soon

---

## Troubleshooting

### Common Issues

**1. "Invalid API Key"**
- Verify API key name and secret are correct
- Check environment variables are loaded
- Ensure API key has required permissions

**2. "Insufficient Funds"**
- Check wallet balance
- Ensure wallet is funded with USDC
- Verify network matches (testnet vs mainnet)

**3. "Payment Verification Failed"**
- Check facilitator URL is correct
- Verify network matches payment instructions
- Ensure signature is valid

**4. "402 Response Not Handled"**
- Verify x402 interceptor is configured
- Check payment signing function works
- Ensure X-PAYMENT header format is correct

---

## Next Steps

1. Set up your development environment
2. Create CDP API keys
3. Initialize a test wallet
4. Test x402 payment flow
5. Integrate x402 Bazaar for service discovery
6. Build your autonomous agent
7. Test on testnet
8. Deploy to mainnet

Good luck building your agentic commerce agent! 🚀

