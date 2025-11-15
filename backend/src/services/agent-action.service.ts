import { supabase } from '../config/supabase.js'

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
  | 'query_seller'
  | 'probe_dataset'
  | 'payment_402_received'
  | 'payment_signing'
  | 'payment_sent'
  | 'payment_verified'
  | 'data_received'
  | 'quality_assessment'
  | 'purchase_complete'
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
}

