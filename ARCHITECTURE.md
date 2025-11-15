# Data Monkey Architecture: Discovery & Quality Assessment

## 1. Marketplace Independence vs Integration

Data Monkey can operate in **three modes**:

### Option A: Independent Marketplace (Recommended for MVP)
- Data Monkey is a **specialized dataset marketplace**
- Agents query Data Monkey directly for datasets
- Faster iteration, full control over discovery logic
- Can add x402 Bazaar integration later

### Option B: Hybrid Approach (Best of Both Worlds)
- Data Monkey is the **primary discovery layer** for datasets
- Data Monkey **registers its services** with x402 Bazaar
- Agents can discover via:
  - Direct Data Monkey API (specialized, faster)
  - x402 Bazaar (broader ecosystem discovery)
- Data Monkey services appear in both places

### Option C: Full Integration
- Data Monkey services are **only** registered in x402 Bazaar
- Agents discover via x402 Bazaar standard API
- Less control, but maximum ecosystem compatibility

**Recommendation**: Start with **Option A**, add **Option B** later for ecosystem growth.

---

## 2. Multi-Endpoint Discovery Flow

Agents should **always** discover and evaluate **multiple endpoints** before purchasing:

```typescript
interface DatasetDiscovery {
  // Discovery phase
  discoverDatasets(goal: AgentGoal): Promise<DatasetCandidate[]>;
  
  // Evaluation phase
  probeCandidates(candidates: DatasetCandidate[]): Promise<EvaluatedDataset[]>;
  
  // Selection phase
  selectBestDatasets(evaluated: EvaluatedDataset[]): DatasetCandidate[];
  
  // Purchase phase
  purchaseAndValidate(dataset: DatasetCandidate): Promise<PurchaseResult>;
}

interface DatasetCandidate {
  id: string;
  sellerId: string;
  endpoint: string;
  type: 'api' | 'agent';
  price: string;
  metadata: {
    category: string;
    schema?: JSONSchema;
    sampleSize?: number;
    qualityScore?: number; // Historical
    sellerReputation?: number;
  };
  source: 'datamonkey' | 'x402-bazaar'; // Where it was discovered
}

interface EvaluatedDataset extends DatasetCandidate {
  probeResult: {
    available: boolean;
    responseTime: number;
    schemaMatch: number; // 0-1 score
    sampleQuality: number; // 0-1 score (if sample provided)
    estimatedCost: string;
  };
  overallScore: number; // Combined score for ranking
}
```

### Discovery Implementation

