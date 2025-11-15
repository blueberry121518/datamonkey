import { useState, useEffect, useRef } from 'react'
import Modal from './Modal'
import { apiClient } from '../utils/api'
import { useNotification } from '../contexts/NotificationContext'
import './AgentDetailModal.css'

interface AgentDetailModalProps {
  isOpen: boolean
  onClose: () => void
  agentId: string
  onRefresh?: () => void
}

interface AgentAction {
  id: string
  action_type: string
  status: 'pending' | 'success' | 'failed'
  details: Record<string, any>
  created_at: string
}

function AgentDetailModal({ isOpen, onClose, agentId, onRefresh }: AgentDetailModalProps) {
  const [agent, setAgent] = useState<any>(null)
  const [actions, setActions] = useState<AgentAction[]>([])
  const [balance, setBalance] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [isDeleting, setIsDeleting] = useState(false)
  const terminalEndRef = useRef<HTMLDivElement>(null)
  const { addNotification } = useNotification()

  useEffect(() => {
    if (isOpen && agentId) {
      loadAgentData()
      const interval = setInterval(loadAgentData, 5000) // Refresh every 5 seconds
      return () => clearInterval(interval)
    }
  }, [isOpen, agentId])

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [actions])

  const loadAgentData = async () => {
    try {
      const [agentData, actionsData, balanceData] = await Promise.all([
        apiClient.getAgent(agentId),
        apiClient.getAgentActions(agentId, 50),
        apiClient.getAgentBalance(agentId).catch(() => null), // Gracefully handle if wallet doesn't exist
      ])

      setAgent(agentData)
      setActions(actionsData || [])
      setBalance(balanceData) // Will be null if wallet doesn't exist
      setLoading(false)

      if (onRefresh) {
        onRefresh()
      }
    } catch (error) {
      console.error('Failed to load agent data:', error)
      setLoading(false)
    }
  }

  const formatActionMessage = (action: AgentAction): string => {
    const type = action.action_type
    const details = action.details

    switch (type) {
      case 'agent_started':
        return 'Agent started discovering datasets'
      case 'discovering_datasets':
        return `🔍 Discovering datasets${details.category ? ` in category: ${details.category}` : ''}${details.required_fields ? ` (required: ${details.required_fields.join(', ')})` : ''}`
      case 'dataset_found':
        return `✅ Found ${details.count || 0} dataset(s)${details.datasets ? `: ${details.datasets.map((d: any) => d.name).join(', ')}` : ''}`
      case 'dataset_selected':
        return `🎯 Selected dataset: ${details.dataset_name || details.dataset_id}${details.reason ? ` (${details.reason})` : ''}`
      case 'no_datasets_found':
        return '❌ No matching datasets found in marketplace'
      case 'probing_dataset':
        return `🔎 Probing dataset: ${details.dataset_name || details.dataset_id}`
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
        <div className="agent-detail-loading">Loading...</div>
      </Modal>
    )
  }

  if (!agent) {
    return null
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
      console.error('Failed to delete agent:', error)
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
              onClick={() => setActions([])}
            >
              Clear
            </button>
          </div>
          <div className="terminal-content">
            {actions.length === 0 ? (
              <div className="terminal-empty">🍌 Scanning for bananas...</div>
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

