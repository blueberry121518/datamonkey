import { BuyerAgentService, BuyerAgent } from './buyer-agent.service.js'
import { DatasetService } from './dataset.service.js'
import { AgentActionService } from './agent-action.service.js'
import { X402Service } from './x402.service.js'
import { WalletService } from './wallet.service.js'
import { supabase } from '../config/supabase.js'
import logger from '../utils/logger.js'

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:8000/api'

export class AgentExecutionService {
  private buyerAgentService: BuyerAgentService
  private datasetService: DatasetService
  private agentActionService: AgentActionService
  private x402Service: X402Service
  private walletService: WalletService
  private runningAgents: Map<string, NodeJS.Timeout> = new Map()

  constructor() {
    this.buyerAgentService = new BuyerAgentService()
    this.datasetService = new DatasetService()
    this.agentActionService = new AgentActionService()
    this.x402Service = new X402Service()
    this.walletService = new WalletService()
  }

  /**
   * Start executing an agent
   * This will run in the background and discover/purchase datasets
   */
  async startAgent(agentId: string): Promise<void> {
    // Stop if already running
    if (this.runningAgents.has(agentId)) {
      logger.warn(`Agent ${agentId} is already running`)
      return
    }

    console.log(`[AGENT_EXEC_DEBUG] startAgent called for agentId: ${agentId}`)
    
    let agent = await this.buyerAgentService.getAgent(agentId)
    
    console.log(`[AGENT_EXEC_DEBUG] Agent retrieved:`, {
      agentId: agent.id,
      buyer_id: agent.buyer_id,
      wallet_id: agent.wallet_id,
      wallet_address: agent.wallet_address,
      hasWalletId: !!agent.wallet_id,
      hasWalletAddress: !!agent.wallet_address,
      status: agent.status,
    })
    
    if (agent.status !== 'active') {
      console.log(`[AGENT_EXEC_DEBUG] ❌ Agent is not active, status: ${agent.status}`)
      logger.warn(`Agent ${agentId} is not active, status: ${agent.status}`)
      return
    }

    // If agent doesn't have a wallet, try to fix it by using buyer's wallet
    if (!agent.wallet_id) {
      console.log(`[AGENT_EXEC_DEBUG] ⚠️ Agent ${agentId} does not have a wallet_id - attempting to fix`)
      logger.warn(`Agent ${agentId} does not have a wallet - attempting to fix`)
      try {
        console.log(`[AGENT_EXEC_DEBUG] Calling fixAgentWallet for agentId: ${agentId}, buyerId: ${agent.buyer_id}`)
        // Fix agent wallet (will create buyer wallet if needed)
        agent = await this.buyerAgentService.fixAgentWallet(agentId, agent.buyer_id)
        console.log(`[AGENT_EXEC_DEBUG] ✅ Wallet fixed:`, {
          agentId: agent.id,
          wallet_id: agent.wallet_id,
          wallet_address: agent.wallet_address,
          hasWalletId: !!agent.wallet_id,
        })
        logger.info(`Fixed wallet for agent ${agentId}`)
        await this.agentActionService.logAction(
          agentId,
          'wallet_fixed',
          { message: 'Agent wallet was automatically fixed' },
          'success'
        )
      } catch (error) {
        console.error(`[AGENT_EXEC_DEBUG] ❌ Failed to fix wallet:`, {
          agentId,
          buyerId: agent.buyer_id,
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
        })
        logger.error(`Failed to fix wallet for agent ${agentId}:`, error)
        await this.agentActionService.logAction(
          agentId,
          'error',
          { error: `Agent wallet not found: ${error instanceof Error ? error.message : 'Unknown error'}` },
          'failed'
        )
        return
      }
    } else {
      console.log(`[AGENT_EXEC_DEBUG] ✅ Agent has wallet: ${agent.wallet_id}`)
    }

    logger.info(`Starting agent execution: ${agentId}`)
    
    await this.agentActionService.logAction(
      agentId,
      'agent_started',
      { message: 'Agent started discovering datasets' },
      'success'
    )

    // Run agent loop
    const interval = setInterval(async () => {
      try {
        await this.executeAgentCycle(agentId)
      } catch (error) {
        logger.error(`Error in agent cycle for ${agentId}:`, error)
        await this.agentActionService.logAction(
          agentId,
          'error',
          { error: error instanceof Error ? error.message : 'Unknown error' },
          'failed'
        )
      }
    }, 10000) // Run every 10 seconds

    this.runningAgents.set(agentId, interval)
  }