```typescript
class DataMonkeyAgent {
  async discoverDatasets(goal: AgentGoal): Promise<DatasetCandidate[]> {
    const candidates: DatasetCandidate[] = [];
    
    // 1. Query Data Monkey marketplace
    const datamonkeyResults = await this.queryDataMonkey({
      category: goal.category,
      requiredFields: goal.requiredFields,
      minQuality: goal.qualityThreshold,
    });
    candidates.push(...datamonkeyResults.map(r => ({
      ...r,
      source: 'datamonkey' as const,
    })));
    
    // 2. Query x402 Bazaar (if integrated)
    if (this.config.enableBazaarDiscovery) {
      const bazaarResults = await this.queryX402Bazaar({
        q: goal.description,
        category: 'datasets',
      });
      candidates.push(...bazaarResults.map(r => ({
        ...r,
        source: 'x402-bazaar' as const,
      })));
    }
    
    // 3. Deduplicate (same endpoint, different sources)
    return this.deduplicateCandidates(candidates);
  }
  
  async probeCandidates(candidates: DatasetCandidate[]): Promise<EvaluatedDataset[]> {
    const evaluated: EvaluatedDataset[] = [];
    
    // Probe all candidates in parallel (with limit)
    const probePromises = candidates.slice(0, 10).map(async (candidate) => {
      try {
        const startTime = Date.now();
        
        // Request sample/metadata (free probe endpoint)
        const probeResponse = await axios.get(`${candidate.endpoint}/probe`, {
          params: {
            sample: true, // Request sample data
            schema: true,  // Request schema
          },
          timeout: 5000, // 5s timeout
        });
        
        const responseTime = Date.now() - startTime;
        
        // Evaluate quality
        const schemaMatch = this.validateSchema(
          probeResponse.data.schema,
          candidate.metadata.schema,
          this.goal.requiredFields
        );
        
        const sampleQuality = this.assessSampleQuality(
          probeResponse.data.sample,
          this.goal.qualityCriteria
        );
        
        return {
          ...candidate,
          probeResult: {
            available: true,
            responseTime,
            schemaMatch,
            sampleQuality,
            estimatedCost: this.calculateEstimatedCost(candidate, this.goal.quantity),
          },
          overallScore: this.calculateOverallScore({
            price: parseFloat(candidate.price),
            schemaMatch,
            sampleQuality,
            responseTime,
            sellerReputation: candidate.metadata.sellerReputation || 0.5,
            historicalQuality: candidate.metadata.qualityScore || 0.5,
          }),
        } as EvaluatedDataset;
      } catch (error) {
        // Candidate unavailable or probe failed
        return {
          ...candidate,
          probeResult: {
            available: false,
            responseTime: Infinity,
            schemaMatch: 0,
            sampleQuality: 0,
            estimatedCost: '0',
          },
          overallScore: 0,
        } as EvaluatedDataset;
      }
    });
    
    return await Promise.all(probePromises);
  }
  
  selectBestDatasets(evaluated: EvaluatedDataset[]): DatasetCandidate[] {
    // Filter out unavailable
    const available = evaluated.filter(e => e.probeResult.available);
    
    // Sort by overall score (quality + price + reputation)
    const sorted = available.sort((a, b) => b.overallScore - a.overallScore);
    
    // Select top N (e.g., top 3-5)
    return sorted.slice(0, this.config.maxCandidates).map(e => ({
      id: e.id,
      sellerId: e.sellerId,
      endpoint: e.endpoint,
      type: e.type,
      price: e.price,
      metadata: e.metadata,
      source: e.source,
    }));
  }
}
```

---

## 3. Quality Assessment Strategy

Quality assessment happens at **multiple stages**:

### Stage 1: Pre-Purchase (Free Probe)

```typescript
interface ProbeEndpoint {
  // Seller provides free probe endpoint
  GET /probe?sample=true&schema=true
  
  // Returns (no payment required):
  {
    available: boolean;
    schema: JSONSchema;        // Data structure
    sample: any[];             // Small sample (e.g., 5-10 records)
    metadata: {
      totalRecords: number;
      lastUpdated: string;
      qualityMetrics: {
        completeness: number;  // % of non-null fields
        consistency: number;   // Schema adherence
        freshness: number;     // How recent
      };
    };
    pricing: {
      perRecord: string;
      perBatch: string;
      minBatch: number;
    };
  }
}
```

### Stage 2: Sample Purchase (Small Batch Test)

```typescript
async function purchaseAndValidate(
  dataset: DatasetCandidate,
  goal: AgentGoal
): Promise<PurchaseResult> {
  // 1. Purchase small test batch (e.g., 10-50 records)
  const testBatch = await this.purchaseBatch(dataset, {
    quantity: Math.min(50, goal.quantity * 0.1), // 10% or 50, whichever smaller
  });
  
  // 2. Validate quality
  const qualityScore = this.validateDataQuality(testBatch.data, {
    requiredFields: goal.requiredFields,
    qualityThreshold: goal.qualityThreshold,
    formatRequirements: goal.formatRequirements,
  });
  
  // 3. Decision
  if (qualityScore >= goal.qualityThreshold) {
    // Quality passes - purchase full batch
    return {
      passed: true,
      qualityScore,
      testBatch,
      proceedWithFullPurchase: true,
    };
  } else {
    // Quality fails - try next candidate
    return {
      passed: false,
      qualityScore,
      testBatch,
      proceedWithFullPurchase: false,
      reason: `Quality score ${qualityScore} below threshold ${goal.qualityThreshold}`,
    };
  }
}
```

### Stage 3: Quality Validation Logic

