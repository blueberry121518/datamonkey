import { useState, useEffect } from 'react'
import Modal from './Modal'
import { apiClient } from '../utils/api'
import './UploadDataModal.css'

interface UploadDataModalProps {
  isOpen: boolean
  onClose: () => void
}

interface Notification {
  id: string
  type: 'info' | 'success' | 'error' | 'warning'
  message: string
  timestamp: Date
}

function UploadDataModal({ isOpen, onClose }: UploadDataModalProps) {
  const [uploadType, setUploadType] = useState<'unstructured' | 'structured'>('unstructured')
  const [files, setFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])

  // Structured endpoint fields
  const [endpointName, setEndpointName] = useState('')
  const [endpointDescription, setEndpointDescription] = useState('')
  const [pricePerRecord, setPricePerRecord] = useState('0.001')
  const [category, setCategory] = useState('')

  // Unstructured data fields
  const [dataName, setDataName] = useState('')
  const [dataDescription, setDataDescription] = useState('')
  const [dataCategory, setDataCategory] = useState('')
  const [tags, setTags] = useState('')

  // Loading states for auto-fill
  const [isAutoFilling, setIsAutoFilling] = useState(false)
  const [autoFillStatus, setAutoFillStatus] = useState<{
    name: boolean
    description: boolean
    category: boolean
    price: boolean
    tags: boolean
  }>({
    name: false,
    description: false,
    category: false,
    price: false,
    tags: false,
  })

  const addNotification = (type: Notification['type'], message: string) => {
    const notification: Notification = {
      id: Date.now().toString() + Math.random(),
      type,
      message,
      timestamp: new Date(),
    }
    setNotifications((prev) => [...prev, notification])
  }

  // Auto-fill fields when files are selected
  useEffect(() => {
    const autoFillFields = async () => {
      if (files.length === 0) {
        return
      }

      setIsAutoFilling(true)
      addNotification('info', 'Analyzing files to auto-fill fields...')

      try {
        const formData = new FormData()
        formData.append('files', files[0]) // Use first file for metadata suggestion

        const response = await apiClient.suggestMetadata(formData, uploadType)

        if (response.success && response.data) {
          const suggestion = response.data

          if (uploadType === 'structured') {
            // Animate field filling for structured
            if (suggestion.name) {
              setAutoFillStatus((prev) => ({ ...prev, name: true }))
              await new Promise((resolve) => setTimeout(resolve, 300))
              setEndpointName(suggestion.name)
              setAutoFillStatus((prev) => ({ ...prev, name: false }))
            }

            if (suggestion.description) {
              setAutoFillStatus((prev) => ({ ...prev, description: true }))
              await new Promise((resolve) => setTimeout(resolve, 300))
              setEndpointDescription(suggestion.description)
              setAutoFillStatus((prev) => ({ ...prev, description: false }))
            }

            if (suggestion.category) {
              setAutoFillStatus((prev) => ({ ...prev, category: true }))
              await new Promise((resolve) => setTimeout(resolve, 300))
              setCategory(suggestion.category)
              setAutoFillStatus((prev) => ({ ...prev, category: false }))
            }

            if (suggestion.pricePerRecord !== undefined) {
              setAutoFillStatus((prev) => ({ ...prev, price: true }))
              await new Promise((resolve) => setTimeout(resolve, 300))
              setPricePerRecord(suggestion.pricePerRecord.toString())
              setAutoFillStatus((prev) => ({ ...prev, price: false }))
            }
          } else {
            // Animate field filling for unstructured
            if (suggestion.name) {
              setAutoFillStatus((prev) => ({ ...prev, name: true }))
              await new Promise((resolve) => setTimeout(resolve, 300))
              setDataName(suggestion.name)
              setAutoFillStatus((prev) => ({ ...prev, name: false }))
            }

            if (suggestion.description) {
              setAutoFillStatus((prev) => ({ ...prev, description: true }))
              await new Promise((resolve) => setTimeout(resolve, 300))
              setDataDescription(suggestion.description)
              setAutoFillStatus((prev) => ({ ...prev, description: false }))
            }

            if (suggestion.category) {
              setAutoFillStatus((prev) => ({ ...prev, category: true }))
              await new Promise((resolve) => setTimeout(resolve, 300))
              setDataCategory(suggestion.category)
              setAutoFillStatus((prev) => ({ ...prev, category: false }))
            }

            if (suggestion.tags && Array.isArray(suggestion.tags)) {
              setAutoFillStatus((prev) => ({ ...prev, tags: true }))
              await new Promise((resolve) => setTimeout(resolve, 300))
              setTags(suggestion.tags.join(', '))
              setAutoFillStatus((prev) => ({ ...prev, tags: false }))
            }
          }

          addNotification('success', 'Fields auto-filled! You can edit them if needed.')
        }
      } catch (error) {
        addNotification('warning', 'Could not auto-fill fields. Please fill them manually.')
        console.error('Auto-fill error:', error)
      } finally {
        setIsAutoFilling(false)
      }
    }

    autoFillFields()
  }, [files, uploadType])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files)
      setFiles(selectedFiles)
      addNotification('info', `Selected ${selectedFiles.length} file(s)`)
    }
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (e.dataTransfer.files) {
      const droppedFiles = Array.from(e.dataTransfer.files)
      setFiles(droppedFiles)
      droppedFiles.forEach((file) => {
        addNotification('info', `Dropped file: ${file.name}`)
      })
    }
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
  }

  const handleUpload = async () => {
    if (files.length === 0) {
      addNotification('warning', 'Please select files to upload')
      return
    }

    if (uploadType === 'structured') {
      if (!endpointName.trim()) {
        addNotification('warning', 'Please enter an endpoint name')
        return
      }
    }

    setUploading(true)
    setNotifications([])
    addNotification('info', `Starting ${uploadType} upload...`)

    try {
      if (uploadType === 'unstructured') {
        // Unstructured: Upload to data warehouse with metadata
        const formData = new FormData()
        files.forEach((file) => {
          formData.append('files', file)
        })

        // Add metadata if provided
        if (dataName || dataDescription || dataCategory || tags) {
          const metadata: any = {}
          if (dataName) metadata.name = dataName
          if (dataDescription) metadata.description = dataDescription
          if (dataCategory) metadata.category = dataCategory
          if (tags) metadata.tags = tags.split(',').map(t => t.trim()).filter(t => t)
          formData.append('metadata', JSON.stringify(metadata))
        }

        addNotification('info', `Uploading ${files.length} file(s) to data warehouse...`)

        const response = await apiClient.uploadFiles(formData)

        if (response.success) {
          addNotification('success', `Upload successful: ${response.data.uploaded} file(s)`)
          
          const results = response.data.results || []
          results.forEach((result: any) => {
            if (result.status === 'completed') {
              addNotification('success', `✓ Parsed: ${result.filename}`)
              addNotification('info', `  → Category: ${result.category || 'N/A'}`)
              addNotification('info', `  → Records: ${result.records_created || 0}`)
              addNotification('success', `  → Saved to data warehouse`)
            } else if (result.status === 'failed') {
              addNotification('error', `✗ Failed: ${result.filename}`)
            }
          })

          setTimeout(() => {
            resetForm()
            onClose()
          }, 2000)
        }
      } else {
        // Structured: Upload files and create endpoint
        const formData = new FormData()
        files.forEach((file) => {
          formData.append('files', file)
        })

        addNotification('info', `Uploading ${files.length} file(s)...`)

        const uploadResponse = await apiClient.uploadFiles(formData)

        if (uploadResponse.success) {
          addNotification('success', `Files uploaded successfully`)
          
          // Create dataset endpoint
          addNotification('info', `Creating endpoint: ${endpointName}...`)

          const datasetData = {
            name: endpointName,
            description: endpointDescription || undefined,
            category: category || undefined,
            type: 'api',
            price_per_record: parseFloat(pricePerRecord) || 0.001,
          }

          await apiClient.createDataset(datasetData)
          addNotification('success', `✓ Endpoint created: ${endpointName}`)
          addNotification('info', `  → Price: $${pricePerRecord}/record`)
          addNotification('success', `  → Endpoint is now active`)

          setTimeout(() => {
            resetForm()
            onClose()
          }, 2000)
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      const errorDetails = error instanceof Error ? error.stack : String(error)
      addNotification('error', `Upload failed: ${errorMessage}`)
      console.error('File upload error:', error)
      console.error('Error details:', errorDetails)
      
      // If it's an API error, try to extract more details
      if (error && typeof error === 'object' && 'response' in error) {
        const apiError = error as any
        if (apiError.response?.data?.error) {
          addNotification('error', `API Error: ${apiError.response.data.error}`)
        }
      }
    } finally {
      setUploading(false)
    }
  }

  const resetForm = () => {
    setFiles([])
    setNotifications([])
    setEndpointName('')
    setEndpointDescription('')
    setPricePerRecord('0.001')
    setCategory('')
    setDataName('')
    setDataDescription('')
    setDataCategory('')
    setTags('')
    setIsAutoFilling(false)
    setAutoFillStatus({
      name: false,
      description: false,
      category: false,
      price: false,
      tags: false,
    })
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  const handleRemoveFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index))
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Upload Data">
      <div className="upload-data-modal">
        {/* Toggle Switch */}
        <div className="upload-type-switch">
          <label className="switch-label">
            <span className={uploadType === 'unstructured' ? 'active' : ''}>Unstructured</span>
            <div className="switch-container">
              <input
                type="checkbox"
                className="switch-input"
                checked={uploadType === 'structured'}
                onChange={(e) => setUploadType(e.target.checked ? 'structured' : 'unstructured')}
                disabled={uploading}
              />
              <span className="switch-slider"></span>
            </div>
            <span className={uploadType === 'structured' ? 'active' : ''}>Structured</span>
          </label>
          <p className="switch-description">
            {uploadType === 'unstructured'
              ? 'Files will be added to your general data warehouse'
              : 'Files will create a new endpoint for buyers to purchase'}
          </p>
        </div>

        {/* File Upload Section - Moved to Top */}
        <div className="upload-section">
          <div
            className="file-input-wrapper"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
          >
            <input
              type="file"
              id="file-input"
              multiple
              onChange={handleFileSelect}
              disabled={uploading || isAutoFilling}
              style={{ display: 'none' }}
            />
            <label htmlFor="file-input" className="file-input-label">
              <div className="file-input-icon">🍌</div>
              <div className="file-input-text">
                {files.length > 0
                  ? `${files.length} file(s) selected`
                  : 'Click to select files or drag and drop'}
              </div>
            </label>
          </div>

          {files.length > 0 && (
            <div className="files-list">
              {files.map((file, index) => (
                <div key={index} className="file-item">
                  <span className="file-name">{file.name}</span>
                  <span className="file-size">{(file.size / 1024).toFixed(2)} KB</span>
                  {!uploading && !isAutoFilling && (
                    <button
                      className="remove-file-btn"
                      onClick={() => handleRemoveFile(index)}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Unstructured Data Fields */}
        {uploadType === 'unstructured' && (
          <div className="endpoint-fields">
            <div className="form-field">
              <label htmlFor="data-name">
                Data Collection Name
                {isAutoFilling && autoFillStatus.name && (
                  <span className="loading-indicator">⏳ Auto-filling...</span>
                )}
              </label>
              <input
                id="data-name"
                type="text"
                value={dataName}
                onChange={(e) => setDataName(e.target.value)}
                placeholder="e.g., Customer Support Tickets"
                disabled={uploading || isAutoFilling}
                className={autoFillStatus.name ? 'field-loading' : ''}
              />
            </div>
            <div className="form-field">
              <label htmlFor="data-description">
                Description
                {isAutoFilling && autoFillStatus.description && (
                  <span className="loading-indicator">⏳ Auto-filling...</span>
                )}
              </label>
              <textarea
                id="data-description"
                value={dataDescription}
                onChange={(e) => setDataDescription(e.target.value)}
                placeholder="Describe what this data contains..."
                disabled={uploading || isAutoFilling}
                rows={3}
                className={autoFillStatus.description ? 'field-loading' : ''}
              />
            </div>
            <div className="form-row">
              <div className="form-field">
                <label htmlFor="data-category">
                  Category
                  {isAutoFilling && autoFillStatus.category && (
                    <span className="loading-indicator">⏳ Auto-filling...</span>
                  )}
                </label>
                <input
                  id="data-category"
                  type="text"
                  value={dataCategory}
                  onChange={(e) => setDataCategory(e.target.value)}
                  placeholder="e.g., Customer Data"
                  disabled={uploading || isAutoFilling}
                  className={autoFillStatus.category ? 'field-loading' : ''}
                />
              </div>
              <div className="form-field">
                <label htmlFor="tags">
                  Tags
                  {isAutoFilling && autoFillStatus.tags && (
                    <span className="loading-indicator">⏳ Auto-filling...</span>
                  )}
                </label>
                <input
                  id="tags"
                  type="text"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="e.g., support, tickets, customer"
                  disabled={uploading || isAutoFilling}
                  className={autoFillStatus.tags ? 'field-loading' : ''}
                />
                <small className="field-hint">Separate tags with commas</small>
              </div>
            </div>
          </div>
        )}

        {/* Structured Endpoint Fields */}
        {uploadType === 'structured' && (
          <div className="endpoint-fields">
            <div className="form-field">
              <label htmlFor="endpoint-name">
                Endpoint Name *
                {isAutoFilling && autoFillStatus.name && (
                  <span className="loading-indicator">⏳ Auto-filling...</span>
                )}
              </label>
              <input
                id="endpoint-name"
                type="text"
                value={endpointName}
                onChange={(e) => setEndpointName(e.target.value)}
                placeholder="e.g., Customer Data API"
                disabled={uploading || isAutoFilling}
                required
                className={autoFillStatus.name ? 'field-loading' : ''}
              />
            </div>
            <div className="form-field">
              <label htmlFor="endpoint-description">
                Description
                {isAutoFilling && autoFillStatus.description && (
                  <span className="loading-indicator">⏳ Auto-filling...</span>
                )}
              </label>
              <textarea
                id="endpoint-description"
                value={endpointDescription}
                onChange={(e) => setEndpointDescription(e.target.value)}
                placeholder="Describe what data this endpoint provides..."
                disabled={uploading || isAutoFilling}
                rows={3}
                className={autoFillStatus.description ? 'field-loading' : ''}
              />
            </div>
            <div className="form-row">
              <div className="form-field">
                <label htmlFor="price-per-record">
                  Price per Record *
                  {isAutoFilling && autoFillStatus.price && (
                    <span className="loading-indicator">⏳ Auto-filling...</span>
                  )}
                </label>
                <input
                  id="price-per-record"
                  type="number"
                  step="0.000001"
                  min="0"
                  value={pricePerRecord}
                  onChange={(e) => setPricePerRecord(e.target.value)}
                  placeholder="0.001"
                  disabled={uploading || isAutoFilling}
                  required
                  className={autoFillStatus.price ? 'field-loading' : ''}
                />
              </div>
              <div className="form-field">
                <label htmlFor="category">
                  Category
                  {isAutoFilling && autoFillStatus.category && (
                    <span className="loading-indicator">⏳ Auto-filling...</span>
                  )}
                </label>
                <input
                  id="category"
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="e.g., Customer Data"
                  disabled={uploading || isAutoFilling}
                  className={autoFillStatus.category ? 'field-loading' : ''}
                />
              </div>
            </div>
          </div>
        )}

        {/* Terminal-style Notification Box */}
        {notifications.length > 0 && (
          <div className="notification-terminal">
            <div className="terminal-header">
              <div className="terminal-title">Processing Status</div>
              <button
                className="terminal-clear-btn"
                onClick={() => setNotifications([])}
              >
                Clear
              </button>
            </div>
            <div className="terminal-content">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`terminal-line ${notification.type}`}
                >
                  <span className="terminal-timestamp">
                    {notification.timestamp.toLocaleTimeString()}
                  </span>
                  <span className="terminal-message">{notification.message}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="upload-actions">
          <button
            className="btn-secondary"
            onClick={handleClose}
            disabled={uploading || isAutoFilling}
          >
            Cancel
          </button>
          <button
            className="btn-primary"
            onClick={handleUpload}
            disabled={uploading || isAutoFilling || files.length === 0 || (uploadType === 'structured' && !endpointName.trim())}
          >
            {uploading ? 'Uploading...' : 'Upload'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

export default UploadDataModal
