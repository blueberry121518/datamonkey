import { supabase } from '../config/supabase.js'
import { WalletService } from './wallet.service.js'
import { coinbase } from '../config/coinbase.js'

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
   * Initialize a new buyer agent
   * Creates agent with CDP wallet for autonomous payments
   */
  async createAgent(buyerId: string, data: CreateAgentRequest): Promise<BuyerAgent> {
    // Create CDP wallet for the agent
    let walletId: string | undefined
    let walletAddress: string | undefined

    try {
      const wallet = await this.walletService.createWallet(
        buyerId,
        `Agent Wallet - ${data.name}`
      )
      walletId = wallet.id
      walletAddress = wallet.address
    } catch (error) {
      console.error('Failed to create wallet for agent:', error)
      // Continue without wallet - can be created later
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

    const { data: newAgent, error } = await supabase
      .from('buyer_agents')
      .insert(agentData)
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to create agent: ${error.message}`)
    }

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
    let query = supabase.from('buyer_agents').select('*').eq('id', agentId)

    if (buyerId) {
      query = query.eq('buyer_id', buyerId)
    }

    const { data, error } = await query.single()

    if (error) {
      throw new Error(`Failed to fetch agent: ${error.message}`)
    }

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
   * Get agent wallet balance
   */
  async getAgentBalance(agentId: string): Promise<any> {
    const agent = await this.getAgent(agentId)

    if (!agent.wallet_id) {
      throw new Error('Agent does not have a wallet')
    }

    return await this.walletService.getBalance(agent.wallet_id, 'USDC')
  }
}

