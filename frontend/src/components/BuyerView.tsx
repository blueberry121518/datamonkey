import './BuyerView.css'

function BuyerView() {
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
          <div className="empty-state">
            <div className="empty-icon">🤖</div>
            <p>No active agents. Launch your first agent to start acquiring data!</p>
          </div>
        </div>

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

