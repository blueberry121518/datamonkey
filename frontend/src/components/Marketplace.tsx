import './Marketplace.css'

function Marketplace() {
  const hotData = [
    { name: 'Real-time Sentiment Analysis', demand: 'High', price: '$0.08/batch' },
    { name: 'Stock Price Feeds', demand: 'Very High', price: '$0.12/batch' },
    { name: 'Weather Data API', demand: 'High', price: '$0.05/batch' },
    { name: 'Social Media Metrics', demand: 'Medium', price: '$0.06/batch' }
  ]

  const sampleDatasets = [
    {
      id: 'DS-1234',
      name: 'E-commerce Transaction Data',
      quality: 94,
      price: '$0.05/batch',
      format: 'JSON',
      seller: 'DataCorp'
    },
    {
      id: 'DS-5678',
      name: 'Customer Behavior Analytics',
      quality: 87,
      price: '$0.07/batch',
      format: 'CSV',
      seller: 'AnalyticsPro'
    },
    {
      id: 'DS-9012',
      name: 'IoT Sensor Readings',
      quality: 91,
      price: '$0.04/batch',
      format: 'JSON',
      seller: 'IoTData'
    }
  ]

  return (
    <section id="marketplace" className="marketplace">
      <div className="marketplace-header">
        <h2>Marketplace</h2>
        <p className="body-lg">See what's trending and available</p>
      </div>
      
      <div className="marketplace-grid">
        <div className="hot-data-section">
          <div className="section-header">
            <span className="fire-icon">🔥</span>
            <h3>Hot Data</h3>
          </div>
          <div className="hot-data-list">
            {hotData.map((item, index) => (
              <div key={index} className="hot-data-item">
                <div className="hot-data-info">
                  <span className="hot-data-name">{item.name}</span>
                  <span className="hot-data-price">{item.price}</span>
                </div>
                <div className={`demand-badge demand-${item.demand.toLowerCase().replace(' ', '-')}`}>
                  {item.demand}
                </div>
              </div>
            ))}
          </div>
          <p className="section-note">Sellers can curate datasets to match these high-demand categories</p>
        </div>

        <div className="datasets-section">
          <div className="section-header">
            <span className="section-icon">📊</span>
            <h3>Available Datasets</h3>
          </div>
          <div className="datasets-list">
            {sampleDatasets.map((dataset) => (
              <div key={dataset.id} className="dataset-card">
                <div className="dataset-header">
                  <span className="dataset-id">{dataset.id}</span>
                  <span className={`quality-badge quality-${dataset.quality >= 90 ? 'high' : dataset.quality >= 80 ? 'medium' : 'low'}`}>
                    {dataset.quality}% Quality
                  </span>
                </div>
                <h4 className="dataset-name">{dataset.name}</h4>
                <div className="dataset-details">
                  <span className="dataset-format">{dataset.format}</span>
                  <span className="dataset-seller">by {dataset.seller}</span>
                </div>
                <div className="dataset-footer">
                  <span className="dataset-price">{dataset.price}</span>
                  <button className="btn-ghost-small">View Details</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

export default Marketplace

