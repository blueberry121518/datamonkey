import { useState, useEffect } from 'react'
import './BuyerView.css'
import LaunchAgentModal from './LaunchAgentModal'
import AgentCard from './AgentCard'
import { apiClient } from '../utils/api'

function BuyerView() {
  const [view, setView] = useState<'dashboard' | 'inventory'>('dashboard')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [agents, setAgents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadAgents()
    const interval = setInterval(loadAgents, 10000) // Refresh every 10 seconds
    return () => clearInterval(interval)
  }, [])

  const loadAgents = async () => {
    try {
      const data = await apiClient.getMyAgents()
      setAgents(data || [])
      setLoading(false)
    } catch (error) {
      console.error('Failed to load agents:', error)
      setLoading(false)
    }
  }

  const handleLaunchSuccess = () => {
    loadAgents()
    setIsModalOpen(false)
  }

  return (
    <div className="consumer-dashboard">
      <div className="dashboard-nav">
        <div className="nav-tabs">
          <button
            className={`nav-button ${view === 'dashboard' ? 'active' : ''}`}
            onClick={() => setView('dashboard')}
          >
            Dashboard
          </button>
          <button
            className={`nav-button ${view === 'inventory' ? 'active' : ''}`}
            onClick={() => setView('inventory')}
          >
            Inventory
          </button>
        </div>
        <button
          className="btn-primary launch-btn"
          onClick={() => setIsModalOpen(true)}
        >
          🐵 Launch Agent
        </button>
      </div>

      {view === 'dashboard' && (
        <div className="dashboard-content">
          {loading ? (
            <div className="loading-state">Loading agents...</div>
          ) : agents.length === 0 ? (
            <div className="consumer-launch-section">
              <div className="consumer-launch-card">
                <div className="launch-icon">🐵</div>
                <h3>Launch Your Agent</h3>
                <p>Configure an AI agent to automatically find and purchase data that matches your requirements.</p>
              </div>
            </div>
          ) : (
            <div className="agents-grid">
              {agents.map((agent) => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  onRefresh={loadAgents}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {view === 'inventory' && (
        <div className="inventory-content">
          <div className="empty-state">
            <div className="empty-icon">🌴</div>
            <p>No data in inventory yet. Launch an agent to start acquiring data!</p>
          </div>
        </div>
      )}

      <LaunchAgentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleLaunchSuccess}
      />
    </div>
  )
}

export default BuyerView
