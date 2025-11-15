# Agent Tools & Services Guide

## Overview

Agents can use **both** x402 protocol services and traditional API key-based services. x402 is **optional**, not required. You can mix and match both approaches.

## Two Types of Services

### 1. x402 Protocol Services (Coinbase Ecosystem)
- **Payment**: Automatic via x402 protocol
- **Discovery**: Via x402 Bazaar (optional) or direct marketplace
- **Examples**: Data Monkey datasets, other x402-enabled services
- **No API keys needed** - payment is the authentication

### 2. Traditional API Services (API Keys)
- **Payment**: Via API key billing (monthly/subscription)
- **Discovery**: Direct integration, documentation
- **Examples**: Claude, OpenAI, Google APIs, etc.
- **Requires API keys** - traditional authentication

## Agent Architecture

```
┌─────────────────────────────────────────┐
│           Your Agent                    │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │  Tool Router                      │ │
│  │  - Determines service type        │ │
│  │  - Routes to appropriate handler  │ │
│  └───────────────────────────────────┘ │
│           │              │              │
│           ▼              ▼              │
│  ┌──────────────┐  ┌──────────────┐   │
│  │ x402 Handler │  │ API Key      │   │
│  │ (Data Monkey)│  │ Handler      │   │
│  │              │  │ (Claude, etc)│   │
│  └──────────────┘  └──────────────┘   │
└─────────────────────────────────────────┘
```

## Implementation Example

### Complete Agent with Both Service Types

