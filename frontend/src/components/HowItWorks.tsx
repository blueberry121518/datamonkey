import './HowItWorks.css'

function HowItWorks() {
  const steps = [
    {
      number: '01',
      title: 'Sellers List Data',
      description: 'Sellers create agents or API endpoints offering datasets. They can see "hot data" trends and curate collections to match demand.',
      icon: '📤'
    },
    {
      number: '02',
      title: 'Buyers Deploy Agents',
      description: 'Buyers initialize agents with specific goals: data type, quantity, quality thresholds, and budget constraints.',
      icon: '🚀'
    },
    {
      number: '03',
      title: 'Agents Discover & Evaluate',
      description: 'Agents automatically search the marketplace, evaluate quality scores, check format compatibility, and assess pricing.',
      icon: '🔍'
    },
    {
      number: '04',
      title: 'Smart Negotiation',
      description: 'Agents negotiate prices based on urgency, data rarity, quality scores, and market conditions to get the best deal.',
      icon: '💬'
    },
    {
      number: '05',
      title: 'Batch Purchasing',
      description: 'Agents purchase data in small batches. If quality doesn\'t meet standards, they skip and wait for better data.',
      icon: '📦'
    },
    {
      number: '06',
      title: 'Continuous Operation',
      description: 'Agents continue operating until goals are met, waiting patiently for quality data when needed.',
      icon: '♻️'
    }
  ]

  return (
    <section id="how-it-works" className="how-it-works">
      <div className="how-it-works-header">
        <h2>The Process</h2>
        <p className="body-lg">From listing to purchase, fully automated</p>
      </div>
      <div className="steps-container">
        {steps.map((step, index) => (
          <div key={index} className="step-item">
            <div className="step-number">{step.number}</div>
            <div className="step-content">
              <div className="step-icon">{step.icon}</div>
              <h3>{step.title}</h3>
              <p>{step.description}</p>
            </div>
            {index < steps.length - 1 && <div className="step-connector"></div>}
          </div>
        ))}
      </div>
    </section>
  )
}

export default HowItWorks

