import { useState, useEffect } from 'react'
import Modal from './Modal'
import { apiClient } from '../utils/api'
import './EndpointDataModal.css'

interface EndpointDataModalProps {
  isOpen: boolean
  onClose: () => void
  dataset: any
}

function EndpointDataModal({ isOpen, onClose, dataset }: EndpointDataModalProps) {
  const [allData, setAllData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [interactions, setInteractions] = useState<any[]>([])

  useEffect(() => {
    if (isOpen && dataset) {
      loadAllData()
      loadInteractions()
    } else {
      setAllData([])
      setInteractions([])
      setError(null)
    }
  }, [isOpen, dataset])

  const loadAllData = async () => {
    if (!dataset) return

    setLoading(true)
    setError(null)

    try {
      // Fetch all data records for this dataset
      // Use a high limit to get all records (up to 10,000)
      const limit = 10000
      const response = await apiClient.request(`/producer/files/records?dataset_listing_id=${dataset.id}&limit=${limit}&offset=0`) as any
      
      const records = response?.data?.records || response?.data || []
      setAllData(Array.isArray(records) ? records : [])
    } catch (err) {
      console.error('Failed to load endpoint data:', err)
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const loadInteractions = async () => {
    if (!dataset) return

    try {
      const response = await apiClient.getDatasetInteractions(dataset.id) as any
      setInteractions(response?.data || [])
    } catch (err) {
      console.error('Failed to load interactions:', err)
    }
  }

  if (!dataset) return null

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={dataset.name}>
      <div className="endpoint-modal-content">
        {/* Dataset Info */}
        <div className="modal-info-section">
          <div className="info-row">
            <span className="info-label">Endpoint Path:</span>
            <code className="info-value">{dataset.endpoint_path}</code>
          </div>
          <div className="info-row">
            <span className="info-label">Records:</span>
            <span className="info-value">{dataset.total_rows?.toLocaleString() || 'N/A'}</span>
          </div>
          <div className="info-row">
            <span className="info-label">Quality:</span>
            <span className="info-value">
              {dataset.quality_score ? `${(dataset.quality_score * 100).toFixed(0)}%` : 'N/A'}
            </span>
          </div>
          <div className="info-row">
            <span className="info-label">Price:</span>
            <span className="info-value">
              ${dataset.price_per_record?.toFixed(6) || '0.000000'}/record
            </span>
          </div>
          <div className="info-row">
            <span className="info-label">Status:</span>
            <span className={`status-badge ${dataset.is_active ? 'active' : 'inactive'}`}>
              {dataset.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>
          {dataset.description && (
            <div className="info-row">
              <span className="info-label">Description:</span>
              <span className="info-value">{dataset.description}</span>
            </div>
          )}
        </div>

        {/* All Data */}
        <div className="modal-data-section">
          <h3 className="section-title">All Data ({allData.length} records)</h3>
          {loading ? (
            <div className="loading-state">Loading data...</div>
          ) : error ? (
            <div className="error-state">{error}</div>
          ) : allData.length === 0 ? (
            <div className="empty-state">No data available</div>
          ) : (
            <div className="data-viewer">
              <pre className="data-json">{JSON.stringify(allData, null, 2)}</pre>
            </div>
          )}
        </div>

        {/* Interaction History */}
        {interactions.length > 0 && (
          <div className="modal-interactions-section">
            <h3 className="section-title">Interaction History</h3>
            <div className="notification-terminal">
              <div className="terminal-header">
                <div className="terminal-title">Agent Interactions</div>
              </div>
              <div className="terminal-content">
                {interactions.map((interaction, idx) => (
                  <div key={idx} className={`terminal-line ${interaction.action_type || 'info'}`}>
                    <span className="terminal-timestamp">
                      {new Date(interaction.created_at).toLocaleTimeString()}
                    </span>
                    <span className="terminal-message">
                      {interaction.action_type}: {interaction.description || JSON.stringify(interaction.details)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

export default EndpointDataModal