```typescript
import { Coinbase } from "@coinbase/coinbase-sdk";
import axios from "axios";
import { withPaymentInterceptor } from "x402-axios";
import Anthropic from "@anthropic-ai/sdk";

class HybridAgent {
  private coinbase: Coinbase;
  private walletId: string;
  private x402Client: any; // For x402 services
  private claudeClient: Anthropic; // For Claude API
  private apiKeys: Map<string, string>; // For other APIs

  constructor() {
    // Initialize Coinbase CDP for x402 payments
    this.coinbase = new Coinbase({
      apiKeyName: process.env.CDP_API_KEY_NAME!,
      privateKey: process.env.CDP_API_KEY_SECRET!,
    });

    // Initialize Claude with API key
    this.claudeClient = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!,
    });

    // Store other API keys
    this.apiKeys = new Map([
      ['openai', process.env.OPENAI_API_KEY!],
      ['google', process.env.GOOGLE_API_KEY!],
    ]);
  }

  async initialize() {
    // Create wallet for x402 payments
    const wallet = await this.coinbase.wallets.createWallet({
      name: "Agent Wallet",
      type: "developer_managed",
    });
    this.walletId = wallet.id;

    // Setup x402 client with payment interceptor
    this.x402Client = withPaymentInterceptor(axios.create(), {
      walletId: this.walletId,
      signPayment: async (instructions) => {
        const signed = await this.coinbase.wallets.signMessage({
          walletId: this.walletId,
          message: JSON.stringify(instructions),
        });
        return { ...instructions, signature: signed.signature };
      },
    });
  }

  /**
   * Use Claude for reasoning/analysis
   * Uses API key (traditional method)
   */
  async useClaude(prompt: string): Promise<string> {
    const message = await this.claudeClient.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    return message.content[0].text;
  }

  /**
   * Use Data Monkey dataset (x402 payment)
   * No API key needed - payment is authentication
   */
  async useDataMonkeyDataset(datasetId: string, quantity: number): Promise<any> {
    try {
      const response = await this.x402Client.get(
        `http://localhost:8000/api/datasets/${datasetId}/data`,
        { params: { quantity } }
      );
      return response.data;
    } catch (error) {
      if (error.response?.status === 402) {
        console.log("Payment required - handled automatically by x402 client");
        throw error;
      }
      throw error;
    }
  }

  /**
   * Use OpenAI (API key)
   */
  async useOpenAI(prompt: string): Promise<string> {
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4",
        messages: [{ role: "user", content: prompt }],
      },
      {
        headers: {
          Authorization: `Bearer ${this.apiKeys.get('openai')}`,
        },
      }
    );
    return response.data.choices[0].message.content;
  }

  /**
   * Discover datasets from Data Monkey marketplace
   * Direct API call (no payment needed for discovery)
   */
  async discoverDatasets(category?: string): Promise<any[]> {
    const response = await axios.get("http://localhost:8000/api/datasets", {
      params: { category },
    });
    return response.data.data;
  }

  /**
   * Execute a complex task using multiple tools
   */
  async executeTask(goal: string): Promise<any> {
    // 1. Use Claude to analyze the goal
    const analysis = await this.useClaude(
      `Analyze this goal and determine what data is needed: ${goal}`
    );

    // 2. Discover relevant datasets
    const datasets = await this.discoverDatasets();

    // 3. Use x402 to purchase dataset (automatic payment)
    const datasetData = await this.useDataMonkeyDataset(datasets[0].id, 100);

    // 4. Use Claude to process the data
    const processed = await this.useClaude(
      `Process this data: ${JSON.stringify(datasetData)}`
    );

    return {
      analysis,
      data: datasetData,
      processed,
    };
  }
}
```

## Service Discovery Options

### Option 1: Direct Marketplace (Data Monkey)
```typescript
// Query Data Monkey directly
const datasets = await axios.get("http://localhost:8000/api/datasets", {
  params: { category: "Images", search: "cats" }
});
```

### Option 2: x402 Bazaar (Optional)
```typescript
// Query x402 Bazaar for x402-enabled services
const services = await axios.get(`${X402_BAZAAR_URL}/services`, {
  params: { q: "image generation", category: "ai-tools" }
});
```

### Option 3: Hardcoded/Config
```typescript
// Known services with API keys
const services = {
  claude: { type: "api_key", key: process.env.ANTHROPIC_API_KEY },
  openai: { type: "api_key", key: process.env.OPENAI_API_KEY },
  datamonkey: { type: "x402", endpoint: "http://localhost:8000" },
};
```

## Tool Router Pattern

```typescript
class ToolRouter {
  async callTool(toolName: string, params: any) {
    const tool = this.getTool(toolName);

    switch (tool.type) {
      case "x402":
        return await this.callX402Tool(tool, params);
      case "api_key":
        return await this.callAPIKeyTool(tool, params);
      case "claude":
        return await this.callClaudeTool(tool, params);
      default:
        throw new Error(`Unknown tool type: ${tool.type}`);
    }
  }

  private async callX402Tool(tool: any, params: any) {
    // Use x402 client (automatic payment)
    return await this.x402Client.get(tool.endpoint, { params });
  }

  private async callAPIKeyTool(tool: any, params: any) {
    // Use API key authentication
    return await axios.get(tool.endpoint, {
      headers: { Authorization: `Bearer ${tool.apiKey}` },
      params,
    });
  }

  private async callClaudeTool(tool: any, params: any) {
    // Use Claude SDK
    return await this.claudeClient.messages.create({
      model: tool.model,
      messages: params.messages,
    });
  }
}
```

## Claude Integration

### Using Claude API Key

```typescript
import Anthropic from "@anthropic-ai/sdk";

const claude = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY, // Get from Anthropic dashboard
});

// Use Claude for reasoning
const response = await claude.messages.create({
  model: "claude-3-5-sonnet-20241022",
  max_tokens: 1024,
  messages: [
    {
      role: "user",
      content: "Analyze this dataset and provide insights",
    },
  ],
});
```

### Claude with Tool Calling

```typescript
// Claude can call tools/functions
const response = await claude.messages.create({
  model: "claude-3-5-sonnet-20241022",
  max_tokens: 1024,
  tools: [
    {
      name: "get_dataset",
      description: "Get dataset from Data Monkey marketplace",
      input_schema: {
        type: "object",
        properties: {
          dataset_id: { type: "string" },
          quantity: { type: "number" },
        },
      },
    },
  ],
  messages: [{ role: "user", content: "Get 100 records from dataset abc123" }],
});

