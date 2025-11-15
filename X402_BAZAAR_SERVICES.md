# x402 Bazaar Services Catalog

## Overview

The **x402 Bazaar** is a machine-readable catalog of services that support the x402 payment protocol. It's a discovery layer that helps AI agents find and pay for APIs and services autonomously.

## Current Status

- **Early Development**: The Bazaar is currently in early stages
- **Network Support**: Base mainnet and Base Sepolia (testnet)
- **Payment**: USDC via Coinbase's hosted facilitator
- **Settlement**: ~200ms transaction time, minimal gas fees

## Service Categories

Based on the x402 ecosystem and examples, the Bazaar typically includes:

### 1. AI/ML Services

**Image Generation**
- AI image generation APIs
- Image editing and manipulation
- Style transfer services
- Example: `/api/generate-image` - $0.01 per image

**Text Generation**
- Content writing services
- Caption generation
- Text summarization
- Example: `/api/write-caption` - $0.005 per caption

**AI Tools**
- General AI processing services
- Model inference endpoints
- Custom AI workflows

### 2. Data Services

**Datasets**
- Structured datasets
- Real-time data feeds
- Historical data access
- **Example**: Data Monkey datasets (when registered)

**Financial Data**
- Real-time market data
- Stock prices
- Crypto prices
- Economic indicators

**Geospatial Data**
- Location services
- Mapping data
- Weather data

### 3. Content Services

**Media Processing**
- Video processing
- Audio processing
- File conversion
- Content moderation

**Social Media**
- Post creation
- Content scheduling
- Analytics

### 4. Utility Services

**API Gateways**
- Proxy services
- Rate limiting
- Request transformation

**Webhooks & Notifications**
- Event triggers
- Notification services

## Example Service Structure

```typescript
interface BazaarService {
  id: string;
  name: string;
  description: string;
  endpoint: string;
  price: string; // Price per request in USDC
  category: string; // e.g., "ai-tools", "image-generation", "datasets"
  metadata: {
    inputSchema?: JSONSchema;
    outputSchema?: JSONSchema;
    capabilities?: string[];
    tags?: string[];
  };
}
```

## Querying the Bazaar

### By Category

```typescript
// AI Tools
GET /services?category=ai-tools

// Image Generation
GET /services?category=image-generation

// Datasets
GET /services?category=datasets

// Financial Data
GET /services?category=financial-data
```

### By Search Query

```typescript
// Search for services
GET /services?q=image generation

// Multiple filters
GET /services?q=financial&category=datasets&minPrice=0.001&maxPrice=0.1
```

## Example Services (Hypothetical)

### 1. Image Generation Service

```json
{
  "id": "img-gen-001",
  "name": "AI Image Generator",
  "description": "Generate images from text prompts",
  "endpoint": "https://api.example.com/generate-image",
  "price": "0.01",
  "category": "image-generation",
  "metadata": {
    "inputSchema": {
      "type": "object",
      "properties": {
        "prompt": { "type": "string" },
        "style": { "type": "string" }
      }
    },
    "outputSchema": {
      "type": "object",
      "properties": {
        "imageUrl": { "type": "string" }
      }
    }
  }
}
```

### 2. Financial Data Service

```json
{
  "id": "finance-001",
  "name": "Real-time Stock Prices",
  "description": "Get real-time stock prices",
  "endpoint": "https://api.example.com/stock-prices",
  "price": "0.005",
  "category": "financial-data",
  "metadata": {
    "inputSchema": {
      "type": "object",
      "properties": {
        "symbol": { "type": "string" }
      }
    }
  }
}
```

### 3. Dataset Service (Data Monkey)

```json
{
  "id": "datamonkey-001",
  "name": "Data Monkey - Cat Images Dataset",
  "description": "High-quality cat images dataset",
  "endpoint": "https://datamonkey.com/api/datasets/abc123/data",
  "price": "0.001",
  "category": "datasets",
  "metadata": {
    "category": "Images",
    "totalRows": 10000,
    "qualityScore": 0.95
  }
}
```

## Service Discovery Flow

```
1. Agent queries Bazaar
   GET /services?q=image generation

2. Bazaar returns matching services
   [
     { id: "img-1", name: "Service A", price: "0.01" },
     { id: "img-2", name: "Service B", price: "0.008" }
   ]

3. Agent probes services (free)
   GET /services/img-1/probe
   GET /services/img-2/probe

4. Agent selects best service
   - Compares price, quality, capabilities

5. Agent calls service with x402 payment
   GET https://api.example.com/generate-image
   → HTTP 402 Payment Required
   → Agent signs payment
   → Retry with X-PAYMENT header
   → Service returns result
```

## Categories in x402 Bazaar

Based on examples and ecosystem:

1. **ai-tools** - General AI services
2. **image-generation** - Image creation/editing
3. **text-generation** - Content writing
4. **datasets** - Data access
5. **financial-data** - Market data
6. **media-processing** - Video/audio
7. **webhooks** - Event services
8. **utilities** - Helper services

## Registering Your Service

To register Data Monkey datasets in x402 Bazaar:

```typescript
// Register dataset endpoint
await registerWithBazaar({
  name: "Data Monkey - Cat Images",
  description: "High-quality cat images dataset",
  endpoint: "https://datamonkey.com/api/datasets/{id}/data",
  category: "datasets",
  price: "0.001", // per record
  metadata: {
    inputSchema: {
      type: "object",
      properties: {
        quantity: { type: "number" }
      }
    },
    outputSchema: dataset.schema,
    tags: ["images", "cats", "datasets"]
  },
  discoverable: true
});
```

## Current Limitations

1. **Early Stage**: Limited number of services currently
2. **Network**: Only Base mainnet/Sepolia (more coming)
3. **Currency**: Only USDC (more tokens planned)
4. **Manual Registration**: Services need to be registered

## Future Expansion

Planned additions:
- More networks (Solana, Ethereum, etc.)
- More tokens (beyond USDC)
- More service categories
- Better discovery algorithms
- Service ratings/reviews

## How to Use

### 1. Query Bazaar

```typescript
const services = await axios.get(`${X402_BAZAAR_URL}/services`, {
  params: { q: "image generation", category: "ai-tools" }
});
```

### 2. Probe Service

```typescript
const probe = await axios.get(`${X402_BAZAAR_URL}/services/${serviceId}/probe`);
// Returns: pricing, capabilities, schemas
```

### 3. Call Service

```typescript
// Use x402 client (handles payment automatically)
const result = await x402Client.get(service.endpoint, {
  params: { prompt: "a cat" }
});
```

## Data Monkey Integration

Data Monkey can:
1. **Query Bazaar** - Find other x402 services
2. **Register Datasets** - List datasets in Bazaar
3. **Hybrid Discovery** - Use both Data Monkey API and Bazaar

```typescript
// Agent can discover from both sources
const datamonkeyDatasets = await queryDataMonkey({ category: "Images" });
const bazaarServices = await queryBazaar({ category: "datasets" });

// Combine results
const allServices = [...datamonkeyDatasets, ...bazaarServices];
```

## Summary

The x402 Bazaar is a **growing ecosystem** of services that:
- Accept x402 payments (pay-per-use)
- Are discoverable by AI agents
- Support autonomous transactions
- Include AI tools, datasets, financial data, and more

**Current State**: Early development, limited services
**Future**: Expanding to more networks, tokens, and service types

For Data Monkey, you can:
- Use Bazaar to discover other services
- Register your datasets in Bazaar (optional)
- Use both direct API and Bazaar discovery

