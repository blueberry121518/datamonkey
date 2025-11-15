import { useState } from 'react'
import Modal from './Modal'
import { apiClient } from '../utils/api'
import './FileUploadModal.css'

interface FileUploadModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

function FileUploadModal({ isOpen, onClose, onSuccess }: FileUploadModalProps) {
  const [files, setFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState<Record<string, number>>({})
  const [results, setResults] = useState<any[]>([])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files))
    }
  }

  const handleUpload = async () => {
    if (files.length === 0) return

    setUploading(true)
    setResults([])

    try {
      const formData = new FormData()
      files.forEach((file) => {
        formData.append('files', file)
      })

      const response = await apiClient.uploadFiles(formData)
      
      if (response.success) {
        setResults(response.data.results || [])
        onSuccess()
        // Clear files after successful upload
        setTimeout(() => {
          setFiles([])
          setResults([])
        }, 3000)
      }
    } catch (error) {
      console.error('Upload failed:', error)
      alert('Upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  const handleRemoveFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index))
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Upload Unstructured Data">
      <div className="file-upload-modal">
        <div className="upload-section">
          <label className="file-input-label">
            <input
              type="file"
              multiple
              onChange={handleFileSelect}
              className="file-input"
              accept="image/*,application/json,text/*,application/pdf"
            />
            <div className="file-input-display">
              <div className="file-input-icon">📁</div>
              <div>
                <div className="file-input-text">Select files to upload</div>
                <div className="file-input-hint">
                  Supports images, JSON, text, PDF, and more
                </div>
              </div>
            </div>
          </label>

          {files.length > 0 && (
            <div className="file-list">
              <h4>Selected Files ({files.length})</h4>
              {files.map((file, index) => (
                <div key={index} className="file-item">
                  <span className="file-name">{file.name}</span>
                  <span className="file-size">
                    {(file.size / 1024).toFixed(2)} KB
                  </span>
                  <button
                    className="file-remove"
                    onClick={() => handleRemoveFile(index)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="upload-actions">
            <button
              className="btn-secondary"
              onClick={onClose}
              disabled={uploading}
            >
              Cancel
            </button>
            <button
              className="btn-primary"
              onClick={handleUpload}
              disabled={uploading || files.length === 0}
            >
              {uploading ? 'Uploading...' : `Upload ${files.length} File(s)`}
            </button>
          </div>
        </div>

        {results.length > 0 && (
          <div className="upload-results">
            <h4>Upload Results</h4>
            {results.map((result, index) => (
              <div
                key={index}
                className={`result-item ${result.status === 'completed' ? 'success' : 'error'}`}
              >
                <div className="result-header">
                  <span className="result-filename">{result.filename}</span>
                  <span className={`result-status ${result.status}`}>
                    {result.status}
                  </span>
                </div>
                {result.status === 'completed' && (
                  <div className="result-details">
                    <span>Type: {result.file_type}</span>
                    <span>Records: {result.records_created}</span>
                    {result.category && <span>Category: {result.category}</span>}
                  </div>
                )}
                {result.error && (
                  <div className="result-error">Error: {result.error}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  )
}

export default FileUploadModal

