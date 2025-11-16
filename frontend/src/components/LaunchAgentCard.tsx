import './LaunchAgentCard.css'

interface LaunchAgentCardProps {
  onLaunchAgent?: () => void
}

function LaunchAgentCard({ onLaunchAgent }: LaunchAgentCardProps) {
  return (
    <div className="launch-agent-card-container">
      <div className="launch-agent-card">
        <div className="launch-agent-emoji">🐵</div>
        <h2 className="launch-agent-title">Launch Your Monkey</h2>
        <p className="launch-agent-description">
          Configure an AI monkey to automatically find and purchase data that matches your requirements.
        </p>
        {onLaunchAgent && (
          <button className="launch-agent-button" onClick={onLaunchAgent}>
            Get Started
            <span className="btn-icon">→</span>
          </button>
        )}
      </div>
    </div>
  )
}

export default LaunchAgentCard