```typescript
class QualityValidator {
  validateDataQuality(
    data: any[],
    requirements: QualityRequirements
  ): number {
    let score = 0;
    let maxScore = 0;
    
    // 1. Schema compliance (30% weight)
    maxScore += 30;
    const schemaScore = this.validateSchema(data, requirements.schema);
    score += schemaScore * 0.3;
    
    // 2. Required fields presence (25% weight)
    maxScore += 25;
    const completenessScore = this.checkCompleteness(data, requirements.requiredFields);
    score += completenessScore * 0.25;
    
    // 3. Data format correctness (20% weight)
    maxScore += 20;
    const formatScore = this.validateFormats(data, requirements.formatRequirements);
    score += formatScore * 0.2;
    
    // 4. Data consistency (15% weight)
    maxScore += 15;
    const consistencyScore = this.checkConsistency(data);
    score += consistencyScore * 0.15;
    
    // 5. Freshness/recency (10% weight)
    maxScore += 10;
    const freshnessScore = this.checkFreshness(data, requirements.maxAge);
    score += freshnessScore * 0.1;
    
    return score / maxScore; // Normalize to 0-1
  }
  
  private validateSchema(data: any[], schema: JSONSchema): number {
    // Use JSON Schema validator
    const validator = new Ajv().compile(schema);
    const validCount = data.filter(record => validator(record)).length;
    return validCount / data.length; // 0-1 score
  }
  
  private checkCompleteness(data: any[], requiredFields: string[]): number {
    let totalFields = 0;
    let presentFields = 0;
    
    data.forEach(record => {
      requiredFields.forEach(field => {
        totalFields++;
        if (record[field] !== undefined && record[field] !== null) {
          presentFields++;
        }
      });
    });
    
    return presentFields / totalFields; // 0-1 score
  }
  
  private validateFormats(data: any[], formatRequirements: FormatRequirements): number {
    // Validate email formats, date formats, number ranges, etc.
    let validCount = 0;
    let totalChecks = 0;
    
    data.forEach(record => {
      Object.entries(formatRequirements).forEach(([field, validator]) => {
        totalChecks++;
        if (validator(record[field])) {
          validCount++;
        }
      });
    });
    
    return validCount / totalChecks; // 0-1 score
  }
  
  private checkConsistency(data: any[]): number {
    // Check for duplicates, outliers, logical inconsistencies
    // Simplified example
    const uniqueCount = new Set(data.map(d => JSON.stringify(d))).size;
    return uniqueCount / data.length; // Higher is better, capped at 1.0
  }
  
  private checkFreshness(data: any[], maxAge?: number): number {
    if (!maxAge) return 1.0; // No freshness requirement
    
    // Check timestamp fields
    const now = Date.now();
    const validCount = data.filter(record => {
      const timestamp = this.extractTimestamp(record);
      return timestamp && (now - timestamp) < maxAge;
    }).length;
    
    return validCount / data.length; // 0-1 score
  }
}
```

### Stage 4: Historical Quality Tracking

```typescript
interface SellerReputation {
  sellerId: string;
  totalTransactions: number;
  successfulTransactions: number;
  averageQualityScore: number; // From past purchases
  averageResponseTime: number;
  refundRate: number;
  lastUpdated: string;
}

// Update after each purchase
async function updateSellerReputation(
  sellerId: string,
  purchaseResult: PurchaseResult
) {
  await db.sellerReputations.upsert({
    sellerId,
    totalTransactions: { increment: 1 },
    successfulTransactions: purchaseResult.passed 
      ? { increment: 1 } 
      : { increment: 0 },
    averageQualityScore: {
      // Running average
      update: (current, count) => 
        (current * (count - 1) + purchaseResult.qualityScore) / count
    },
  });
}
```

---

## 4. Complete Agent Flow Example

