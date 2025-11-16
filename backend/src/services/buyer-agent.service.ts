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
    logger.info(`Step 1: Create agent request received for buyerId: ${buyerId}, agentName: ${data.name}`)
    
    // Use consumer's wallet for the agent (all agents share consumer's wallet)
    let walletId: string | undefined
    let walletAddress: string | undefined

    try {
      logger.info(`Step 2: Getting consumer wallet`)
      let consumerWallet = await this.walletService.getWallet(buyerId)
      logger.info(`Step 3: Wallet lookup completed - hasWallet: ${!!consumerWallet}`)
      
      // If consumer doesn't have a wallet, create one automatically
      if (!consumerWallet) {
        logger.info(`Step 4: Consumer has no wallet, creating new wallet`)
        consumerWallet = await this.walletService.createWallet(buyerId, `Data Monkey Wallet - ${buyerId}`)
        logger.info(`Step 5: Wallet created - walletId: ${consumerWallet.id}, address: ${consumerWallet.address}`)
      }
      
      if (consumerWallet) {
        walletId = consumerWallet.id
        walletAddress = consumerWallet.address
        logger.info(`Step 6: Using wallet for agent - walletId: ${walletId}`)
      } else {
        logger.info(`Step 4: Wallet creation failed, throwing error`)
        throw new Error('Failed to create or retrieve consumer wallet')
      }
    } catch (error) {
      logger.info(`Step 1: Error in wallet setup: ${error instanceof Error ? error.message : 'Unknown error'}`)
      throw new Error(`Failed to set up wallet for agent: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    logger.info(`Step 7: Preparing agent data`)
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

    logger.info(`Step 8: Inserting agent into database`)
    const { data: newAgent, error } = await supabase
      .from('buyer_agents')
      .insert(agentData)
      .select()
      .single()

    if (error) {
      logger.info(`Step 9: Failed to insert agent: ${error.message}`)
      throw new Error(`Failed to create agent: ${error.message}`)
    }

    logger.info(`Step 9: Agent created successfully - agentId: ${newAgent?.id}`)
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
    logger.info(`Step 1: Get agent request received - agentId: ${agentId}, buyerId: ${buyerId || 'not provided'}`)
    
    logger.info(`Step 2: Building database query`)
    let query = supabase.from('buyer_agents').select('*').eq('id', agentId)

    if (buyerId) {
      query = query.eq('buyer_id', buyerId)
    }

    logger.info(`Step 3: Executing database query`)
    const { data, error } = await query.single()

    if (error) {
      logger.info(`Step 4: Error fetching agent: ${error.message}`)
      throw new Error(`Failed to fetch agent: ${error.message}`)
    }

    logger.info(`Step 4: Agent retrieved successfully - agentId: ${data?.id}`)
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
    logger.info(`Step 1: Fix agent wallet request received - agentId: ${agentId}, buyerId: ${buyerId}`)
    
    logger.info(`Step 2: Fetching agent`)
    const agent = await this.getAgent(agentId, buyerId)
    logger.info(`Step 3: Agent retrieved - hasWalletId: ${!!agent.wallet_id}`)
    
    // If agent already has a wallet, return as-is
    if (agent.wallet_id) {
      logger.info(`Step 4: Agent already has wallet, no fix needed`)
      return agent
    }

    logger.info(`Step 4: Getting consumer wallet`)
    // Get or create consumer's wallet
    let consumerWallet = await this.walletService.getWallet(buyerId)
    
    if (!consumerWallet) {
      logger.info(`Step 5: Consumer has no wallet, creating new wallet`)
      consumerWallet = await this.walletService.createWallet(buyerId, `Data Monkey Wallet - ${buyerId}`)
      logger.info(`Step 6: Wallet created - walletId: ${consumerWallet.id}, address: ${consumerWallet.address}`)
    } else {
      logger.info(`Step 5: Consumer has existing wallet - walletId: ${consumerWallet.id}`)
    }

    logger.info(`Step 7: Updating agent with wallet`)
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
      logger.info(`Step 8: Failed to update agent wallet: ${error.message}`)
      throw new Error(`Failed to update agent wallet: ${error.message}`)
    }

    logger.info(`Step 8: Agent wallet updated successfully - walletId: ${updatedAgent?.wallet_id}`)
    return updatedAgent as BuyerAgent
  }

  /**
   * Delete an agent
   */
  async deleteAgent(agentId: string, buyerId: string): Promise<void> {
    logger.info(`Step 1: Delete agent request received - agentId: ${agentId}`)
    logger.info(`Step 2: Verifying agent ownership`)
    // Verify ownership
    await this.getAgent(agentId, buyerId)

    logger.info(`Step 3: Deleting agent from database`)
    const { error } = await supabase
      .from('buyer_agents')
      .delete()
      .eq('id', agentId)
      .eq('buyer_id', buyerId)

    if (error) {
      logger.info(`Step 4: Error deleting agent: ${error.message}`)
      throw new Error(`Failed to delete agent: ${error.message}`)
    }

    logger.info(`Step 4: Agent deleted successfully`)
  }
}

