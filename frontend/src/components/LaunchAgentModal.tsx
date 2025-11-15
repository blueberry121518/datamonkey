import { useState, useRef, useEffect } from 'react'
import Modal from './Modal'
import { apiClient } from '../utils/api'
import './LaunchAgentModal.css'

interface LaunchAgentModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

interface Notification {
  id: string
  type: 'info' | 'success' | 'error' | 'warning'
  message: string
  timestamp: Date
}

function LaunchAgentModal({ isOpen, onClose, onSuccess }: LaunchAgentModalProps) {
  const [input, setInput] = useState('')
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    goal: '',
    category: '',
    quantity_required: '',
    budget: '',
    quality_threshold: '0.7',
    requiredFields: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isAutoFilling, setIsAutoFilling] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const addNotification = (type: Notification['type'], message: string) => {
    const notification: Notification = {
      id: Date.now().toString() + Math.random(),
      type,
      message,
      timestamp: new Date(),
    }
    setNotifications((prev) => [...prev, notification])
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setUploadedFile(file)
      addNotification('info', `File selected: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`)
    }
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0]
      setUploadedFile(file)
      addNotification('info', `File dropped: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`)
    }
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
  }

  const handleSend = async () => {
    if (!input.trim() && !uploadedFile) {
      return
    }

    const currentInput = input.trim()
    setInput('')
    setIsGenerating(true)
    addNotification('info', 'Generating agent configuration...')

    try {
      const response = await apiClient.generateAgentConfig(
        currentInput || `I need data similar to the uploaded file: ${uploadedFile?.name}`,
        uploadedFile || undefined
      )

      addNotification('success', 'Configuration generated successfully!')
      setIsAutoFilling(true)

      const config = response.data
      
      // Auto-fill form with animation
      await new Promise((resolve) => setTimeout(resolve, 300))
      if (config.name) setFormData(prev => ({ ...prev, name: config.name }))
      
      await new Promise((resolve) => setTimeout(resolve, 300))
      if (config.description) setFormData(prev => ({ ...prev, description: config.description }))
      
      await new Promise((resolve) => setTimeout(resolve, 300))
      if (config.goal) setFormData(prev => ({ ...prev, goal: config.goal }))
      
      await new Promise((resolve) => setTimeout(resolve, 300))
      if (config.requirements?.category) setFormData(prev => ({ ...prev, category: config.requirements.category }))
      
      await new Promise((resolve) => setTimeout(resolve, 300))
      if (config.requirements?.requiredFields?.length) {
        setFormData(prev => ({ ...prev, requiredFields: config.requirements.requiredFields.join(', ') }))
      }
      
      await new Promise((resolve) => setTimeout(resolve, 300))
      if (config.quantity_required) setFormData(prev => ({ ...prev, quantity_required: config.quantity_required.toString() }))
      
      await new Promise((resolve) => setTimeout(resolve, 300))
      if (config.budget) setFormData(prev => ({ ...prev, budget: config.budget.toString() }))
      
      await new Promise((resolve) => setTimeout(resolve, 300))
      if (config.quality_threshold) setFormData(prev => ({ ...prev, quality_threshold: config.quality_threshold.toString() }))

      setIsAutoFilling(false)
      addNotification('success', 'Fields auto-filled! Review and adjust as needed.')

      setUploadedFile(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate configuration'
      addNotification('error', `Error: ${errorMessage}`)
      setIsAutoFilling(false)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validation
    if (!formData.name.trim()) {
      setError('Agent name is required')
      addNotification('warning', 'Agent name is required')
      return
    }
    if (!formData.goal.trim()) {
      setError('Goal is required')
      addNotification('warning', 'Goal is required')
      return
    }
    if (!formData.budget || parseFloat(formData.budget) <= 0) {
      setError('Budget must be greater than 0')
      addNotification('warning', 'Budget must be greater than 0')
      return
    }
    if (formData.quality_threshold && (parseFloat(formData.quality_threshold) < 0 || parseFloat(formData.quality_threshold) > 1)) {
      setError('Quality threshold must be between 0 and 1')
      addNotification('warning', 'Quality threshold must be between 0 and 1')
      return
    }

    setLoading(true)
    addNotification('info', 'Launching agent...')

    try {
      const agentData: any = {
        name: formData.name.trim(),
        goal: formData.goal.trim(),
        budget: parseFloat(formData.budget),
      }

      if (formData.description.trim()) {
        agentData.description = formData.description.trim()
      }

      if (formData.category.trim() || formData.requiredFields.trim()) {
        agentData.requirements = {}
        if (formData.category.trim()) {
          agentData.requirements.category = formData.category.trim()
        }
        if (formData.requiredFields.trim()) {
          agentData.requirements.requiredFields = formData.requiredFields
            .split(',')
            .map(f => f.trim())
            .filter(f => f.length > 0)
        }
      }

      if (formData.quantity_required) {
        const quantity = parseInt(formData.quantity_required)
        if (quantity > 0) {
          agentData.quantity_required = quantity
        }
      }

      if (formData.quality_threshold) {
        agentData.quality_threshold = parseFloat(formData.quality_threshold)
      }

      await apiClient.createAgent(agentData)

      addNotification('success', 'Agent launched successfully!')

      // Reset everything
      resetForm()

      if (onSuccess) {
        onSuccess()
      }
      setTimeout(() => {
        onClose()
      }, 1500)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to launch agent'
      addNotification('error', `Error: ${errorMessage}`)
      setError(errorMessage)
      console.error('Failed to launch agent:', err)
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      goal: '',
      category: '',
      quantity_required: '',
      budget: '',
      quality_threshold: '0.7',
      requiredFields: '',
    })
    setInput('')
    setNotifications([])
    setUploadedFile(null)
    setError(null)
    setIsAutoFilling(false)
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Launch Agent">
      <div className="launch-agent-modal">
        {/* Command Input Section */}
        <div className="command-section">
          <div className="command-input-wrapper">
            <div
              className="file-upload-area"
              onDrop={handleDrop}
              onDragOver={handleDragOver}
            >
              <input
                ref={fileInputRef}
                type="file"
                id="file-upload"
                onChange={handleFileSelect}
                className="file-input"
                disabled={isGenerating || loading}
              />
              <label htmlFor="file-upload" className="file-upload-label">
                {uploadedFile ? (
                  <span className="file-selected">
                    📎 {uploadedFile.name}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault()
                        setUploadedFile(null)
                        if (fileInputRef.current) {
                          fileInputRef.current.value = ''
                        }
                      }}
                      className="file-remove"
                    >
                      ×
                    </button>
                  </span>
                ) : (
                  <span>📎</span>
                )}
              </label>
            </div>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleSend()
                }
              }}
              placeholder="Describe what data you need or upload an example file..."
              className="command-input"
              disabled={isGenerating || loading}
            />
            <button
              onClick={handleSend}
              disabled={(!input.trim() && !uploadedFile) || isGenerating || loading}
              className="send-button"
            >
              {isGenerating ? 'Generating...' : 'Generate'}
            </button>
          </div>
        </div>

        {/* Form Fields */}
        <div className="endpoint-fields">
          <div className="form-field">
            <label htmlFor="name">
              Agent Name <span className="required">*</span>
              {isAutoFilling && formData.name && (
                <span className="loading-indicator">⏳ Auto-filling...</span>
              )}
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="e.g., Customer Data Collector"
              required
              disabled={loading || isAutoFilling}
              className={isAutoFilling && formData.name ? 'field-loading' : ''}
            />
          </div>

          <div className="form-field">
            <label htmlFor="goal">
              Goal <span className="required">*</span>
              {isAutoFilling && formData.goal && (
                <span className="loading-indicator">⏳ Auto-filling...</span>
              )}
            </label>
            <textarea
              id="goal"
              name="goal"
              value={formData.goal}
              onChange={handleChange}
              placeholder="Describe what data this agent should acquire"
              rows={3}
              required
              disabled={loading || isAutoFilling}
              className={isAutoFilling && formData.goal ? 'field-loading' : ''}
            />
          </div>

          <div className="form-field">
            <label htmlFor="description">
              Description
              {isAutoFilling && formData.description && (
                <span className="loading-indicator">⏳ Auto-filling...</span>
              )}
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Optional: Additional details about this agent"
              rows={2}
              disabled={loading || isAutoFilling}
              className={isAutoFilling && formData.description ? 'field-loading' : ''}
            />
          </div>

          <div className="form-row">
            <div className="form-field">
              <label htmlFor="category">
                Type of Data / Category
                {isAutoFilling && formData.category && (
                  <span className="loading-indicator">⏳ Auto-filling...</span>
                )}
              </label>
              <input
                type="text"
                id="category"
                name="category"
                value={formData.category}
                onChange={handleChange}
                placeholder="e.g., emails, sales leads, customer data"
                disabled={loading || isAutoFilling}
                className={isAutoFilling && formData.category ? 'field-loading' : ''}
              />
            </div>

            <div className="form-field">
              <label htmlFor="quantity_required">
                Quantity Required
                {isAutoFilling && formData.quantity_required && (
                  <span className="loading-indicator">⏳ Auto-filling...</span>
                )}
              </label>
              <input
                type="number"
                id="quantity_required"
                name="quantity_required"
                value={formData.quantity_required}
                onChange={handleChange}
                placeholder="e.g., 10000"
                min="1"
                disabled={loading || isAutoFilling}
                className={isAutoFilling && formData.quantity_required ? 'field-loading' : ''}
              />
            </div>
          </div>

          <div className="form-field">
            <label htmlFor="requiredFields">
              Required Fields (comma-separated)
              {isAutoFilling && formData.requiredFields && (
                <span className="loading-indicator">⏳ Auto-filling...</span>
              )}
            </label>
            <input
              type="text"
              id="requiredFields"
              name="requiredFields"
              value={formData.requiredFields}
              onChange={handleChange}
              placeholder="e.g., email, name, phone"
              disabled={loading || isAutoFilling}
              className={isAutoFilling && formData.requiredFields ? 'field-loading' : ''}
            />
            <small className="field-hint">Separate fields with commas</small>
          </div>

          <div className="form-row">
            <div className="form-field">
              <label htmlFor="budget">
                Budget (USDC) <span className="required">*</span>
                {isAutoFilling && formData.budget && (
                  <span className="loading-indicator">⏳ Auto-filling...</span>
                )}
              </label>
              <input
                type="number"
                id="budget"
                name="budget"
                value={formData.budget}
                onChange={handleChange}
                placeholder="0.00"
                step="0.01"
                min="0"
                required
                disabled={loading || isAutoFilling}
                className={isAutoFilling && formData.budget ? 'field-loading' : ''}
              />
            </div>

            <div className="form-field">
              <label htmlFor="quality_threshold">
                Quality Threshold
                {isAutoFilling && formData.quality_threshold && (
                  <span className="loading-indicator">⏳ Auto-filling...</span>
                )}
              </label>
              <input
                type="number"
                id="quality_threshold"
                name="quality_threshold"
                value={formData.quality_threshold}
                onChange={handleChange}
                placeholder="0.7"
                step="0.1"
                min="0"
                max="1"
                disabled={loading || isAutoFilling}
                className={isAutoFilling && formData.quality_threshold ? 'field-loading' : ''}
              />
              <small className="field-hint">Minimum quality score (0.0 - 1.0, default: 0.7)</small>
            </div>
          </div>

          {error && (
            <div className="form-error">
              {error}
            </div>
          )}
        </div>

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
            disabled={loading || isAutoFilling}
          >
            Cancel
          </button>
          <button
            className="btn-primary"
            onClick={handleSubmit}
            disabled={loading || isAutoFilling || !formData.name.trim() || !formData.goal.trim()}
          >
            {loading ? 'Launching...' : 'Launch Agent'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

export default LaunchAgentModal
