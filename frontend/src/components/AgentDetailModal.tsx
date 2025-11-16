import { useState, useEffect, useRef } from 'react'
import Modal from './Modal'
import { apiClient } from '../utils/api'
import { useNotification } from '../contexts/NotificationContext'
import { useMockAgentExecution } from '../hooks/useMockAgentExecution'
import './AgentDetailModal.css'

interface AgentDetailModalProps {
  isOpen: boolean
  onClose: () => void
  agentId: string
  onRefresh?: () => void
  onInventoryUpdate?: (data: any[]) => void
}

interface AgentAction {
  id: string
  action_type: string
  status: 'pending' | 'success' | 'failed'
  details: Record<string, any>
  created_at: string
}

function AgentDetailModal({ isOpen, onClose, agentId, onRefresh, onInventoryUpdate }: AgentDetailModalProps) {
  const [agent, setAgent] = useState<any>(null)
  const [actions, setActions] = useState<AgentAction[]>([])
  const [balance, setBalance] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [isDeleting, setIsDeleting] = useState(false)
  const terminalEndRef = useRef<HTMLDivElement>(null)
  const { addNotification } = useNotification()

  // Handler to update agent budget and quantity
  const handleAgentUpdate = async (updates: { spent: number; quantity_acquired: number }) => {
    if (!agent) return
    
    // Store mock updates in localStorage so they persist
    const mockUpdates = {
      spent: updates.spent,
      quantity_acquired: updates.quantity_acquired,
      updated_at: Date.now()
    }
    localStorage.setItem(`agent_${agentId}_mock`, JSON.stringify(mockUpdates))
    
    // Update local agent state immediately for UI feedback
    const updatedAgent = {
      ...agent,
      spent: updates.spent,
      quantity_acquired: updates.quantity_acquired,
      // Mark as completed if quantity_required is 100 and we've acquired 100
      status: agent.quantity_required === 100 && updates.quantity_acquired >= 100 ? 'completed' : agent.status
    }
    setAgent(updatedAgent)

    // Trigger refresh to update parent components
    if (onRefresh) {
      onRefresh()
    }
  }

  // Use mock agent execution for demo
  // Run mock execution when modal opens for any agent
  const { mockActions, reset: resetMock, isMockExecuting } = useMockAgentExecution({
    agentId,
    agent,
    isActive: isOpen && agent?.status === 'active', // Only run when modal is open and agent is active
    onInventoryUpdate,
    onAgentUpdate: handleAgentUpdate,
  })

  const loadAgentData = async () => {
    // Don't load agent data while mock is executing - it causes resets
    // The mock handles its own state updates
    if (isMockExecuting() || (agent?.status === 'active' && mockActions.length > 0)) {
      // Mock is running - don't interfere
      return
    }

    try {
      const [agentData, actionsData, balanceData] = await Promise.all([
        apiClient.getAgent(agentId),
        apiClient.getAgentActions(agentId, 50).catch(() => []), // Gracefully handle errors
        apiClient.getAgentBalance(agentId).catch(() => null), // Gracefully handle if wallet doesn't exist
      ])

      setAgent(agentData)
      
      // Only use real actions if mock is not active
      if (!(agentData?.status === 'active' && mockActions.length > 0)) {
        // Filter out error messages from real actions
        const filteredActions = (actionsData || []).filter(
          action => action.action_type !== 'no_datasets_found' && action.action_type !== 'error'
        )
        setActions(filteredActions)
      }
      // If mock is active, don't override the mock actions
      
      setBalance(balanceData) // Will be null if wallet doesn't exist
      setLoading(false)

      if (onRefresh) {
        onRefresh()
      }
    } catch (error) {
      // If API fails but we have mock actions, use those
      if (mockActions.length > 0 && agent?.status === 'active') {
        // Filter out error messages when using mock actions
        const filteredMockActions = mockActions.filter(
          action => action.action_type !== 'no_datasets_found' && action.action_type !== 'error'
        )
        setActions(filteredMockActions)
        setLoading(false)
      } else {
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    if (isOpen && agentId) {
      // Always load agent data initially when modal opens
      // The loadAgentData function will check if mock is executing internally
      loadAgentData()
      
      // Only poll if not using mock (mock handles its own timing)
      // Wait for agent to be loaded before checking
      if (!agent || agent.status !== 'active' || !mockActions.length) {
        const interval = setInterval(() => {
          // Double-check mock isn't running before loading
          if (agent && !isMockExecuting() && !(agent.status === 'active' && mockActions.length > 0)) {
            loadAgentData()
          }
        }, 5000)
        return () => clearInterval(interval)
      }
    } else {
      // Reset agent state when modal closes
      setAgent(null)
      setActions([])
      setBalance(null)
      setLoading(true)
    }
  }, [isOpen, agentId])

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [actions])

  // Update actions when mockActions change
  useEffect(() => {
    if (agent?.status === 'active' && mockActions.length > 0) {
      // Filter out error messages when using mock actions
      const filteredMockActions = mockActions.filter(
        action => action.action_type !== 'no_datasets_found' && action.action_type !== 'error'
      )
      setActions(filteredMockActions)
    }
  }, [mockActions, agent?.status])

  const formatActionMessage = (action: AgentAction): string => {
    const type = action.action_type
    const details = action.details

    switch (type) {
      case 'agent_started':
        return '🤖 Agent initialized and ready'
      case 'discovering_datasets':
        // Handle mock message
        if (details.message) {
          return `🔍 ${details.message}`
        }
        return `🔍 Discovering datasets${details.category ? ` in category: ${details.category}` : ''}${details.required_fields ? ` (required: ${details.required_fields.join(', ')})` : ''}`
      case 'dataset_found':
        return `✅ Found producer${details.datasets ? `: ${details.datasets.map((d: any) => d.name).join(', ')}` : ''}`
      case 'dataset_selected':
        return `🎯 Selected dataset: ${details.dataset_name || details.dataset_id}${details.reason ? ` (${details.reason})` : ''}`
      case 'no_datasets_found':
        return '❌ No matching datasets found in marketplace'
      case 'probing_dataset':
        // Handle mock message
        if (details.message) {
          return `🍌 ${details.message}`
        }
        return `🔎 Probing dataset: ${details.dataset_name || details.dataset_id}`
      case 'analyzing_sample':
        // Handle mock message
        if (details.message) {
          return `⏳ ${details.message}`
        }
        return `🔬 Analyzing sample data (${details.sample_count || 0} records)`
      case 'probe_complete':
        return `📊 Probe complete: ${details.dataset_name} - Price: $${details.price_per_record}/record, Quality: ${(details.quality_score * 100).toFixed(0)}%, Fields: ${details.schema_fields?.join(', ') || 'N/A'}`
      case 'requesting_sample':
        return `📥 Requesting sample data (${details.sample_size || 5} records)`
      case 'sample_received':
        return `📦 Received sample: ${details.sample_count || 0} records`
      case 'analyzing_sample':
        return `🔬 Analyzing sample data (${details.sample_count || 0} records)`
      case 'quality_check':
        return `✅ Quality check: Completeness ${details.completeness}, Schema match ${details.schema_match}, Data quality ${details.data_quality}, Overall: ${details.overall_score}${details.issues && details.issues.length > 0 && details.issues[0] !== 'No issues found' ? ` (Issues: ${details.issues.join('; ')})` : ''}`
      case 'quality_assessment_complete':
        return `📈 Quality assessment: ${(details.overall_score * 100).toFixed(1)}%${details.passed_threshold ? ' ✓ Passed threshold' : ' ✗ Below threshold'}`
      case 'decision_making':
        return `🤔 Making purchase decision... (Quality: ${(details.quality_score * 100).toFixed(1)}%, Budget: $${(details.budget_remaining || 0).toFixed(2)})`
      case 'decision_purchase':
        return `✅ Decision: PURCHASE - ${details.reason} (Cost: $${details.estimated_cost})`
      case 'decision_skip':
        return `⏭️ Decision: SKIP - ${details.reason}${details.quality_score ? ` (Quality: ${(details.quality_score * 100).toFixed(1)}%)` : ''}`
      case 'requesting_data':
        return `📥 Requesting ${details.quantity || 0} records from dataset`
      case 'payment_402_received':
        return `💰 Received x402 payment request: ${details.amount} USDC → ${details.recipient?.substring(0, 10)}...`
      case 'payment_signing':
        return `✍️ Signing payment with wallet...`
      case 'payment_sent':
        return `💸 Payment sent: ${details.amount} USDC`
      case 'payment_verified':
        return `✓ Payment verified`
      case 'data_received':
        return `📦 Received ${details.quantity || 0} data records`
      case 'purchase_complete':
        return `🎉 Purchase complete: ${details.quantity || 0} records for ${details.amount} USDC from ${details.dataset_name || details.dataset_id}`
      case 'goal_completed':
        return `🏆 Goal completed! Collected ${details.quantity_acquired || 0} records`
      case 'error':
        return `❌ Error: ${details.error || 'Unknown error'}`
      default:
        return `${type}: ${JSON.stringify(details)}`
    }
  }

  const getActionType = (action: AgentAction): 'info' | 'success' | 'error' | 'warning' => {
    if (action.status === 'failed' || action.action_type === 'error') {
      return 'error'
    }
    if (action.status === 'success') {
      if (action.action_type.includes('payment') || 
          action.action_type === 'purchase_complete' ||
          action.action_type === 'goal_completed' ||
          action.action_type === 'decision_purchase' ||
          action.action_type === 'quality_assessment_complete' && action.details.passed_threshold) {
        return 'success'
      }
      if (action.action_type === 'decision_skip' || 
          (action.action_type === 'quality_assessment_complete' && !action.details.passed_threshold)) {
        return 'warning'
      }
      return 'info'
    }
    return 'info'
  }

  if (loading && !agent) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="Agent Details">
        <div className="agent-detail-loading">Loading agent details...</div>
      </Modal>
    )
  }

  // Don't return null - show loading state instead
  if (!agent) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="Agent Details">
        <div className="agent-detail-loading">Loading agent details...</div>
      </Modal>
    )
  }

  const budgetRemaining = agent.budget - agent.spent
  const quantityPercentage = agent.quantity_required 
    ? (agent.quantity_acquired / agent.quantity_required) * 100 
    : 0

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete "${agent.name}"? This action cannot be undone.`)) {
      return
    }

    setIsDeleting(true)
    try {
      await apiClient.deleteAgent(agentId)
      addNotification('success', 'Agent deleted successfully')
      onClose()
      if (onRefresh) {
        onRefresh()
      }
    } catch (error) {
      addNotification('error', 'Failed to delete agent')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={agent.name}>
      <div className="agent-detail-modal">
        {/* Agent Stats */}
        <div className="agent-detail-stats">
          <div className="stat-card">
            <div className="stat-label">Status</div>
            <div className={`stat-value stat-${agent.status}`}>
              {agent.status}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Budget Remaining</div>
            <div className="stat-value">
              ${budgetRemaining.toFixed(2)} / ${agent.budget.toFixed(2)}
            </div>
          </div>
          {agent.quantity_required && (
            <div className="stat-card">
              <div className="stat-label">Data Collected</div>
              <div className="stat-value">
                {agent.quantity_acquired} / {agent.quantity_required}
              </div>
            </div>
          )}
          {balance && (
            <div className="stat-card">
              <div className="stat-label">Wallet Balance</div>
              <div className="stat-value">
                {balance.amount || '0'} {balance.assetType || 'USDC'}
              </div>
            </div>
          )}
        </div>

        {/* Agent Info */}
        <div className="agent-detail-info">
          <div className="info-section">
            <h4>Goal</h4>
            <p>{agent.goal}</p>
          </div>
          {agent.description && (
            <div className="info-section">
              <h4>Description</h4>
              <p>{agent.description}</p>
            </div>
          )}
          {agent.requirements && (
            <div className="info-section">
              <h4>Requirements</h4>
              <div className="requirements-list">
                {agent.requirements.category && (
                  <div className="requirement-item">
                    <strong>Category:</strong> {agent.requirements.category}
                  </div>
                )}
                {agent.requirements.requiredFields && agent.requirements.requiredFields.length > 0 && (
                  <div className="requirement-item">
                    <strong>Required Fields:</strong> {agent.requirements.requiredFields.join(', ')}
                  </div>
                )}
                <div className="requirement-item">
                  <strong>Quality Threshold:</strong> {agent.quality_threshold}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="agent-detail-actions">
          <button
            className="agent-delete-button"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? 'Deleting...' : '🗑️ Delete Agent'}
          </button>
        </div>

        {/* Terminal */}
        <div className="notification-terminal">
          <div className="terminal-header">
            <div className="terminal-title">Agent Activity</div>
            <button
              className="terminal-clear-btn"
              onClick={() => {
                setActions([])
                resetMock()
              }}
            >
              Clear
            </button>
          </div>
          <div className="terminal-content">
            {actions.length === 0 ? (
              <div className="terminal-empty">🔍 Scanning for data...</div>
            ) : (
              actions.map((action) => (
                <div
                  key={action.id}
                  className={`terminal-line ${getActionType(action)}`}
                >
                  <span className="terminal-timestamp">
                    {new Date(action.created_at).toLocaleTimeString()}
                  </span>
                  <span className="terminal-message">{formatActionMessage(action)}</span>
                </div>
              ))
            )}
            <div ref={terminalEndRef} />
          </div>
        </div>
      </div>
    </Modal>
  )
}

export default AgentDetailModal

