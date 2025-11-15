import './CTA.css'

interface CTAProps {
  onStartSelling: () => void
  onDeployAgent: () => void
}

function CTA({ onStartSelling, onDeployAgent }: CTAProps) {
  return (
    <section className="cta">
      <div className="cta-content">
        <h2>Ready to Get Started?</h2>
        <p className="body-lg">
          Join the autonomous data marketplace. Whether you're selling datasets or deploying agents to find them.
        </p>
        <div className="cta-actions">
          <button onClick={onStartSelling} className="btn-primary">
            Start Selling Data
            <span className="btn-icon">→</span>
          </button>
          <button onClick={onDeployAgent} className="btn-ghost">Deploy Your Agent</button>
        </div>
        <div className="cta-features">
          <div className="cta-feature">
            <span className="check-icon">✓</span>
            <span>No upfront costs</span>
          </div>
          <div className="cta-feature">
            <span className="check-icon">✓</span>
            <span>Automatic quality checks</span>
          </div>
          <div className="cta-feature">
            <span className="check-icon">✓</span>
            <span>Smart negotiation</span>
          </div>
        </div>
      </div>
    </section>
  )
}

export default CTA

