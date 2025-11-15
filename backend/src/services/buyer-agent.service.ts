import { supabase } from '../config/supabase.js'
import { WalletService } from './wallet.service.js'
import { coinbase } from '../config/coinbase.js'
import logger from '../utils/logger.js'

export interface BuyerAgent {
  id: string
  buyer_id: string
  name: string
  description?: string
  goal: string
  requirements: {
    category?: string
    requiredFields?: string[]
    format?: string
    minQuality?: number
    filters?: Record<string, any>
  }
  wallet_id?: string
  wallet_address?: string
  status: 'active' | 'paused' | 'completed' | 'failed'
  budget: number
  spent: number
  quality_threshold: number
  quantity_required?: number
  quantity_acquired: number
  metadata?: Record<string, any>
  created_at: string
  updated_at: string
}

export interface CreateAgentRequest {
  name: string
  description?: string
  goal: string
  requirements: {
    category?: string
    requiredFields?: string[]
    format?: string
    minQuality?: number
    filters?: Record<string, any>
  }
  budget: number
  quality_threshold?: number
  quantity_required?: number
}

export class BuyerAgentService {
  private walletService: WalletService

  constructor() {
    this.walletService = new WalletService()
  }

  /**
   * Initialize a new consumer agent
   * Agent uses consumer's wallet for payments (all agents share consumer's wallet)
   */
  async createAgent(buyerId: string, data: CreateAgentRequest): Promise<BuyerAgent> {
    console.log(`[AGENT_DEBUG] createAgent called for consumerId: ${buyerId}, agentName: ${data.name}`)
    
    // Use consumer's wallet for the agent (all agents share consumer's wallet)
    let walletId: string | undefined
    let walletAddress: string | undefined

    try {
      console.log(`[AGENT_DEBUG] Step 1: Getting consumer wallet for consumerId: ${buyerId}`)
      let consumerWallet = await this.walletService.getWallet(buyerId)
      console.log(`[AGENT_DEBUG] Step 1 result:`, {
        hasWallet: !!consumerWallet,
        walletId: consumerWallet?.id,
        walletAddress: consumerWallet?.address,
      })
      
      // If consumer doesn't have a wallet, create one automatically
      if (!consumerWallet) {
        logger.info(`Consumer ${buyerId} does not have a wallet - creating one now`)
        console.log(`[AGENT_DEBUG] Step 2: Creating wallet for consumerId: ${buyerId}`)
        consumerWallet = await this.walletService.createWallet(buyerId, `Data Monkey Wallet - ${buyerId}`)
        console.log(`[AGENT_DEBUG] Step 2 result:`, {
          walletId: consumerWallet.id,
          walletAddress: consumerWallet.address,
        })
        logger.info(`Created wallet for consumer: ${consumerWallet.id} (${consumerWallet.address})`)
      }
      
      if (consumerWallet) {
        walletId = consumerWallet.id
        walletAddress = consumerWallet.address
        console.log(`[AGENT_DEBUG] Step 3: Using wallet for agent:`, {
          walletId,
          walletAddress,
        })
        logger.info(`Using consumer wallet for agent: ${walletId} (${walletAddress})`)
      } else {
        console.error(`[AGENT_DEBUG] ❌ consumerWallet is null/undefined after creation attempt`)
        throw new Error('Failed to create or retrieve consumer wallet')
      }
    } catch (error) {
      console.error(`[AGENT_DEBUG] ❌ Exception in wallet setup:`, {
        buyerId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      })
      logger.error('Failed to get or create consumer wallet for agent:', error)
      throw new Error(`Failed to set up wallet for agent: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    const agentData = {
      buyer_id: buyerId,
      name: data.name,
      description: data.description || null,
      goal: data.goal,
      requirements: data.requirements,
      wallet_id: walletId || null,
      wallet_address: walletAddress || null,
      status: 'active' as const,
      budget: data.budget,
      spent: 0,
      quality_threshold: data.quality_threshold || 0.7,
      quantity_required: data.quantity_required || null,
      quantity_acquired: 0,
      metadata: {},
    }

    console.log(`[AGENT_DEBUG] Step 4: Inserting agent with data:`, {
      buyer_id: agentData.buyer_id,
      name: agentData.name,
      wallet_id: agentData.wallet_id,
      wallet_address: agentData.wallet_address,
      hasWalletId: !!agentData.wallet_id,
      hasWalletAddress: !!agentData.wallet_address,
    })

    const { data: newAgent, error } = await supabase
      .from('buyer_agents')
      .insert(agentData)
      .select()
      .single()

    if (error) {
      console.error(`[AGENT_DEBUG] ❌ Failed to insert agent:`, {
        error: error.message,
        code: error.code,
        details: error.details,
        agentData,
      })
      throw new Error(`Failed to create agent: ${error.message}`)
    }

    console.log(`[AGENT_DEBUG] ✅ Agent created successfully:`, {
      agentId: newAgent?.id,
      wallet_id: newAgent?.wallet_id,
      wallet_address: newAgent?.wallet_address,
      hasWalletId: !!newAgent?.wallet_id,
      hasWalletAddress: !!newAgent?.wallet_address,
    })

    return newAgent as BuyerAgent
  }

  /**
   * Get all agents for a buyer
   */
  async getBuyerAgents(buyerId: string): Promise<BuyerAgent[]> {
    const { data, error } = await supabase
      .from('buyer_agents')
      .select('*')
      .eq('buyer_id', buyerId)
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(`Failed to fetch agents: ${error.message}`)
    }

    return (data || []) as BuyerAgent[]
  }

  /**
   * Get a single agent
   */
  async getAgent(agentId: string, buyerId?: string): Promise<BuyerAgent> {
    console.log(`[AGENT_DEBUG] getAgent called for agentId: ${agentId}, buyerId: ${buyerId || 'not provided'}`)
    
    let query = supabase.from('buyer_agents').select('*').eq('id', agentId)

    if (buyerId) {
      query = query.eq('buyer_id', buyerId)
    }

    const { data, error } = await query.single()

    if (error) {
      console.error(`[AGENT_DEBUG] ❌ Error fetching agent:`, {
        agentId,
        buyerId,
        error: error.message,
        code: error.code,
        details: error.details,
      })
      throw new Error(`Failed to fetch agent: ${error.message}`)
    }

    console.log(`[AGENT_DEBUG] Agent retrieved:`, {
      agentId: data?.id,
      buyer_id: data?.buyer_id,
      wallet_id: data?.wallet_id,
      wallet_address: data?.wallet_address,
      hasWalletId: !!data?.wallet_id,
      hasWalletAddress: !!data?.wallet_address,
      status: data?.status,
    })

    return data as BuyerAgent
  }

  /**
   * Update agent status
   */
  async updateAgentStatus(
    agentId: string,
    buyerId: string,
    status: BuyerAgent['status']
  ): Promise<BuyerAgent> {
    const { data, error } = await supabase
      .from('buyer_agents')
      .update({ status })
      .eq('id', agentId)
      .eq('buyer_id', buyerId)
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to update agent: ${error.message}`)
    }

    return data as BuyerAgent
  }