  /**
   * Stop executing an agent
   */
  stopAgent(agentId: string): void {
    const interval = this.runningAgents.get(agentId)
    if (interval) {
      clearInterval(interval)
      this.runningAgents.delete(agentId)
      logger.info(`Stopped agent execution: ${agentId}`)
    }
  }

  /**
   * Execute one cycle of agent discovery and purchase
   */
  private async executeAgentCycle(agentId: string): Promise<void> {
    const agent = await this.buyerAgentService.getAgent(agentId)

    // Check if agent should stop
    if (agent.status !== 'active') {
      this.stopAgent(agentId)
      return
    }

    // Check budget
    if (agent.spent >= agent.budget) {
      await this.buyerAgentService.updateAgentStatus(agentId, agent.buyer_id, 'failed')
      await this.agentActionService.logAction(
        agentId,
        'error',
        { error: 'Budget exhausted' },
        'failed'
      )
      this.stopAgent(agentId)
      return
    }

    // Check if goal is met
    if (agent.quantity_required && agent.quantity_acquired >= agent.quantity_required) {
      await this.buyerAgentService.updateAgentStatus(agentId, agent.buyer_id, 'completed')
      await this.agentActionService.logAction(
        agentId,
        'goal_completed',
        { quantity_acquired: agent.quantity_acquired },
        'success'
      )
      this.stopAgent(agentId)
      return
    }

    // Discover datasets
    await this.agentActionService.logAction(
      agentId,
      'discovering_datasets',
      { 
        category: agent.requirements.category,
        required_fields: agent.requirements.requiredFields,
        quality_threshold: agent.quality_threshold
      },
      'pending'
    )

    const datasets = await this.discoverDatasets(agent)

    if (datasets.length === 0) {
      await this.agentActionService.logAction(
        agentId,
        'no_datasets_found',
        { message: 'No matching datasets found in marketplace' },
        'success'
      )
      return
    }

    await this.agentActionService.logAction(
      agentId,
      'dataset_found',
      { count: datasets.length, datasets: datasets.map((d: any) => ({ id: d.id, name: d.name })) },
      'success'
    )

    // Evaluate and select best dataset
    const selectedDataset = await this.selectBestDataset(agent, datasets)

    if (!selectedDataset) {
      await this.agentActionService.logAction(
        agentId,
        'decision_skip',
        { reason: 'No suitable dataset found after evaluation' },
        'success'
      )
      return
    }

    await this.agentActionService.logAction(
      agentId,
      'dataset_selected',
      { 
        dataset_id: selectedDataset.id,
        dataset_name: selectedDataset.name,
        reason: 'Best quality/price ratio'
      },
      'success'
    )

    // Probe dataset to get metadata
    const probeResult = await this.probeDataset(agent, selectedDataset)
    
    if (!probeResult) {
      return
    }

    // Request sample data
    const sampleData = await this.requestSample(agent, selectedDataset)
    
    if (!sampleData || sampleData.length === 0) {
      await this.agentActionService.logAction(
        agentId,
        'decision_skip',
        { 
          dataset_id: selectedDataset.id,
          reason: 'No sample data available'
        },
        'success'
      )
      return
    }

    // Analyze sample and perform quality check
    const qualityResult = await this.analyzeQuality(agent, selectedDataset, sampleData)
    
    // Make decision
    const decision = await this.makePurchaseDecision(agent, selectedDataset, qualityResult)
    
    if (decision.shouldPurchase) {
      await this.agentActionService.logAction(
        agentId,
        'decision_purchase',
        {
          dataset_id: selectedDataset.id,
          dataset_name: selectedDataset.name,
          reason: decision.reason,
          quality_score: qualityResult.overallScore,
          estimated_cost: decision.estimatedCost
        },
        'success'
      )
      
      // Purchase dataset
      await this.purchaseDataset(agent, selectedDataset, decision.quantity)
    } else {
      await this.agentActionService.logAction(
        agentId,
        'decision_skip',
        {
          dataset_id: selectedDataset.id,
          dataset_name: selectedDataset.name,
          reason: decision.reason,
          quality_score: qualityResult.overallScore
        },
        'success'
      )
    }
  }

