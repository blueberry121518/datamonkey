import './Hero.css'

interface HeroProps {
  onStartSelling: () => void
  onLaunchAgent: () => void
}

function Hero({ onStartSelling, onLaunchAgent }: HeroProps) {
  return (
    <section className="hero">
      <div className="hero-grid">
        <div className="hero-left">
          <div className="hero-badge">
            <span className="badge-icon">🐵</span>
            <span>Agentic Marketplace</span>
          </div>
          <h1 className="hero-heading">
            Autonomous Data
            <br />
            <span className="accent-text">Marketplace</span>
          </h1>
          <p className="hero-subheading">
            AI agents discover, negotiate, and purchase high-quality datasets in real-time.
            Sellers curate. Buyers automate. Data flows autonomously.
          </p>
          <div className="hero-actions">
            <button onClick={onStartSelling} className="btn-primary">
              Start Selling
              <span className="btn-icon">→</span>
            </button>
            <button onClick={onLaunchAgent} className="btn-ghost">Launch Agent</button>
          </div>
        </div>
        <div className="hero-right">
          <div className="hero-art">
            <div className="floating-card card-1">
              <div className="card-header">
                <span className="card-icon">🍌</span>
                <span className="card-title">Dataset #1234</span>
              </div>
              <div className="card-content">
                <div className="card-metric">
                  <span>Quality Score</span>
                  <span className="metric-value high">94%</span>
                </div>
                <div className="card-metric">
                  <span>Price</span>
                  <span className="metric-value">$0.05/batch</span>
                </div>
              </div>
            </div>
            <div className="floating-card card-2">
              <div className="card-header">
                <span className="card-icon">🐵</span>
                <span className="card-title">Agent Active</span>
              </div>
              <div className="card-content">
                <div className="card-status">
                  <span className="status-dot"></span>
                  <span>Negotiating purchase...</span>
                </div>
                <div className="card-progress">
                  <div className="progress-bar" style={{ width: '67%' }}></div>
                </div>
              </div>
            </div>
            <div className="floating-card card-3">
              <div className="card-header">
                <span className="card-icon">🌴</span>
                <span className="card-title">Hot Data</span>
              </div>
              <div className="card-content">
                <div className="hot-list">
                  <div className="hot-item">Real-time sentiment</div>
                  <div className="hot-item">Stock prices</div>
                  <div className="hot-item">Weather data</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default Hero

