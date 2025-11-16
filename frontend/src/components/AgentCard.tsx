import { useState } from 'react'
import './AgentCard.css'
import AgentDetailModal from './AgentDetailModal'
import { apiClient } from '../utils/api'
import { useNotification } from '../contexts/NotificationContext'

interface AgentCardProps {
  agent: {
    id: string
    name: string
    description?: string
    goal: string
    status: 'active' | 'paused' | 'completed' | 'failed'
    budget: number
    spent: number
    quantity_required?: number
    quantity_acquired: number
    quality_threshold: number
    created_at: string
  }
  onRefresh?: () => void
  onInventoryUpdate?: (data: any[]) => void
}

function AgentCard({ agent, onRefresh, onInventoryUpdate }: AgentCardProps) {
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const { addNotification } = useNotification()

  const budgetRemaining = agent.budget - agent.spent
  const budgetPercentage = agent.budget > 0 ? (agent.spent / agent.budget) * 100 : 0
  const quantityPercentage = agent.quantity_required 
    ? (agent.quantity_acquired / agent.quantity_required) * 100 
    : 0

  const getStatusColor = () => {
    switch (agent.status) {
      case 'active':
        return 'var(--accent-mint)'
      case 'completed':
        return '#10b981'
      case 'failed':
        return '#ef4444'
      case 'paused':
        return '#f59e0b'
      default:
        return 'var(--text-secondary)'
    }
  }

  const getStatusIcon = () => {
    switch (agent.status) {
      case 'active':
        return '🟢'
      case 'completed':
        return '✅'
      case 'failed':
        return '❌'
      case 'paused':
        return '⏸️'
      default:
        return '⚪'
    }
  }

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation() // Prevent opening detail modal
    
    if (!confirm(`Are you sure you want to delete "${agent.name}"? This action cannot be undone.`)) {
      return
    }

    setIsDeleting(true)
    try {
      await apiClient.deleteAgent(agent.id)
      addNotification('success', 'Agent deleted successfully')
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
    <>
      <div className="agent-card" onClick={() => setIsDetailOpen(true)}>
        <div className="agent-card-header">
          <div className="agent-card-title">
            <span className="agent-icon">🤖</span>
            <h3>{agent.name}</h3>
          </div>
          <div className="agent-card-header-right">
            <div className="agent-status" style={{ color: getStatusColor() }}>
              {getStatusIcon()} {agent.status}
            </div>
            <button
              className="agent-delete-btn"
              onClick={handleDelete}
              disabled={isDeleting}
              title="Delete agent"
            >
              {isDeleting ? '⏳' : '🗑️'}
            </button>
          </div>
        </div>

        <div className="agent-card-body">
          <p className="agent-goal">{agent.goal}</p>

          <div className="agent-stats">
            <div className="stat-item">
              <div className="stat-label">Budget</div>
              <div className="stat-value">
                ${budgetRemaining.toFixed(2)} / ${agent.budget.toFixed(2)}
              </div>
              <div className="stat-progress">
                <div 
                  className="stat-progress-bar"
                  style={{ 
                    width: `${Math.min(budgetPercentage, 100)}%`,
                    backgroundColor: budgetPercentage > 90 ? '#ef4444' : 'var(--accent-mint)'
                  }}
                />
              </div>
            </div>

            {agent.quantity_required && (
              <div className="stat-item">
                <div className="stat-label">Data Collected</div>
                <div className="stat-value">
                  {agent.quantity_acquired} / {agent.quantity_required}
                </div>
                <div className="stat-progress">
                  <div 
                    className="stat-progress-bar"
                    style={{ 
                      width: `${Math.min(quantityPercentage, 100)}%`,
                      backgroundColor: 'var(--accent-mint)'
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="agent-card-footer">
          <span className="agent-date">
            Created {new Date(agent.created_at).toLocaleDateString()}
          </span>
        </div>
      </div>

      <AgentDetailModal
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        agentId={agent.id}
        onRefresh={onRefresh}
        onInventoryUpdate={onInventoryUpdate}
      />
    </>
  )
}

export default AgentCard