  /**
   * Discover datasets matching agent requirements
   */
  private async discoverDatasets(agent: BuyerAgent): Promise<any[]> {
    try {
      const params = new URLSearchParams()
      if (agent.requirements.category) {
        params.append('category', agent.requirements.category)
      }

      const response = await fetch(`${API_BASE_URL}/datasets?${params.toString()}`)
      const data = await response.json()

      if (data.success && Array.isArray(data.data)) {
        return data.data.filter((dataset: any) => {
          // Filter by quality threshold
          if (dataset.quality_score && dataset.quality_score < agent.quality_threshold) {
            return false
          }
          return true
        })
      }

      return []
    } catch (error) {
      logger.error('Error discovering datasets:', error)
      return []
    }
  }

  /**
   * Select the best dataset from candidates
   */
  private async selectBestDataset(agent: BuyerAgent, datasets: any[]): Promise<any | null> {
    if (datasets.length === 0) {
      return null
    }

    // Simple selection: highest quality score, lowest price
    const sorted = datasets.sort((a, b) => {
      const scoreA = (a.quality_score || 0) - (parseFloat(a.price_per_record || '0'))
      const scoreB = (b.quality_score || 0) - (parseFloat(b.price_per_record || '0'))
      return scoreB - scoreA
    })

    return sorted[0]
  }

  /**
   * Probe a dataset to get more information
   */
  private async probeDataset(agent: BuyerAgent, dataset: any): Promise<any | null> {
    try {
      await this.agentActionService.logAction(
        agent.id,
        'probing_dataset',
        { dataset_id: dataset.id, dataset_name: dataset.name },
        'pending'
      )

      const response = await fetch(`${API_BASE_URL}/datasets/${dataset.id}/probe`)
      const data = await response.json()

      if (data.success) {
        await this.agentActionService.logAction(
          agent.id,
          'probe_complete',
          {
            dataset_id: dataset.id,
            dataset_name: dataset.name,
            price_per_record: data.data.price_per_record,
            quality_score: data.data.quality_score,
            total_rows: data.data.total_rows,
            schema_fields: data.data.schema?.items?.properties ? Object.keys(data.data.schema.items.properties) : []
          },
          'success'
        )
        return data.data
      } else {
        await this.agentActionService.logAction(
          agent.id,
          'error',
          { error: 'Probe failed', dataset_id: dataset.id },
          'failed'
        )
        return null
      }
    } catch (error) {
      logger.error('Error probing dataset:', error)
      await this.agentActionService.logAction(
        agent.id,
        'error',
        { error: 'Failed to probe dataset', dataset_id: dataset.id },
        'failed'
      )
      return null
    }
  }

  /**
   * Request sample data from dataset
   */
  private async requestSample(agent: BuyerAgent, dataset: any): Promise<any[] | null> {
    try {
      await this.agentActionService.logAction(
        agent.id,
        'requesting_sample',
        { dataset_id: dataset.id, sample_size: 5 },
        'pending'
      )

      const response = await fetch(`${API_BASE_URL}/datasets/${dataset.id}/sample?size=5`)
      const data = await response.json()

      if (data.success && data.data && Array.isArray(data.data)) {
        await this.agentActionService.logAction(
          agent.id,
          'sample_received',
          {
            dataset_id: dataset.id,
            sample_count: data.data.length,
            sample_preview: data.data.slice(0, 2) // First 2 records
          },
          'success'
        )
        return data.data
      } else {
        await this.agentActionService.logAction(
          agent.id,
          'error',
          { error: 'Failed to get sample data', dataset_id: dataset.id },
          'failed'
        )
        return null
      }
    } catch (error) {
      logger.error('Error requesting sample:', error)
      await this.agentActionService.logAction(
        agent.id,
        'error',
        { error: 'Failed to request sample', dataset_id: dataset.id },
        'failed'
      )
      return null
    }
  }

