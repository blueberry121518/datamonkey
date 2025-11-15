# x402 Services vs Traditional APIs (OpenAI, Claude)

## Key Distinction

**OpenAI and Claude themselves do NOT use x402 protocol.** They use traditional API keys.

However, **third-party developers can create x402 wrapper services** that use OpenAI/Claude internally.

## Two Scenarios

### Scenario 1: Direct API Access (Traditional)

```
Your Agent
    │
    ▼
OpenAI API (API Key)
    │
    ▼
Response
```

- **Payment**: Monthly subscription or pay-as-you-go via OpenAI billing
- **Authentication**: API key
- **No x402**: OpenAI doesn't support x402 protocol

### Scenario 2: x402 Wrapper Service

```
Your Agent
    │
    ▼
x402 Service (Wrapper)
    │
    ├─ Uses OpenAI/Claude internally (with API key)
    ├─ Charges you via x402 (pay-per-request)
    └─ Adds markup for convenience
    │
    ▼
Response
```

- **Payment**: x402 protocol (pay-per-request)
- **Authentication**: x402 payment (no API key needed)
- **Backend**: Uses OpenAI/Claude with their own API key

## How It Works

### Example: x402 Text Generation Service

```typescript
// x402 Service (Wrapper) Implementation
class X402TextGenerationService {
  private openaiApiKey: string; // Service owner's API key
  
  // This endpoint uses x402 payment
  async generateText(prompt: string) {
    // 1. Verify x402 payment (already done by middleware)
    
    // 2. Call OpenAI internally (using service owner's API key)
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
    });
    
    // 3. Return result
    return response.choices[0].message.content;
  }
}
```

**Flow:**
1. Agent calls x402 service: `POST /api/generate-text`
2. Service returns HTTP 402: "Pay $0.01"
3. Agent pays via x402
4. Service calls OpenAI internally (with their API key)
5. Service returns OpenAI's response

## Why Use x402 Wrappers?

### Benefits for Agents:
- ✅ **No API key needed** - Just pay per request
- ✅ **No subscription** - Pay only when you use it
- ✅ **Automatic payment** - x402 handles it
- ✅ **Discoverable** - Found via x402 Bazaar

### Benefits for Service Providers:
- ✅ **Monetization** - Charge per request
- ✅ **No billing infrastructure** - x402 handles payments
- ✅ **Easy discovery** - Listed in x402 Bazaar
- ✅ **Flexible pricing** - Set your own rates

## Cost Comparison

### Direct OpenAI Access:
```
OpenAI API: $0.03 per 1K tokens (GPT-4)
Your cost: $0.03 per request
```

### x402 Wrapper Service:
```
x402 Service: $0.05 per request
  ├─ OpenAI cost: $0.03 (internal)
  └─ Service markup: $0.02 (profit)
Your cost: $0.05 per request
```

**Trade-off**: Slightly more expensive, but no API key needed and pay-per-use.

## Real-World Examples

### Type 1: Native x402 Services
Services built specifically for x402 ecosystem:
- Custom AI models
- Specialized datasets
- Unique processing services

### Type 2: Wrapper Services
Services that wrap traditional APIs:
- OpenAI wrapper → x402 endpoint
- Claude wrapper → x402 endpoint
- Google API wrapper → x402 endpoint

### Type 3: Hybrid Services
Services that combine multiple APIs:
- Uses OpenAI + Claude + custom logic
- Charges via x402
- Provides unified interface

## Implementation Example

### Creating an x402 Wrapper for OpenAI

```typescript
import express from "express";
import { paymentMiddleware } from "x402-express";
import OpenAI from "openai";

const app = express();
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // Your API key
});

// x402 payment middleware
app.use(
  paymentMiddleware(
    "0xYourWalletAddress",
    {
      "/api/generate-text": "$0.01", // Charge $0.01 per request
    },
    {
      facilitator: process.env.X402_FACILITATOR_URL,
      network: "base-sepolia",
    }
  )
);

// Endpoint that uses OpenAI internally
app.post("/api/generate-text", async (req, res) => {
  // Payment already verified by middleware
  
  // Call OpenAI (using your API key)
  const completion = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [{ role: "user", content: req.body.prompt }],
  });
  
  // Return result
  res.json({
    text: completion.choices[0].message.content,
  });
});

// Register in x402 Bazaar
await registerWithBazaar({
  name: "OpenAI Text Generation",
  endpoint: "https://your-service.com/api/generate-text",
  category: "text-generation",
  price: "0.01",
  discoverable: true,
});
```

## What's Actually in x402 Bazaar?

### Current Services:
1. **Native x402 Services**
   - Built specifically for x402
   - Don't use OpenAI/Claude
   - Custom implementations

2. **Wrapper Services** (if any exist)
   - Wrap OpenAI/Claude
   - Charge via x402
   - Add convenience layer

3. **Hybrid Services**
   - Combine multiple APIs
   - Custom logic + traditional APIs
   - Unified x402 interface

## For Your Agent

### Option 1: Use OpenAI/Claude Directly
```typescript
// Direct API key access
const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const response = await claude.messages.create({ ... });
```
- ✅ Cheaper (no markup)
- ✅ Direct access
- ❌ Need API key
- ❌ Subscription/billing

### Option 2: Use x402 Wrapper Service
```typescript
// x402 payment (no API key needed)
const response = await x402Client.post("https://x402-service.com/generate", {
  prompt: "Write a story"
});
```
- ✅ No API key needed
- ✅ Pay-per-use
- ✅ Automatic payment
- ❌ More expensive (markup)
- ❌ Dependent on wrapper service

### Option 3: Build Your Own Wrapper
```typescript
// Your own x402 service that wraps OpenAI
// You control pricing and implementation
```
- ✅ Full control
- ✅ Can monetize
- ❌ Need to build/maintain

## Summary

**Question**: Do x402 text generation services use OpenAI/Claude?

**Answer**: 
- **OpenAI/Claude themselves**: No, they use API keys
- **x402 Bazaar services**: Maybe - some might be wrappers
- **Most likely**: x402 services are separate implementations or wrappers

**For your agent**: You can use both:
- **Claude directly** (API key) - for reasoning, analysis
- **x402 services** (payment) - for datasets, specialized services
- **x402 wrappers** (if available) - for convenience, no API key needed

The x402 ecosystem is complementary to traditional APIs, not a replacement.

