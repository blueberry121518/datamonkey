import { useState, useEffect } from 'react'
import './SellerView.css'
import DatasetUploadModal from './DatasetUploadModal'
import FileUploadModal from './FileUploadModal'
import DataViewer from './DataViewer'
import { apiClient } from '../utils/api'

interface Dataset {
  id: string
  name: string
  description?: string
  category?: string
  endpoint_path: string
  type: 'api' | 'agent'
  price_per_record: number
  total_rows?: number
  quality_score?: number
  is_active: boolean
  created_at: string
}

function SellerView() {
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [loading, setLoading] = useState(true)
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const [isFileUploadModalOpen, setIsFileUploadModalOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'datasets' | 'data'>('datasets')

  const fetchDatasets = async () => {
    try {
      setLoading(true)
      const data = await apiClient.getMyDatasets()
      setDatasets(data as Dataset[])
    } catch (error) {
      console.error('Failed to fetch datasets:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDatasets()
  }, [])

  const activeDatasets = datasets.filter((d) => d.is_active)
  const totalRevenue = 0 // TODO: Calculate from purchases

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
            <div className="stat-value">{activeDatasets.length}</div>
            <div className="stat-label">Active Datasets</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">💰</div>
          <div className="stat-content">
            <div className="stat-value">${totalRevenue.toFixed(2)}</div>
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
            <div className="stat-value">{datasets.length}</div>
            <div className="stat-label">Total Datasets</div>
          </div>
        </div>
      </div>

      <div className="seller-tabs">
        <button
          className={`tab-button ${activeTab === 'datasets' ? 'active' : ''}`}
          onClick={() => setActiveTab('datasets')}
        >
          Datasets
        </button>
        <button
          className={`tab-button ${activeTab === 'data' ? 'active' : ''}`}
          onClick={() => setActiveTab('data')}
        >
          All Data
        </button>
      </div>

      {activeTab === 'datasets' && (
        <div className="seller-sections">
          <div className="seller-section">
            <div className="section-header">
              <h3>Your Datasets</h3>
              <div className="section-actions">
                <button
                  className="btn-secondary"
                  onClick={() => setIsFileUploadModalOpen(true)}
                >
                  📁 Upload Files
                </button>
                <button
                  className="btn-primary"
                  onClick={() => setIsUploadModalOpen(true)}
                >
                  + Add Dataset
                </button>
              </div>
            </div>

          {loading ? (
            <div className="empty-state">
              <p>Loading datasets...</p>
            </div>
          ) : datasets.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📦</div>
              <p>No datasets yet. Start by adding your first dataset!</p>
            </div>
          ) : (
            <div className="dataset-list">
              {datasets.map((dataset) => (
                <div key={dataset.id} className="dataset-card">
                  <div className="dataset-card-header">
                    <h4>{dataset.name}</h4>
                    <span
                      className={`dataset-status ${dataset.is_active ? 'active' : 'inactive'}`}
                    >
                      {dataset.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  {dataset.description && (
                    <p className="dataset-description">{dataset.description}</p>
                  )}
                  <div className="dataset-meta">
                    {dataset.category && (
                      <span className="dataset-tag">{dataset.category}</span>
                    )}
                    <span className="dataset-type">{dataset.type}</span>
                    <span className="dataset-price">
                      ${dataset.price_per_record.toFixed(6)}/record
                    </span>
                  </div>
                  {dataset.total_rows && (
                    <div className="dataset-stats">
                      <span>{dataset.total_rows.toLocaleString()} rows</span>
                      {dataset.quality_score !== null &&
                        dataset.quality_score !== undefined && (
                          <span>
                            Quality: {(dataset.quality_score * 100).toFixed(0)}%
                          </span>
                        )}
                    </div>
                  )}
                  <div className="dataset-endpoint">
                    <code>{dataset.endpoint_path}</code>
                  </div>
                </div>
              ))}
            </div>
          )}
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
      )}

      {activeTab === 'data' && (
        <div className="seller-sections">
          <div className="seller-section">
            <DataViewer />
          </div>
        </div>
      )}

      <FileUploadModal
        isOpen={isFileUploadModalOpen}
        onClose={() => setIsFileUploadModalOpen(false)}
        onSuccess={() => {
          if (activeTab === 'data') {
            // Refresh data viewer
            window.location.reload()
          }
        }}
      />

      <DatasetUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onSuccess={() => {
          fetchDatasets()
          setIsUploadModalOpen(false)
        }}
      />
    </div>
  )
}

export default SellerView