  /**
   * Analyze quality of sample data
   */
  private async analyzeQuality(
    agent: BuyerAgent,
    dataset: any,
    sampleData: any[]
  ): Promise<{
    completeness: number
    schemaMatch: number
    dataQuality: number
    requiredFieldsPresent: boolean
    overallScore: number
    issues: string[]
  }> {
    try {
      await this.agentActionService.logAction(
        agent.id,
        'analyzing_sample',
        { dataset_id: dataset.id, sample_count: sampleData.length },
        'pending'
      )

      const issues: string[] = []
      let completeness = 0
      let schemaMatch = 0
      let dataQuality = 0
      let requiredFieldsPresent = true

      // Check required fields
      if (agent.requirements.requiredFields && agent.requirements.requiredFields.length > 0) {
        const sampleKeys = sampleData.length > 0 ? Object.keys(sampleData[0]) : []
        const missingFields = agent.requirements.requiredFields.filter(
          field => !sampleKeys.includes(field)
        )
        
        if (missingFields.length > 0) {
          requiredFieldsPresent = false
          issues.push(`Missing required fields: ${missingFields.join(', ')}`)
        } else {
          requiredFieldsPresent = true
        }
      }

      // Calculate completeness (non-null values)
      if (sampleData.length > 0) {
        const sampleRecord = sampleData[0]
        const totalFields = Object.keys(sampleRecord).length
        const nonNullFields = Object.values(sampleRecord).filter(v => v !== null && v !== undefined && v !== '').length
        completeness = totalFields > 0 ? nonNullFields / totalFields : 0

        if (completeness < 0.8) {
          issues.push(`Low completeness: ${(completeness * 100).toFixed(0)}%`)
        }
      }

      // Check schema match (if schema exists)
      if (dataset.schema && dataset.schema.items && dataset.schema.items.properties) {
        const schemaFields = Object.keys(dataset.schema.items.properties)
        const sampleFields = sampleData.length > 0 ? Object.keys(sampleData[0]) : []
        const matchingFields = schemaFields.filter(f => sampleFields.includes(f))
        schemaMatch = schemaFields.length > 0 ? matchingFields.length / schemaFields.length : 1

        if (schemaMatch < 0.9) {
          issues.push(`Schema mismatch: ${((1 - schemaMatch) * 100).toFixed(0)}% fields don't match`)
        }
      } else {
        schemaMatch = 1 // No schema to match against
      }

      // Basic data quality checks
      let qualityScore = 0
      if (sampleData.length > 0) {
        // Check for consistent structure
        const firstKeys = Object.keys(sampleData[0])
        const consistentStructure = sampleData.every(record => {
          const recordKeys = Object.keys(record)
          return recordKeys.length === firstKeys.length && 
                 recordKeys.every(k => firstKeys.includes(k))
        })
        
        if (!consistentStructure) {
          issues.push('Inconsistent data structure across records')
          qualityScore = 0.5
        } else {
          qualityScore = 0.8
        }

        // Check for empty/null values
        const emptyRatio = sampleData.reduce((sum, record) => {
          const emptyCount = Object.values(record).filter(v => 
            v === null || v === undefined || v === '' || 
            (Array.isArray(v) && v.length === 0) ||
            (typeof v === 'object' && Object.keys(v).length === 0)
          ).length
          return sum + (emptyCount / Object.keys(record).length)
        }, 0) / sampleData.length

        if (emptyRatio > 0.3) {
          issues.push(`High empty value ratio: ${(emptyRatio * 100).toFixed(0)}%`)
          qualityScore = Math.max(0, qualityScore - 0.2)
        }
      }

      dataQuality = qualityScore

      // Overall score (weighted average)
      const overallScore = (
        completeness * 0.3 +
        schemaMatch * 0.2 +
        dataQuality * 0.3 +
        (requiredFieldsPresent ? 1 : 0) * 0.2
      )

      await this.agentActionService.logAction(
        agent.id,
        'quality_check',
        {
          dataset_id: dataset.id,
          completeness: (completeness * 100).toFixed(1) + '%',
          schema_match: (schemaMatch * 100).toFixed(1) + '%',
          data_quality: (dataQuality * 100).toFixed(1) + '%',
          required_fields_present: requiredFieldsPresent,
          overall_score: (overallScore * 100).toFixed(1) + '%',
          issues: issues.length > 0 ? issues : ['No issues found']
        },
        'success'
      )

      await this.agentActionService.logAction(
        agent.id,
        'quality_assessment_complete',
        {
          dataset_id: dataset.id,
          overall_score: overallScore,
          passed_threshold: overallScore >= agent.quality_threshold
        },
        overallScore >= agent.quality_threshold ? 'success' : 'failed'
      )

      return {
        completeness,
        schemaMatch,
        dataQuality,
        requiredFieldsPresent,
        overallScore,
        issues
      }
    } catch (error) {
      logger.error('Error analyzing quality:', error)
      await this.agentActionService.logAction(
        agent.id,
        'error',
        { error: 'Failed to analyze quality', dataset_id: dataset.id },
        'failed'
      )
      return {
        completeness: 0,
        schemaMatch: 0,
        dataQuality: 0,
        requiredFieldsPresent: false,
        overallScore: 0,
        issues: ['Quality analysis failed']
      }
    }
  }

