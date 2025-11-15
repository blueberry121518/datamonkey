import { useState, useEffect } from 'react'
import './BuyerView.css'
import AgentActionViewer from './AgentActionViewer'
import { apiClient } from '../utils/api'

interface Agent {
  id: string
  name: string
  status: string
  goal: string
  budget: number
  current_spend: number
}

function BuyerView() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAgents()
  }, [])

  const fetchAgents = async () => {
    try {
      setLoading(true)
      const data = await apiClient.getMyAgents()
      setAgents(data as Agent[])
      if (data && (data as Agent[]).length > 0 && !selectedAgentId) {
        setSelectedAgentId((data as Agent[])[0].id)
      }
    } catch (error) {
      console.error('Failed to fetch agents:', error)
    } finally {
      setLoading(false)
    }
  }
  return (
    <div className="buyer-view">
      <div className="view-header">
        <h2>Buyer Dashboard</h2>
        <p className="view-description">
          Deploy agents, monitor purchases, and manage your data acquisition goals.
        </p>
      </div>

      <div className="buyer-stats">
        <div className="stat-card">
          <div className="stat-icon">🤖</div>
          <div className="stat-content">
            <div className="stat-value">0</div>
            <div className="stat-label">Active Agents</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">📦</div>
          <div className="stat-content">
            <div className="stat-value">0</div>
            <div className="stat-label">Datasets Purchased</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">💰</div>
          <div className="stat-content">
            <div className="stat-value">$0.00</div>
            <div className="stat-label">Total Spent</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">✅</div>
          <div className="stat-content">
            <div className="stat-value">0</div>
            <div className="stat-label">Goals Completed</div>
          </div>
        </div>
      </div>

      <div className="buyer-sections">
        <div className="buyer-section">
          <div className="section-header">
            <h3>Active Agents</h3>
            <button className="btn-primary">+ Launch Agent</button>
          </div>
          {loading ? (
            <div className="empty-state">
              <p>Loading agents...</p>
            </div>
          ) : agents.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🤖</div>
              <p>No active agents. Launch your first agent to start acquiring data!</p>
            </div>
          ) : (
            <div className="agents-list">
              {agents.map((agent) => (
                <div
                  key={agent.id}
                  className={`agent-card ${selectedAgentId === agent.id ? 'active' : ''}`}
                  onClick={() => setSelectedAgentId(agent.id)}
                >
                  <div className="agent-card-header">
                    <h4>{agent.name}</h4>
                    <span className={`agent-status ${agent.status}`}>
                      {agent.status}
                    </span>
                  </div>
                  <p className="agent-goal">{agent.goal}</p>
                  <div className="agent-stats">
                    <span>Budget: ${agent.budget.toFixed(2)}</span>
                    <span>Spent: ${agent.current_spend.toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {selectedAgentId && (
          <div className="buyer-section">
            <div className="section-header">
              <h3>Agent Actions (Real-time)</h3>
            </div>
            <AgentActionViewer agentId={selectedAgentId} />
          </div>
        )}

        <div className="buyer-section">
          <div className="section-header">
            <h3>Purchase History</h3>
          </div>
          <div className="empty-state">
            <div className="empty-icon">📊</div>
            <p>Your purchase history will appear here once agents start buying data.</p>
          </div>
        </div>

        <div className="buyer-section">
          <div className="section-header">
            <h3>Agent Goals</h3>
            <button className="btn-primary">+ Create Goal</button>
          </div>
          <div className="empty-state">
            <div className="empty-icon">🎯</div>
            <p>Create goals to guide your agents' data acquisition.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default BuyerView

