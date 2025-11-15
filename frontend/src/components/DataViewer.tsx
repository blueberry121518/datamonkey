import { useState, useEffect } from 'react'
import { apiClient } from '../utils/api'
import './DataViewer.css'

function DataViewer() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [limit] = useState(50)

  useEffect(() => {
    fetchData()
  }, [page])

  const fetchData = async () => {
    try {
      setLoading(true)
      const response = await apiClient.viewAllData()
      if (response.success) {
        setData(response.data)
      }
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchRecords = async () => {
    try {
      const response = await apiClient.getDataRecords(page * limit, limit)
      return response.data.records || []
    } catch (error) {
      console.error('Failed to fetch records:', error)
      return []
    }
  }

  if (loading) {
    return (
      <div className="data-viewer">
        <div className="loading-state">Loading data...</div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="data-viewer">
        <div className="empty-state">No data available</div>
      </div>
    )
  }

  const { files, stats } = data

  return (
    <div className="data-viewer">
      <div className="data-viewer-header">
        <h3>All Your Data</h3>
        <button className="btn-secondary" onClick={fetchData}>
          Refresh
        </button>
      </div>

      <div className="data-stats-grid">
        <div className="stat-box">
          <div className="stat-value">{stats.total_files}</div>
          <div className="stat-label">Total Files</div>
        </div>
        <div className="stat-box">
          <div className="stat-value">{stats.total_records.toLocaleString()}</div>
          <div className="stat-label">Total Records</div>
        </div>
        <div className="stat-box">
          <div className="stat-value">
            {Object.keys(stats.by_category).length}
          </div>
          <div className="stat-label">Categories</div>
        </div>
        <div className="stat-box">
          <div className="stat-value">
            {stats.parsing_status.completed}
          </div>
          <div className="stat-label">Parsed</div>
        </div>
      </div>

      <div className="data-stats-details">
        <div className="stats-section">
          <h4>By Category</h4>
          <div className="stats-list">
            {Object.entries(stats.by_category).map(([category, count]) => (
              <div key={category} className="stat-item">
                <span className="stat-item-label">{category}</span>
                <span className="stat-item-value">{count as number}</span>
              </div>
            ))}
            {Object.keys(stats.by_category).length === 0 && (
              <div className="empty-stat">No categories yet</div>
            )}
          </div>
        </div>

        <div className="stats-section">
          <h4>By File Type</h4>
          <div className="stats-list">
            {Object.entries(stats.by_file_type).map(([type, count]) => (
              <div key={type} className="stat-item">
                <span className="stat-item-label">{type}</span>
                <span className="stat-item-value">{count as number}</span>
              </div>
            ))}
            {Object.keys(stats.by_file_type).length === 0 && (
              <div className="empty-stat">No files yet</div>
            )}
          </div>
        </div>

        <div className="stats-section">
          <h4>Parsing Status</h4>
          <div className="stats-list">
            <div className="stat-item">
              <span className="stat-item-label">Completed</span>
              <span className="stat-item-value success">
                {stats.parsing_status.completed}
              </span>
            </div>
            <div className="stat-item">
              <span className="stat-item-label">Parsing</span>
              <span className="stat-item-value warning">
                {stats.parsing_status.parsing}
              </span>
            </div>
            <div className="stat-item">
              <span className="stat-item-label">Failed</span>
              <span className="stat-item-value error">
                {stats.parsing_status.failed}
              </span>
            </div>
            <div className="stat-item">
              <span className="stat-item-label">Pending</span>
              <span className="stat-item-value">
                {stats.parsing_status.pending}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="files-list">
        <h4>Uploaded Files</h4>
        <div className="files-grid">
          {files.map((file: any) => (
            <div key={file.id} className="file-card">
              <div className="file-card-header">
                <span className="file-type-badge">{file.file_type}</span>
                <span
                  className={`parsing-status ${file.parsing_status}`}
                >
                  {file.parsing_status}
                </span>
              </div>
              <div className="file-name">{file.original_filename}</div>
              {file.category && (
                <div className="file-category">{file.category}</div>
              )}
              <div className="file-meta">
                <span>{(file.file_size / 1024).toFixed(2)} KB</span>
                {file.metadata?.recordCount && (
                  <span>{file.metadata.recordCount} records</span>
                )}
              </div>
            </div>
          ))}
          {files.length === 0 && (
            <div className="empty-state">No files uploaded yet</div>
          )}
        </div>
      </div>
    </div>
  )
}

export default DataViewer

