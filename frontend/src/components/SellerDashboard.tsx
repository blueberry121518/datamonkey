import { useState, useEffect } from 'react'
import './SellerDashboard.css'
import UploadDataModal from './UploadDataModal'
import EndpointDataModal from './EndpointDataModal'
import { apiClient } from '../utils/api'

interface SalesStats {
  totalSales: number
  totalRevenue: number
  activeEndpoints: number
  totalRecordsSold: number
  recentSales: Array<{
    id: string
    endpoint: string
    records: number
    revenue: number
    timestamp: string
  }>
}

function SellerDashboard() {
  const [view, setView] = useState<'dashboard' | 'shop'>('dashboard')
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const [stats, setStats] = useState<SalesStats>({
    totalSales: 0,
    totalRevenue: 0,
    activeEndpoints: 0,
    totalRecordsSold: 0,
    recentSales: [],
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    try {
      setLoading(true)
      // TODO: Replace with actual sales API endpoint when available
      // For now, we'll get datasets and calculate basic stats
      const datasets = await apiClient.getMyDatasets()
      const activeDatasets = Array.isArray(datasets) 
        ? datasets.filter((d: any) => d.is_active) 
        : []
      
      // Mock stats for now - replace with real sales data
      setStats({
        totalSales: 42, // Mock
        totalRevenue: 125.50, // Mock
        activeEndpoints: activeDatasets.length,
        totalRecordsSold: 1250, // Mock
        recentSales: [], // Mock - will be populated from real API
      })
    } catch (error) {
      console.error('Failed to fetch stats:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="producer-dashboard">
      <div className="dashboard-nav">
        <div className="nav-tabs">
          <button
            className={`nav-button ${view === 'dashboard' ? 'active' : ''}`}
            onClick={() => setView('dashboard')}
          >
            Dashboard
          </button>
          <button
            className={`nav-button ${view === 'shop' ? 'active' : ''}`}
            onClick={() => setView('shop')}
          >
            Shop
          </button>
        </div>
        <button
          className="btn-primary upload-btn"
          onClick={() => setIsUploadModalOpen(true)}
        >
          🍌 Upload Data
        </button>
      </div>

      {view === 'dashboard' && (
        <div className="dashboard-content">
          {loading ? (
            <div className="loading-state">Loading statistics...</div>
          ) : (
            <>
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-icon">🍌</div>
                  <div className="stat-content">
                    <div className="stat-value">${stats.totalRevenue.toFixed(2)}</div>
                    <div className="stat-label">Total Revenue</div>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon">🐵</div>
                  <div className="stat-content">
                    <div className="stat-value">{stats.totalSales}</div>
                    <div className="stat-label">Total Sales</div>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon">🌿</div>
                  <div className="stat-content">
                    <div className="stat-value">{stats.activeEndpoints}</div>
                    <div className="stat-label">Active Endpoints</div>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon">🌴</div>
                  <div className="stat-content">
                    <div className="stat-value">{stats.totalRecordsSold.toLocaleString()}</div>
                    <div className="stat-label">Records Sold</div>
                  </div>
                </div>
              </div>

              <div className="recent-sales-section">
                <h2>Recent Sales</h2>
                {stats.recentSales.length > 0 ? (
                  <div className="sales-list">
                    {stats.recentSales.map((sale) => (
                      <div key={sale.id} className="sale-item">
                        <div className="sale-info">
                          <div className="sale-endpoint">{sale.endpoint}</div>
                          <div className="sale-details">
                            {sale.records} records • ${sale.revenue.toFixed(2)}
                          </div>
                        </div>
                        <div className="sale-time">
                          {new Date(sale.timestamp).toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">
                    <p>No sales yet. Start uploading data to create endpoints!</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {view === 'shop' && (
        <ShopView />
      )}

      <UploadDataModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
      />
    </div>
  )
}

// Shop View Component
function ShopView() {
  const [datasets, setDatasets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDataset, setSelectedDataset] = useState<any | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  useEffect(() => {
    const ensureEndpoints = async () => {
      try {
        const warehouseStats = await apiClient.getWarehouseStats() as any
        const stats = warehouseStats?.data || warehouseStats
        
        console.log('[ShopView] Warehouse stats - recordCount:', stats?.recordCount)
        console.log('[ShopView] Calling ensureWarehouseEndpoints...')
        
        const apiResult = await apiClient.ensureWarehouseEndpoints() as any
        console.log('[ShopView] ensureWarehouseEndpoints response:', apiResult)
        
        await new Promise(resolve => setTimeout(resolve, 2000))
        await fetchDatasets()
      } catch (error) {
        console.error('[ShopView] Error ensuring endpoints:', error)
        await fetchDatasets()
      }
    }

    ensureEndpoints()
  }, [])

  const fetchDatasets = async () => {
    try {
      setLoading(true)
      const response = await apiClient.getMyDatasets() as any
      const data = response?.data || (Array.isArray(response) ? response : [])
      const finalDatasets = Array.isArray(data) ? data : []
      console.log('[ShopView] Fetched datasets:', finalDatasets.length)
      setDatasets(finalDatasets)
    } catch (error) {
      console.error('[ShopView] Failed to fetch datasets:', error)
      setDatasets([])
    } finally {
      setLoading(false)
    }
  }


  const handleCardClick = (dataset: any) => {
    setSelectedDataset(dataset)
    setModalOpen(true)
  }

  if (loading) {
    return (
      <div className="shop-content">
        <div className="loading-state">Loading endpoints...</div>
      </div>
    )
  }
  
  return (
    <div className="shop-content">
      {datasets.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🌴</div>
          <p>No endpoints yet. Upload data to automatically create endpoints!</p>
        </div>
      ) : (
        <div className="endpoints-list">
          {datasets.map((dataset) => (
            <div
              key={dataset.id}
              className="endpoint-card"
              onClick={() => handleCardClick(dataset)}
            >
              <div className="endpoint-header">
                <div className="endpoint-info">
                  <div className="endpoint-name-row">
                    <div className="endpoint-name">{dataset.name}</div>
                    <span
                      className={`status-badge-inline ${dataset.is_active ? 'active' : 'inactive'}`}
                    >
                      {dataset.is_active ? '● Active' : '○ Inactive'}
                    </span>
                  </div>
                  <div className="endpoint-path">{dataset.endpoint_path}</div>
                </div>
                <div className="endpoint-stats">
                  <div className="endpoint-stat">
                    <span className="stat-label">Records</span>
                    <span className="stat-value">
                      {dataset.total_rows?.toLocaleString() || 'N/A'}
                    </span>
                  </div>
                  <div className="endpoint-stat">
                    <span className="stat-label">Quality</span>
                    <span className="stat-value">
                      {dataset.quality_score
                        ? `${(dataset.quality_score * 100).toFixed(0)}%`
                        : 'N/A'}
                    </span>
                  </div>
                  <div className="endpoint-stat">
                    <span className="stat-label">Price</span>
                    <span className="stat-value">
                      ${dataset.price_per_record?.toFixed(6) || '0.000000'}/record
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedDataset && (
        <EndpointDataModal
          isOpen={modalOpen}
          onClose={() => {
            setModalOpen(false)
            setSelectedDataset(null)
          }}
          dataset={selectedDataset}
        />
      )}
    </div>
  )
}

export default SellerDashboard

