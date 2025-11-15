import { useState } from 'react'
import Modal from './Modal'
import './DatasetUploadModal.css'
import { apiClient } from '../utils/api'

interface DatasetUploadModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

interface FormData {
  name: string
  description: string
  category: string
  type: 'api' | 'agent'
  price_per_record: string
  total_rows: string
  quality_score: string
  content_summary: string
  // For auto-detection
  sampleData: string // JSON string
}

const CATEGORIES = [
  'Images',
  'Text',
  'Audio',
  'Video',
  'Structured Data',
  'Time Series',
  'Geospatial',
  'Other',
]

function DatasetUploadModal({ isOpen, onClose, onSuccess }: DatasetUploadModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [autoDetect, setAutoDetect] = useState(false)
  const [formData, setFormData] = useState<FormData>({
    name: '',
    description: '',
    category: '',
    type: 'api',
    price_per_record: '0.001',
    total_rows: '',
    quality_score: '',
    content_summary: '',
    sampleData: '',
  })

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // Prepare payload
      const payload: any = {
        name: formData.name,
        description: formData.description || undefined,
        category: formData.category || undefined,
        type: formData.type,
        price_per_record: parseFloat(formData.price_per_record) || 0.001,
      }

      // Add optional fields if provided
      if (formData.total_rows) {
        payload.total_rows = parseInt(formData.total_rows)
      }
      if (formData.quality_score) {
        payload.quality_score = parseFloat(formData.quality_score)
      }
      if (formData.content_summary) {
        payload.content_summary = formData.content_summary
      }

      // If auto-detect is enabled and sample data provided
      if (autoDetect && formData.sampleData) {
        try {
          const parsed = JSON.parse(formData.sampleData)
          payload.metadata = {
            sampleData: parsed,
          }
        } catch (err) {
          throw new Error('Invalid JSON in sample data')
        }
      }

      await apiClient.createDataset(payload)
      onSuccess()
      handleClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create dataset')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setFormData({
      name: '',
      description: '',
      category: '',
      type: 'api',
      price_per_record: '0.001',
      total_rows: '',
      quality_score: '',
      content_summary: '',
      sampleData: '',
    })
    setError(null)
    setAutoDetect(false)
    onClose()
  }

  if (!isOpen) return null

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Add New Dataset">
      <form onSubmit={handleSubmit} className="dataset-upload-form">
        {error && <div className="form-error">{error}</div>}

        <div className="form-group">
          <label htmlFor="name">
            Dataset Name <span className="required">*</span>
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            placeholder="e.g., Cat Images Dataset"
          />
        </div>

        <div className="form-group">
          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            rows={3}
            placeholder="Describe your dataset..."
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="category">Category</label>
            <select
              id="category"
              name="category"
              value={formData.category}
              onChange={handleChange}
            >
              <option value="">Select category</option>
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="type">Type</label>
            <select
              id="type"
              name="type"
              value={formData.type}
              onChange={handleChange}
            >
              <option value="api">API Endpoint</option>
              <option value="agent">Agent</option>
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="price_per_record">
              Price per Record (USDC) <span className="required">*</span>
            </label>
            <input
              type="number"
              id="price_per_record"
              name="price_per_record"
              value={formData.price_per_record}
              onChange={handleChange}
              required
              min="0"
              step="0.000001"
              placeholder="0.001"
            />
          </div>

          <div className="form-group">
            <label htmlFor="total_rows">Total Rows</label>
            <input
              type="number"
              id="total_rows"
              name="total_rows"
              value={formData.total_rows}
              onChange={handleChange}
              min="1"
              placeholder="Optional"
            />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="quality_score">Quality Score (0.0 - 1.0)</label>
          <input
            type="number"
            id="quality_score"
            name="quality_score"
            value={formData.quality_score}
            onChange={handleChange}
            min="0"
            max="1"
            step="0.01"
            placeholder="0.00 - 1.00"
          />
        </div>

        <div className="form-group">
          <label htmlFor="content_summary">Content Summary</label>
          <textarea
            id="content_summary"
            name="content_summary"
            value={formData.content_summary}
            onChange={handleChange}
            rows={2}
            placeholder="Brief summary of dataset content..."
          />
        </div>

        <div className="form-group">
          <div className="checkbox-group">
            <input
              type="checkbox"
              id="autoDetect"
              checked={autoDetect}
              onChange={(e) => setAutoDetect(e.target.checked)}
            />
            <label htmlFor="autoDetect">
              Auto-detect metadata from sample data
            </label>
          </div>
        </div>

        {autoDetect && (
          <div className="form-group">
            <label htmlFor="sampleData">Sample Data (JSON Array)</label>
            <textarea
              id="sampleData"
              name="sampleData"
              value={formData.sampleData}
              onChange={handleChange}
              rows={6}
              placeholder='[{"field1": "value1", "field2": 123}, {"field1": "value2", "field2": 456}]'
            />
            <small className="form-hint">
              Provide a JSON array with sample records. We'll auto-detect schema,
              quality score, and generate a summary.
            </small>
          </div>
        )}

        <div className="form-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={handleClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Creating...' : 'Create Dataset'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default DatasetUploadModal

