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
  const [inventoryData, setInventoryData] = useState<any[]>([])

  useEffect(() => {
    loadAgents()
    const interval = setInterval(loadAgents, 10000) // Refresh every 10 seconds
    return () => clearInterval(interval)
  }, [])

  const loadAgents = async () => {
    try {
      const data = await apiClient.getMyAgents()
      let agentsList = data || []
      
      // Apply mock updates to agents if they exist
      agentsList = agentsList.map((agent: any) => {
        const mockDataStr = localStorage.getItem(`agent_${agent.id}_mock`)
        if (mockDataStr) {
          try {
            const mockData = JSON.parse(mockDataStr)
            return {
              ...agent,
              spent: mockData.spent,
              quantity_acquired: mockData.quantity_acquired,
              // Update status if quantity requirement is met
              status: agent.quantity_required === 100 && mockData.quantity_acquired >= 100 
                ? 'completed' 
                : agent.status
            }
          } catch (e) {
            return agent
          }
        }
        return agent
      })
      
      setAgents(agentsList)
      setLoading(false)
    } catch (error) {
      setLoading(false)
    }
  }

  const handleLaunchSuccess = () => {
    loadAgents()
    setIsModalOpen(false)
  }

  const handleReset = () => {
    setInventoryData([])
    // Clear all mock data from localStorage
    agents.forEach((agent: any) => {
      localStorage.removeItem(`agent_${agent.id}_mock`)
    })
    loadAgents() // Refresh to reset agent states
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
          🐵 Launch Monkey
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
                <h3>Launch Your Monkey</h3>
                <p>Configure an AI monkey to automatically find and purchase data that matches your requirements.</p>
              </div>
            </div>
          ) : (
            <div className="agents-grid">
              {agents.map((agent) => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  onRefresh={loadAgents}
                  onInventoryUpdate={setInventoryData}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {view === 'inventory' && (
        <div className="inventory-content">
          {inventoryData.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🌴</div>
              <p>No data in inventory yet. Launch an agent to start acquiring data!</p>
            </div>
          ) : (
            <div className="inventory-data-viewer">
              <div className="inventory-header">
                <h3>Acquired Data ({inventoryData.length} records)</h3>
                <button
                  className="btn-secondary"
                  onClick={handleReset}
                >
                  Reset
                </button>
              </div>
              <div className="csv-table-container">
                <table className="csv-table">
                  <thead>
                    <tr>
                      {Object.keys(inventoryData[0] || {}).map((key) => (
                        <th key={key}>{key}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {inventoryData.map((row, idx) => (
                      <tr key={idx}>
                        {Object.values(row).map((value: any, colIdx) => (
                          <td key={colIdx}>{String(value)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
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