  /**
   * Make purchase decision based on quality assessment
   */
  private async makePurchaseDecision(
    agent: BuyerAgent,
    dataset: any,
    qualityResult: {
      completeness: number
      schemaMatch: number
      dataQuality: number
      requiredFieldsPresent: boolean
      overallScore: number
      issues: string[]
    }
  ): Promise<{
    shouldPurchase: boolean
    reason: string
    quantity: number
    estimatedCost: string
  }> {
    try {
      await this.agentActionService.logAction(
        agent.id,
        'decision_making',
        {
          dataset_id: dataset.id,
          quality_score: qualityResult.overallScore,
          threshold: agent.quality_threshold,
          budget_remaining: agent.budget - agent.spent
        },
        'pending'
      )

      // Check quality threshold
      if (qualityResult.overallScore < agent.quality_threshold) {
        return {
          shouldPurchase: false,
          reason: `Quality score ${(qualityResult.overallScore * 100).toFixed(1)}% below threshold ${(agent.quality_threshold * 100).toFixed(1)}%`,
          quantity: 0,
          estimatedCost: '0'
        }
      }

      // Check required fields
      if (!qualityResult.requiredFieldsPresent) {
        return {
          shouldPurchase: false,
          reason: 'Missing required fields',
          quantity: 0,
          estimatedCost: '0'
        }
      }

      // Check budget
      const remainingBudget = agent.budget - agent.spent
      if (remainingBudget <= 0) {
        return {
          shouldPurchase: false,
          reason: 'Budget exhausted',
          quantity: 0,
          estimatedCost: '0'
        }
      }

      // Calculate quantity to purchase
      const remainingQuantity = agent.quantity_required 
        ? Math.max(0, agent.quantity_required - agent.quantity_acquired)
        : 100 // Default if no quantity specified

      const maxAffordable = Math.floor(remainingBudget / parseFloat(dataset.price_per_record || '0.001'))
      const quantity = Math.min(remainingQuantity, maxAffordable, 100) // Max 100 per purchase

      if (quantity <= 0) {
        return {
          shouldPurchase: false,
          reason: 'Cannot afford any records with remaining budget',
          quantity: 0,
          estimatedCost: '0'
        }
      }

      const estimatedCost = (quantity * parseFloat(dataset.price_per_record || '0.001')).toFixed(6)

      return {
        shouldPurchase: true,
        reason: `Quality acceptable (${(qualityResult.overallScore * 100).toFixed(1)}%), budget sufficient, purchasing ${quantity} records`,
        quantity,
        estimatedCost
      }
    } catch (error) {
      logger.error('Error making decision:', error)
      return {
        shouldPurchase: false,
        reason: 'Decision making failed',
        quantity: 0,
        estimatedCost: '0'
      }
    }
  }

