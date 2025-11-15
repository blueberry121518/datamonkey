# Data Monkey Architecture Summary

## Maximizing Coinbase Usage

### AI/Generation Services → x402 Bazaar
- All AI and content generation goes through x402 Bazaar
- Agents discover and pay for AI services via Coinbase ecosystem
- Uses x402 protocol for automatic payments

### Dataset Marketplace → Independent (Data Monkey)
- All dataset purchasing goes through Data Monkey independent marketplace
- Buyer agents interact directly with Data Monkey
- Payments via x402 protocol (Coinbase CDP)

## Seller Data Storage

### Unlimited Data Upload
- Sellers can upload unlimited data records to their account
- Stored in `seller_data_storage` table (PostgreSQL JSONB)
- Each record is flexible JSON structure

### Upload Endpoint
```
POST /api/seller/data/upload
{
  "dataset_listing_id": "optional-uuid",
  "records": [
    {"field1": "value1", "field2": 123},
    {"field1": "value2", "field2": 456}
  ],
  "metadata": {}
}
```

## Agent Query System

### Query Endpoint
Agents can ask sellers: "Do you have X data?"

```
GET /api/seller/:sellerId/query?requiredFields=field1,field2&category=Images&sampleSize=10
```

**Response**:
```json
{
  "hasData": true,
  "matchCount": 1000,
  "sampleRecords": [...],
  "qualityScore": 0.95,
  "estimatedPrice": "1.000000"
}
```

### Sample/Probe Endpoint
Get sample records for quality assessment:

```
GET /api/seller/:sellerId/sample?dataset_listing_id=uuid&sampleSize=10
```

## Buyer Agent System

### Initialize Agent
```
POST /api/agents
{
  "name": "Cat Image Collector",
  "goal": "Collect 1000 high-quality cat images",
  "requirements": {
    "category": "Images",
    "requiredFields": ["image_url", "breed", "quality"],
    "minQuality": 0.8
  },
  "budget": 10.0,
  "quality_threshold": 0.8,
  "quantity_required": 1000
}
```

**What happens**:
1. Agent is created with CDP wallet (automatic)
2. Wallet is funded (buyer funds it)
3. Agent can now discover and purchase datasets

### Agent Workflow

```
1. Agent queries marketplace
   GET /api/datasets?category=Images

2. Agent queries each seller
   GET /api/seller/:sellerId/query?requiredFields=image_url,breed

3. Agent gets samples for quality assessment
   GET /api/seller/:sellerId/sample?sampleSize=10

4. Agent evaluates quality
   - Checks qualityScore >= quality_threshold
   - Validates sample records

5. Agent purchases data
   GET /api/datasets/:id/data?quantity=100
   → x402 payment (automatic)
   → Receives data

6. Agent continues until goal met
   - Tracks quantity_acquired
   - Stops when quantity_required reached
```

## API Endpoints

### Seller Endpoints
```
POST   /api/seller/data/upload          # Upload data records
GET    /api/seller/data/count           # Get data count
GET    /api/seller/:sellerId/query      # Query if seller has data (public)
GET    /api/seller/:sellerId/sample     # Get sample records (public)
```

### Buyer Agent Endpoints
```
POST   /api/agents                      # Initialize agent
GET    /api/agents                      # Get buyer's agents
GET    /api/agents/:id                  # Get agent details
PATCH  /api/agents/:id/status           # Update agent status
GET    /api/agents/:id/balance          # Get agent wallet balance
```

### Dataset Endpoints (Existing)
```
GET    /api/datasets                    # Discover datasets
GET    /api/datasets/:id                # Get dataset info
GET    /api/datasets/:id/probe          # Probe dataset (free)
GET    /api/datasets/:id/data           # Purchase data (x402 payment)
```

## Database Schema

### seller_data_storage
- Stores actual data records (unlimited)
- JSONB for flexible schema
- Indexed for fast queries

### buyer_agents
- Agent configuration
- CDP wallet info
- Budget and progress tracking

### dataset_listings
- Dataset metadata
- Pricing and schema
- Links to seller_data_storage

## Coinbase Configuration

**No special configuration needed!** Just:
1. CDP API keys (standard setup)
2. Network: base-sepolia (test) or base (prod)
3. x402 facilitator URL

See `COINBASE_CONFIGURATION.md` for details.

## Flow Diagram

```
┌─────────────────────────────────────────┐
│         Buyer Agent                      │
│  (CDP Wallet - Auto-created)            │
└─────────────────────────────────────────┘
              │
              ▼
    ┌─────────────────────┐
    │  Discover Datasets   │
    │  GET /api/datasets   │
    └─────────────────────┘
              │
              ▼
    ┌─────────────────────┐
    │  Query Each Seller    │
    │  GET /seller/:id/    │
    │      query           │
    └─────────────────────┘
              │
              ▼
    ┌─────────────────────┐
    │  Get Samples        │
    │  GET /seller/:id/   │
    │      sample         │
    └─────────────────────┘
              │
              ▼
    ┌─────────────────────┐
    │  Assess Quality     │
    │  (Check threshold)   │
    └─────────────────────┘
              │
              ▼
    ┌─────────────────────┐
    │  Purchase Data      │
    │  GET /datasets/:id/ │
    │      data           │
    │  → x402 Payment     │
    └─────────────────────┘
              │
              ▼
    ┌─────────────────────┐
    │  Receive Data       │
    │  (From storage)     │
    └─────────────────────┘
```

## Next Steps

1. ✅ Run migrations (004, 005)
2. ✅ Test seller data upload
3. ✅ Test agent query endpoints
4. ✅ Test buyer agent initialization
5. ⏳ Build frontend for agent management
6. ⏳ Implement agent discovery logic

