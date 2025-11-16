import { supabase } from '../config/supabase.js'
import logger from '../utils/logger.js'

export interface AgentAction {
  id: string
  agent_id: string
  action_type: string
  status: 'pending' | 'success' | 'failed'
  details: Record<string, any>
  metadata?: Record<string, any>
  created_at: string
}

export type ActionType =
  | 'agent_started'
  | 'discovering_datasets'
  | 'dataset_found'
  | 'dataset_selected'
  | 'no_datasets_found'
  | 'probing_dataset'
  | 'probe_complete'
  | 'requesting_sample'
  | 'sample_received'
  | 'analyzing_sample'
  | 'quality_check'
  | 'quality_assessment_complete'
  | 'decision_making'
  | 'decision_purchase'
  | 'decision_skip'
  | 'requesting_data'
  | 'payment_402_received'
  | 'payment_signing'
  | 'payment_sent'
  | 'payment_verified'
  | 'data_received'
  | 'purchase_complete'
  | 'goal_completed'
  | 'error'

export class AgentActionService {
  /**
   * Log an agent action
   */
  async logAction(
    agentId: string,
    actionType: ActionType,
    details: Record<string, any>,
    status: 'pending' | 'success' | 'failed' = 'pending',
    metadata?: Record<string, any>
  ): Promise<AgentAction> {
    const { data, error } = await supabase
      .from('agent_actions')
      .insert({
        agent_id: agentId,
        action_type: actionType,
        status,
        details,
        metadata: metadata || {},
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to log action: ${error.message}`)
    }

    return data as AgentAction
  }

  /**
   * Update action status
   */
  async updateActionStatus(
    actionId: string,
    status: 'pending' | 'success' | 'failed',
    details?: Record<string, any>
  ): Promise<AgentAction> {
    const updateData: any = { status }
    if (details) {
      updateData.details = details
    }

    const { data, error } = await supabase
      .from('agent_actions')
      .update(updateData)
      .eq('id', actionId)
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to update action: ${error.message}`)
    }

    return data as AgentAction
  }

  /**
   * Get all actions for an agent
   */
  async getAgentActions(agentId: string, limit: number = 100): Promise<AgentAction[]> {
    const { data, error } = await supabase
      .from('agent_actions')
      .select('*')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      throw new Error(`Failed to get actions: ${error.message}`)
    }

    return (data || []) as AgentAction[]
  }

  /**
   * Get recent actions (for real-time updates)
   */
  async getRecentActions(agentId: string, since?: string): Promise<AgentAction[]> {
    let query = supabase
      .from('agent_actions')
      .select('*')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (since) {
      query = query.gt('created_at', since)
    }

    const { data, error } = await query

    if (error) {
      throw new Error(`Failed to get recent actions: ${error.message}`)
    }

    return (data || []) as AgentAction[]
  }

  /**
   * Get interactions for a dataset (actions from agents that queried/purchased this dataset)
   */
  async getDatasetInteractions(datasetId: string, limit: number = 100): Promise<AgentAction[]> {
    // Query actions where details.dataset_id matches
    const { data, error } = await supabase
      .from('agent_actions')
      .select('*')
      .eq('details->>dataset_id', datasetId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      throw new Error(`Failed to get dataset interactions: ${error.message}`)
    }

    return (data || []) as AgentAction[]
  }

  /**
   * Get seller stats from agent actions (purchases of seller's datasets)
   */
  async getSellerStats(sellerId: string): Promise<{
    totalSales: number
    totalRevenue: number
    totalRecordsSold: number
    recentSales: Array<{
      id: string
      endpoint: string
      dataset_name: string
      records: number
      revenue: number
      timestamp: string
    }>
  }> {
    // First, get all datasets for this seller
    const { DatasetService } = await import('./dataset.service.js')
    const datasetService = new DatasetService()
    const sellerDatasets = await datasetService.getSellerDatasets(sellerId)
    const datasetIds = sellerDatasets.map(d => d.id)

    if (datasetIds.length === 0) {
      return {
        totalSales: 0,
        totalRevenue: 0,
        totalRecordsSold: 0,
        recentSales: [],
      }
    }

    // Get all 'purchase_complete' actions for seller's datasets
    // This is the definitive action that indicates a successful purchase
    // Note: We need to query for each dataset_id separately since JSONB filtering with .in() can be tricky
    const allActions: AgentAction[] = []
    
    for (const datasetId of datasetIds) {
      const { data: actions, error } = await supabase
        .from('agent_actions')
        .select('*')
        .eq('action_type', 'purchase_complete')
        .eq('status', 'success')
        .eq('details->>dataset_id', datasetId)
        .order('created_at', { ascending: false })

      if (error) {
        logger.error(`Failed to get actions for dataset ${datasetId}: ${error.message}`)
        continue
      }

      if (actions) {
        allActions.push(...actions)
      }
    }

    // Sort all actions by created_at descending
    const purchaseActions = allActions.sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )

    let totalRevenue = 0
    let totalRecordsSold = 0
    const recentSales: Array<{
      id: string
      endpoint: string
      dataset_name: string
      records: number
      revenue: number
      timestamp: string
    }> = []

    const datasetMap = new Map(sellerDatasets.map(d => [d.id, d]))

    purchaseActions?.forEach((action) => {
      const details = action.details as Record<string, any>
      const datasetId = details?.dataset_id
      const dataset = datasetMap.get(datasetId)
      
      if (dataset && details?.amount && details?.quantity) {
        const amount = parseFloat(details.amount)
        const quantity = parseInt(details.quantity)
        
        totalRevenue += amount
        totalRecordsSold += quantity
        
        recentSales.push({
          id: action.id,
          endpoint: dataset.endpoint_path || '',
          dataset_name: details.dataset_name || dataset.name,
          records: quantity,
          revenue: amount,
          timestamp: action.created_at,
        })
      }
    })

    // Sort by most recent and limit to 10
    recentSales.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    return {
      totalSales: purchaseActions?.length || 0,
      totalRevenue,
      totalRecordsSold,
      recentSales: recentSales.slice(0, 10),
    }
  }
}

