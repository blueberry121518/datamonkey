import { useState, useEffect, useRef } from 'react'
import { apiClient } from '../utils/api'
import './AgentActionViewer.css'

interface AgentAction {
  id: string
  agent_id: string
  action_type: string
  status: 'pending' | 'success' | 'failed'
  details: Record<string, any>
  metadata?: Record<string, any>
  created_at: string
}

interface AgentActionViewerProps {
  agentId: string
}

function AgentActionViewer({ agentId }: AgentActionViewerProps) {
  const [actions, setActions] = useState<AgentAction[]>([])
  const [loading, setLoading] = useState(true)
  const eventSourceRef = useRef<EventSource | null>(null)

  useEffect(() => {
    // Initial load
    fetchActions()

    // Setup SSE connection for real-time updates
    const token = localStorage.getItem('user')
      ? JSON.parse(localStorage.getItem('user')!).token
      : null

    if (token) {
      const eventSource = new EventSource(
        `http://localhost:8000/api/realtime/agent/${agentId}`,
        {
          withCredentials: true,
        }
      )

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data.type === 'action') {
            setActions((prev) => [data.data, ...prev])
          }
        } catch (error) {
          console.error('Failed to parse SSE message:', error)
        }
      }

      eventSource.onerror = (error) => {
        console.error('SSE error:', error)
        // Fallback to polling if SSE fails
        const pollInterval = setInterval(() => {
          fetchRecentActions()
        }, 5000)
        return () => clearInterval(pollInterval)
      }

      eventSourceRef.current = eventSource
    }

    // Polling fallback every 5 seconds
    const pollInterval = setInterval(() => {
      fetchRecentActions()
    }, 5000)

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }
      clearInterval(pollInterval)
    }
  }, [agentId])

  const fetchActions = async () => {
    try {
      setLoading(true)
      const data = await apiClient.getAgentActions(agentId, 100)
      setActions(data as AgentAction[])
    } catch (error) {
      console.error('Failed to fetch actions:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchRecentActions = async () => {
    try {
      const lastAction = actions[0]
      const since = lastAction?.created_at
      const data = await apiClient.getRecentAgentActions(agentId, since)
      if (data && (data as AgentAction[]).length > 0) {
        setActions((prev) => [...(data as AgentAction[]), ...prev])
      }
    } catch (error) {
      console.error('Failed to fetch recent actions:', error)
    }
  }

  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case 'query_seller':
        return '🔍'
      case 'probe_dataset':
        return '🔎'
      case 'payment_402_received':
        return '💳'
      case 'payment_signing':
        return '✍️'
      case 'payment_sent':
        return '📤'
      case 'payment_verified':
        return '✅'
      case 'data_received':
        return '📥'
      case 'quality_assessment':
        return '⭐'
      case 'purchase_complete':
        return '🎉'
      case 'error':
        return '❌'
      default:
        return '⚡'
    }
  }

  const getActionLabel = (actionType: string) => {
    return actionType
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const seconds = Math.floor(diff / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)

    if (seconds < 60) return `${seconds}s ago`
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    return date.toLocaleString()
  }

  if (loading && actions.length === 0) {
    return (
      <div className="agent-action-viewer">
        <div className="loading-state">Loading agent actions...</div>
      </div>
    )
  }

  return (
    <div className="agent-action-viewer">
      <div className="action-viewer-header">
        <h3>Agent Actions (Real-time)</h3>
        <button className="btn-secondary" onClick={fetchActions}>
          Refresh
        </button>
      </div>

      {actions.length === 0 ? (
        <div className="empty-state">No actions yet</div>
      ) : (
        <div className="actions-list">
          {actions.map((action) => (
            <div
              key={action.id}
              className={`action-item ${action.status}`}
            >
              <div className="action-header">
                <div className="action-icon">{getActionIcon(action.action_type)}</div>
                <div className="action-info">
                  <div className="action-type">{getActionLabel(action.action_type)}</div>
                  <div className="action-time">{formatTime(action.created_at)}</div>
                </div>
                <div className={`action-status ${action.status}`}>
                  {action.status}
                </div>
              </div>
              {Object.keys(action.details).length > 0 && (
                <div className="action-details">
                  {action.details.dataset_name && (
                    <div className="detail-item">
                      <span className="detail-label">Dataset:</span>
                      <span className="detail-value">{action.details.dataset_name}</span>
                    </div>
                  )}
                  {action.details.amount && (
                    <div className="detail-item">
                      <span className="detail-label">Amount:</span>
                      <span className="detail-value">{action.details.amount} USDC</span>
                    </div>
                  )}
                  {action.details.quantity && (
                    <div className="detail-item">
                      <span className="detail-label">Quantity:</span>
                      <span className="detail-value">{action.details.quantity}</span>
                    </div>
                  )}
                  {action.details.error && (
                    <div className="detail-item error">
                      <span className="detail-label">Error:</span>
                      <span className="detail-value">{action.details.error}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default AgentActionViewer