  /**
   * Record a purchase made by the agent
   */
  async recordPurchase(
    agentId: string,
    amount: number,
    quantity: number
  ): Promise<BuyerAgent> {
    const agent = await this.getAgent(agentId)

    const newSpent = agent.spent + amount
    const newQuantity = agent.quantity_acquired + quantity

    // Check if agent has completed its goal
    let status = agent.status
    if (agent.quantity_required && newQuantity >= agent.quantity_required) {
      status = 'completed'
    } else if (newSpent >= agent.budget) {
      status = 'failed' // Out of budget
    }

    const { data, error } = await supabase
      .from('buyer_agents')
      .update({
        spent: newSpent,
        quantity_acquired: newQuantity,
        status,
      })
      .eq('id', agentId)
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to record purchase: ${error.message}`)
    }

    return data as BuyerAgent
  }

  /**
   * Get agent wallet balance (uses consumer's wallet)
   */
  async getAgentBalance(agentId: string): Promise<any> {
    const agent = await this.getAgent(agentId)

    if (!agent.wallet_id) {
      throw new Error('Agent does not have a wallet (consumer wallet not found)')
    }

    return await this.walletService.getBalance(agent.wallet_id, 'USDC')
  }

  /**
   * Fix agent wallet - updates agent to use consumer's wallet if missing
   */
  async fixAgentWallet(agentId: string, buyerId: string): Promise<BuyerAgent> {
    console.log(`[AGENT_DEBUG] fixAgentWallet called for agentId: ${agentId}, consumerId: ${buyerId}`)
    
    const agent = await this.getAgent(agentId, buyerId)
    
    console.log(`[AGENT_DEBUG] Current agent state:`, {
      agentId: agent.id,
      wallet_id: agent.wallet_id,
      wallet_address: agent.wallet_address,
      hasWalletId: !!agent.wallet_id,
    })
    
    // If agent already has a wallet, return as-is
    if (agent.wallet_id) {
      console.log(`[AGENT_DEBUG] ✅ Agent already has wallet, no fix needed`)
      return agent
    }

    console.log(`[AGENT_DEBUG] Step 1: Getting consumer wallet for consumerId: ${buyerId}`)
    // Get or create consumer's wallet
    let consumerWallet = await this.walletService.getWallet(buyerId)
    
    if (!consumerWallet) {
      console.log(`[AGENT_DEBUG] Step 2: Consumer has no wallet, creating one...`)
      logger.info(`Consumer ${buyerId} does not have a wallet - creating one now`)
      consumerWallet = await this.walletService.createWallet(buyerId, `Data Monkey Wallet - ${buyerId}`)
      console.log(`[AGENT_DEBUG] Step 2 result:`, {
        walletId: consumerWallet.id,
        walletAddress: consumerWallet.address,
      })
      logger.info(`Created wallet for consumer: ${consumerWallet.id} (${consumerWallet.address})`)
    } else {
      console.log(`[AGENT_DEBUG] Step 2: Consumer has existing wallet:`, {
        walletId: consumerWallet.id,
        walletAddress: consumerWallet.address,
      })
    }

    console.log(`[AGENT_DEBUG] Step 3: Updating agent with wallet:`, {
      agentId,
      walletId: consumerWallet.id,
      walletAddress: consumerWallet.address,
    })

    // Update agent with consumer's wallet
    const { data: updatedAgent, error } = await supabase
      .from('buyer_agents')
      .update({
        wallet_id: consumerWallet.id,
        wallet_address: consumerWallet.address,
      })
      .eq('id', agentId)
      .select()
      .single()

    if (error) {
      console.error(`[AGENT_DEBUG] ❌ Failed to update agent wallet:`, {
        agentId,
        error: error.message,
        code: error.code,
        details: error.details,
        walletId: consumerWallet.id,
      })
      throw new Error(`Failed to update agent wallet: ${error.message}`)
    }

    console.log(`[AGENT_DEBUG] ✅ Agent wallet updated successfully:`, {
      agentId: updatedAgent?.id,
      wallet_id: updatedAgent?.wallet_id,
      wallet_address: updatedAgent?.wallet_address,
      hasWalletId: !!updatedAgent?.wallet_id,
      hasWalletAddress: !!updatedAgent?.wallet_address,
    })

    logger.info(`Fixed wallet for agent ${agentId}: ${consumerWallet.id} (${consumerWallet.address})`)
    return updatedAgent as BuyerAgent
  }

  /**
   * Delete an agent
   */
  async deleteAgent(agentId: string, buyerId: string): Promise<void> {
    // Verify ownership
    await this.getAgent(agentId, buyerId)

    const { error } = await supabase
      .from('buyer_agents')
      .delete()
      .eq('id', agentId)
      .eq('buyer_id', buyerId)

    if (error) {
      throw new Error(`Failed to delete agent: ${error.message}`)
    }

    logger.info(`Deleted agent ${agentId} for buyer ${buyerId}`)
  }
}

