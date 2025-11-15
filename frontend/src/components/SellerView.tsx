import './SellerView.css'

function SellerView() {
  return (
    <div className="seller-view">
      <div className="view-header">
        <h2>Seller Dashboard</h2>
        <p className="view-description">
          Manage your datasets, track sales, and see what data is in high demand.
        </p>
      </div>

      <div className="seller-stats">
        <div className="stat-card">
          <div className="stat-icon">📊</div>
          <div className="stat-content">
            <div className="stat-value">0</div>
            <div className="stat-label">Active Datasets</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">💰</div>
          <div className="stat-content">
            <div className="stat-value">$0.00</div>
            <div className="stat-label">Total Revenue</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🔥</div>
          <div className="stat-content">
            <div className="stat-value">0</div>
            <div className="stat-label">Hot Data Items</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">📈</div>
          <div className="stat-content">
            <div className="stat-value">0</div>
            <div className="stat-label">Total Sales</div>
          </div>
        </div>
      </div>

      <div className="seller-sections">
        <div className="seller-section">
          <div className="section-header">
            <h3>Your Datasets</h3>
            <button className="btn-primary">+ Add Dataset</button>
          </div>
          <div className="empty-state">
            <div className="empty-icon">📦</div>
            <p>No datasets yet. Start by adding your first dataset!</p>
          </div>
        </div>

        <div className="seller-section">
          <div className="section-header">
            <h3>Hot Data Trends</h3>
          </div>
          <div className="empty-state">
            <div className="empty-icon">🔥</div>
            <p>Hot data trends will appear here once you have active datasets.</p>
          </div>
        </div>

        <div className="seller-section">
          <div className="section-header">
            <h3>Recent Sales</h3>
          </div>
          <div className="empty-state">
            <div className="empty-icon">💵</div>
            <p>Your sales history will appear here.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SellerView

