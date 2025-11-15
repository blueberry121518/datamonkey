import './Features.css'

function Features() {
  const features = [
    {
      icon: '🐵',
      title: 'Autonomous Agents',
      description: 'Consumers deploy agents with goals. They automatically discover, evaluate, and purchase datasets that match requirements.'
    },
    {
      icon: '🍌',
      title: 'Quality Scoring',
      description: 'Every dataset is scored for quality and format. Agents only purchase data that meets their standards.'
    },
    {
      icon: '🌿',
      title: 'Smart Negotiation',
      description: 'Agents negotiate prices based on urgency, data rarity, quality scores, and market conditions.'
    },
    {
      icon: '🌴',
      title: 'Hot Data Tracking',
      description: 'Producers see what data is in high demand and can curate datasets to match consumer needs.'
    },
    {
      icon: '🐒',
      title: 'Batch Purchasing',
      description: 'Agents buy data in small batches, continuously evaluating quality before committing to larger purchases.'
    },
    {
      icon: '🌿',
      title: 'Patient Waiting',
      description: 'Agents wait for quality data to become available rather than settling for subpar datasets.'
    }
  ]

  return (
    <section id="features" className="features">
      <div className="features-header">
        <h2>How It Works</h2>
        <p className="body-lg">Autonomous agents meet curated datasets</p>
      </div>
      <div className="features-grid">
        {features.map((feature, index) => (
          <div key={index} className="feature-card">
            <div className="feature-icon">{feature.icon}</div>
            <h3>{feature.title}</h3>
            <p>{feature.description}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

export default Features