```typescript
class DataMonkeyAgent {
  async executeGoal(goal: AgentGoal): Promise<GoalResult> {
    console.log(`🎯 Starting goal: ${goal.description}`);
    
    // STEP 1: Discover multiple candidates
    console.log('🔍 Discovering datasets...');
    const candidates = await this.discoverDatasets(goal);
    console.log(`Found ${candidates.length} potential datasets`);
    
    // STEP 2: Probe all candidates
    console.log('🔬 Probing candidates...');
    const evaluated = await this.probeCandidates(candidates);
    const available = evaluated.filter(e => e.probeResult.available);
    console.log(`${available.length} datasets are available`);
    
    // STEP 3: Select best candidates
    console.log('⭐ Selecting best candidates...');
    const selected = this.selectBestDatasets(evaluated);
    console.log(`Selected ${selected.length} top candidates`);
    
    // STEP 4: Try candidates in order until quality passes
    const purchased: PurchaseResult[] = [];
    let totalPurchased = 0;
    
    for (const candidate of selected) {
      if (totalPurchased >= goal.quantity) break;
      
      console.log(`🧪 Testing candidate: ${candidate.id}`);
      
      // Purchase small test batch
      const testResult = await this.purchaseAndValidate(candidate, {
        ...goal,
        quantity: Math.min(50, goal.quantity - totalPurchased),
      });
      
      if (testResult.passed) {
        console.log(`✅ Quality passed (${testResult.qualityScore.toFixed(2)})`);
        
        // Purchase remaining quantity
        const remaining = goal.quantity - totalPurchased;
        const fullPurchase = await this.purchaseBatch(candidate, {
          quantity: remaining,
        });
        
        purchased.push(fullPurchase);
        totalPurchased += remaining;
        
        // Update seller reputation
        await this.updateSellerReputation(candidate.sellerId, testResult);
      } else {
        console.log(`❌ Quality failed (${testResult.qualityScore.toFixed(2)})`);
        console.log(`   Reason: ${testResult.reason}`);
        // Try next candidate
      }
    }
    
    // STEP 5: Aggregate results
    return {
      goalId: goal.id,
      success: totalPurchased >= goal.quantity * 0.8, // 80% threshold
      totalPurchased,
      totalSpent: purchased.reduce((sum, p) => sum + parseFloat(p.cost), 0),
      purchases: purchased,
      qualityScores: purchased.map(p => p.qualityScore),
    };
  }
}
```

---

## 5. Database Schema for Tracking

```sql
-- Seller listings
CREATE TABLE dataset_listings (
  id UUID PRIMARY KEY,
  seller_id UUID REFERENCES users(id),
  endpoint TEXT NOT NULL,
  type TEXT CHECK (type IN ('api', 'agent')),
  price_per_record DECIMAL NOT NULL,
  metadata JSONB,
  schema JSONB,
  quality_score DECIMAL, -- Historical average
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Seller reputation
CREATE TABLE seller_reputations (
  seller_id UUID PRIMARY KEY REFERENCES users(id),
  total_transactions INTEGER DEFAULT 0,
  successful_transactions INTEGER DEFAULT 0,
  average_quality_score DECIMAL,
  average_response_time_ms INTEGER,
  refund_rate DECIMAL,
  last_updated TIMESTAMP DEFAULT NOW()
);

-- Purchase history (for quality tracking)
CREATE TABLE purchases (
  id UUID PRIMARY KEY,
  buyer_id UUID REFERENCES users(id),
  seller_id UUID REFERENCES users(id),
  dataset_listing_id UUID REFERENCES dataset_listings(id),
  quantity INTEGER,
  cost DECIMAL,
  quality_score DECIMAL, -- Post-purchase validation
  passed_validation BOOLEAN,
  transaction_hash TEXT, -- x402 payment tx
  created_at TIMESTAMP DEFAULT NOW()
);

-- Agent goals
CREATE TABLE agent_goals (
  id UUID PRIMARY KEY,
  buyer_id UUID REFERENCES users(id),
  description TEXT,
  category TEXT,
  quantity INTEGER,
  quality_threshold DECIMAL,
  required_fields TEXT[],
  status TEXT CHECK (status IN ('active', 'completed', 'failed')),
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Summary

1. **Marketplace**: Data Monkey can be independent (MVP) or integrated with x402 Bazaar (growth)

2. **Discovery**: Agents always discover **multiple endpoints**, probe them all, rank by quality+price, then try in order

3. **Quality Assessment**:
   - **Pre-purchase**: Free probe endpoint (schema, sample, metadata)
   - **Test purchase**: Small batch (10-50 records) to validate
   - **Full purchase**: Only if quality passes
   - **Historical**: Track seller reputation over time

4. **Multi-source**: Agents query both Data Monkey and x402 Bazaar, deduplicate, and evaluate together

This ensures agents find the best quality data at the best price, with automatic fallback if quality doesn't meet thresholds.