  /**
   * Purchase data from a dataset using x402 payment
   */
  private async purchaseDataset(agent: BuyerAgent, dataset: any, quantity: number): Promise<void> {
    try {
      if (!agent.wallet_id) {
        throw new Error('Agent wallet not found')
      }

      // Request data (will get HTTP 402)
      await this.agentActionService.logAction(
        agent.id,
        'requesting_data',
        { dataset_id: dataset.id, quantity },
        'pending'
      )

      const response = await fetch(
        `${API_BASE_URL}/datasets/${dataset.id}/data?quantity=${quantity}`,
        {
          headers: {
            'X-Agent-Id': agent.id,
          },
        }
      )

      if (response.status === 402) {
        // Get payment instructions
        const paymentInstructions = await response.json()

        await this.agentActionService.logAction(
          agent.id,
          'payment_402_received',
          {
            dataset_id: dataset.id,
            amount: paymentInstructions.amount,
            recipient: paymentInstructions.recipient,
          },
          'success'
        )

        // Sign payment
        await this.agentActionService.logAction(
          agent.id,
          'payment_signing',
          { amount: paymentInstructions.amount },
          'pending'
        )

        const signedPayment = await this.x402Service.signPayment(
          agent.wallet_id,
          paymentInstructions
        )

        await this.agentActionService.logAction(
          agent.id,
          'payment_sent',
          {
            amount: signedPayment.amount,
            signature: signedPayment.signature.substring(0, 20) + '...',
          },
          'success'
        )

        // Retry with payment (include nonce so server can retrieve payment instructions)
        const paymentHeader = {
          ...signedPayment,
          nonce: paymentInstructions.nonce,
          timestamp: paymentInstructions.timestamp,
        }
        
        const paidResponse = await fetch(
          `${API_BASE_URL}/datasets/${dataset.id}/data?quantity=${quantity}`,
          {
            headers: {
              'X-Agent-Id': agent.id,
              'X-PAYMENT': JSON.stringify(paymentHeader),
            },
          }
        )

        if (paidResponse.ok) {
          const data = await paidResponse.json()

          // Record purchase
          const amount = parseFloat(paymentInstructions.amount)
          const recordsReceived = data.data?.records?.length || quantity

          await this.agentActionService.logAction(
            agent.id,
            'payment_verified',
            {
              dataset_id: dataset.id,
              amount: paymentInstructions.amount,
            },
            'success'
          )

          await this.agentActionService.logAction(
            agent.id,
            'data_received',
            {
              dataset_id: dataset.id,
              dataset_name: dataset.name,
              quantity: recordsReceived,
              records_preview: data.data?.records?.slice(0, 2) || [],
            },
            'success'
          )

          await this.buyerAgentService.recordPurchase(agent.id, amount, recordsReceived)

          await this.agentActionService.logAction(
            agent.id,
            'purchase_complete',
            {
              dataset_id: dataset.id,
              dataset_name: dataset.name,
              quantity: recordsReceived,
              amount: paymentInstructions.amount,
            },
            'success'
          )
        } else {
          throw new Error(`Payment failed: ${paidResponse.status}`)
        }
      } else {
        throw new Error(`Unexpected response: ${response.status}`)
      }
    } catch (error) {
      logger.error('Error purchasing dataset:', error)
      await this.agentActionService.logAction(
        agent.id,
        'error',
        {
          error: error instanceof Error ? error.message : 'Unknown error',
          dataset_id: dataset.id,
        },
        'failed'
      )
    }
  }

  /**
   * Start all active agents (for server restart)
   */
  async startAllActiveAgents(): Promise<void> {
    try {
      const { data: agents } = await supabase
        .from('buyer_agents')
        .select('id')
        .eq('status', 'active')

      if (agents) {
        for (const agent of agents) {
          await this.startAgent(agent.id)
        }
      }
    } catch (error) {
      logger.error('Error starting active agents:', error)
    }
  }
}