// Claude returns tool calls, agent executes them
for (const toolUse of response.content) {
  if (toolUse.type === "tool_use") {
    if (toolUse.name === "get_dataset") {
      const data = await this.useDataMonkeyDataset(
        toolUse.input.dataset_id,
        toolUse.input.quantity
      );
      // Send result back to Claude
    }
  }
}
```

## Environment Variables

```env
# Coinbase CDP (for x402 payments)
CDP_API_KEY_NAME=your-api-key-name
CDP_API_KEY_SECRET=your-api-key-secret
CDP_NETWORK=base-sepolia

# Traditional API Keys
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GOOGLE_API_KEY=...

# x402 Bazaar (optional)
X402_BAZAAR_URL=https://bazaar.x402.org
```

## When to Use What

### Use x402 When:
- ✅ Service supports x402 protocol
- ✅ You want pay-per-use (no subscriptions)
- ✅ Service is in Coinbase ecosystem
- ✅ You want automatic payment handling
- ✅ Example: Data Monkey datasets

### Use API Keys When:
- ✅ Service uses traditional authentication
- ✅ You have a subscription/account
- ✅ Service doesn't support x402
- ✅ Example: Claude, OpenAI, Google APIs

## Complete Example: Agent with Claude + Data Monkey

```typescript
class DataAcquisitionAgent {
  private claude: Anthropic;
  private x402Client: any;
  private walletId: string;

  async initialize() {
    // Setup Claude
    this.claude = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!,
    });

    // Setup x402 for Data Monkey
    const coinbase = new Coinbase({
      apiKeyName: process.env.CDP_API_KEY_NAME!,
      privateKey: process.env.CDP_API_KEY_SECRET!,
    });

    const wallet = await coinbase.wallets.createWallet({
      name: "Agent Wallet",
      type: "developer_managed",
    });
    this.walletId = wallet.id;

    this.x402Client = withPaymentInterceptor(axios.create(), {
      walletId: this.walletId,
      signPayment: async (instructions) => {
        const signed = await coinbase.wallets.signMessage({
          walletId: this.walletId,
          message: JSON.stringify(instructions),
        });
        return { ...instructions, signature: signed.signature };
      },
    });
  }

  async acquireData(goal: string) {
    // 1. Use Claude to understand goal
    const analysis = await this.claude.messages.create({
      model: "claude-3-5-sonnet-20241022",
      messages: [
        {
          role: "user",
          content: `What type of data do I need for: ${goal}?`,
        },
      ],
    });

    // 2. Discover datasets (free API call)
    const datasets = await axios.get("http://localhost:8000/api/datasets");

    // 3. Use Claude to select best dataset
    const selection = await this.claude.messages.create({
      model: "claude-3-5-sonnet-20241022",
      messages: [
        {
          role: "user",
          content: `Which dataset is best? ${JSON.stringify(datasets.data)}`,
        },
      ],
    });

    // 4. Purchase data via x402 (automatic payment)
    const data = await this.x402Client.get(
      `http://localhost:8000/api/datasets/${selectedId}/data`,
      { params: { quantity: 100 } }
    );

    // 5. Use Claude to process data
    const processed = await this.claude.messages.create({
      model: "claude-3-5-sonnet-20241022",
      messages: [
        {
          role: "user",
          content: `Process this data: ${JSON.stringify(data.data)}`,
        },
      ],
    });

    return processed;
  }
}
```

## Summary

1. **x402 is optional** - Use it for services that support it (like Data Monkey)
2. **API keys are standard** - Use them for traditional services (Claude, OpenAI, etc.)
3. **Mix and match** - Agents can use both simultaneously
4. **No bazaar required** - You can query Data Monkey directly or use x402 Bazaar
5. **Claude uses API keys** - Standard Anthropic API key, not x402

The key is: **x402 is a payment protocol, not a replacement for API keys**. Use the right tool for each service.

