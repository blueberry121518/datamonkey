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
  const [view, setView] = useState<'dashboard' | 'shop' | 'requests'>('dashboard')
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
      
      // Fetch real stats from API
      const statsResponse = await apiClient.getSellerStats() as any
      const statsData = statsResponse?.data || statsResponse

      setStats({
        totalSales: statsData.totalSales || 0,
        totalRevenue: statsData.totalRevenue || 0,
        activeEndpoints: statsData.activeEndpoints || 0,
        totalRecordsSold: statsData.totalRecordsSold || 0,
        recentSales: statsData.recentSales || [],
      })
    } catch (error) {
      // Set to zero on error
      setStats({
        totalSales: 0,
        totalRevenue: 0,
        activeEndpoints: 0,
        totalRecordsSold: 0,
        recentSales: [],
      })
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
          <button
            className={`nav-button ${view === 'requests' ? 'active' : ''}`}
            onClick={() => setView('requests')}
          >
            Requests
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

      {view === 'requests' && (
        <RequestsView />
      )}

      <UploadDataModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
      />
    </div>
  )
}

// Requests View Component - Shows what data buyers are requesting
function RequestsView() {
  // Mock data for data requests
  const mockRequests = [
    {
      id: 'req-1',
      requester: 'Buyer Agent #1',
      category: 'Biological Data',
      description: 'Looking for structured dataset of monkey species with complete records for species name, height, weight, and color',
      requiredFields: ['species', 'height_cm', 'weight_kg', 'color'],
      quantityRequired: 100,
      budget: 5.00,
      qualityThreshold: 0.9,
      status: 'active',
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
      matchedDatasets: 0
    },
    {
      id: 'req-2',
      requester: 'Data Collector Bot',
      category: 'Financial Services',
      description: 'Need wallet addresses, transaction hashes, and payment status data for blockchain analysis',
      requiredFields: ['wallet_address', 'transaction_hash', 'payment_status', 'amount', 'timestamp'],
      quantityRequired: 500,
      budget: 15.00,
      qualityThreshold: 0.85,
      status: 'active',
      createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(), // 5 hours ago
      matchedDatasets: 1
    },
    {
      id: 'req-3',
      requester: 'Market Research Agent',
      category: 'E-commerce',
      description: 'Requesting product listings with prices, categories, and availability status',
      requiredFields: ['product_name', 'price', 'category', 'availability'],
      quantityRequired: 250,
      budget: 8.50,
      qualityThreshold: 0.88,
      status: 'active',
      createdAt: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(), // 8 hours ago
      matchedDatasets: 2
    },
    {
      id: 'req-4',
      requester: 'Scientific Data Buyer',
      category: 'Biological Data',
      description: 'Seeking plant species database with taxonomy, habitat, and growth characteristics',
      requiredFields: ['species', 'genus', 'habitat', 'growth_rate'],
      quantityRequired: 1000,
      budget: 25.00,
      qualityThreshold: 0.92,
      status: 'active',
      createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(), // 12 hours ago
      matchedDatasets: 0
    },
    {
      id: 'req-5',
      requester: 'AI Training Corp',
      category: 'General',
      description: 'Looking for any structured datasets with at least 10 fields for machine learning training',
      requiredFields: [],
      quantityRequired: 2000,
      budget: 50.00,
      qualityThreshold: 0.75,
      status: 'active',
      createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 24 hours ago
      matchedDatasets: 3
    },
    {
      id: 'req-6',
      requester: 'Weather Data Collector',
      category: 'Environmental',
      description: 'Need historical weather data with temperature, humidity, precipitation, and wind speed',
      requiredFields: ['temperature', 'humidity', 'precipitation', 'wind_speed', 'date'],
      quantityRequired: 1500,
      budget: 30.00,
      qualityThreshold: 0.90,
      status: 'active',
      createdAt: new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString(), // 36 hours ago
      matchedDatasets: 0
    }
  ]

  return (
    <div className="requests-content">
      <div className="requests-header">
        <h2>Data Requests</h2>
        <p className="requests-description">
          See what data buyers are actively looking for. Upload matching datasets to fulfill these requests and generate revenue.
        </p>
      </div>

      {mockRequests.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🔍</div>
          <p>No active data requests at the moment. Check back later!</p>
        </div>
      ) : (
        <div className="requests-list">
          {mockRequests.map((request) => (
            <div key={request.id} className="request-card">
              <div className="request-header">
                <div className="request-title-row">
                  <div className="request-requester">{request.requester}</div>
                  <span className={`request-status-badge ${request.status}`}>
                    {request.status === 'active' ? '● Active' : '○ Inactive'}
                  </span>
                </div>
                <div className="request-category">{request.category}</div>
              </div>

              <div className="request-description-text">
                {request.description}
              </div>

              {request.requiredFields.length > 0 && (
                <div className="request-fields">
                  <div className="request-fields-label">Required Fields:</div>
                  <div className="request-fields-list">
                    {request.requiredFields.map((field, idx) => (
                      <span key={idx} className="field-tag">
                        {field}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="request-stats">
                <div className="request-stat">
                  <span className="request-stat-label">Quantity</span>
                  <span className="request-stat-value">{request.quantityRequired.toLocaleString()} records</span>
                </div>
                <div className="request-stat">
                  <span className="request-stat-label">Budget</span>
                  <span className="request-stat-value">${request.budget.toFixed(2)}</span>
                </div>
                <div className="request-stat">
                  <span className="request-stat-label">Quality Threshold</span>
                  <span className="request-stat-value">{(request.qualityThreshold * 100).toFixed(0)}%</span>
                </div>
                <div className="request-stat">
                  <span className="request-stat-label">Matched Datasets</span>
                  <span className="request-stat-value">{request.matchedDatasets}</span>
                </div>
              </div>

              <div className="request-footer">
                <span className="request-time">
                  Posted {new Date(request.createdAt).toLocaleString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Shop View Component
function ShopView() {
  const [datasets, setDatasets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDataset, setSelectedDataset] = useState<any | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [recordsSoldMap, setRecordsSoldMap] = useState<Record<string, number>>({})

  useEffect(() => {
    // Ensure all endpoints are started up when Shop loads
    const ensureEndpoints = async () => {
      try {
        await apiClient.ensureWarehouseEndpoints()
        // Wait a bit for backend to process, then fetch datasets
        setTimeout(() => {
          fetchDatasets()
        }, 500)
      } catch (error) {
        console.error('Error ensuring endpoints:', error)
        // Still fetch datasets even if ensure fails
        fetchDatasets()
      }
    }
    
    ensureEndpoints()
  }, [])

  const fetchDatasets = async () => {
    try {
      setLoading(true)
      const response = await apiClient.getMyDatasets() as any
      console.log('[ShopView] Raw API response:', response)
      const data = response?.data || (Array.isArray(response) ? response : [])
      const finalDatasets = Array.isArray(data) ? data : []
      console.log('[ShopView] Final datasets:', finalDatasets.length, finalDatasets.map((d: any) => ({ id: d.id, name: d.name })))
      setDatasets(finalDatasets)

      // Fetch records sold for each dataset
      const soldMap: Record<string, number> = {}
      await Promise.all(
        finalDatasets.map(async (dataset: any) => {
          try {
            const soldResponse = await apiClient.getDatasetRecordsSold(dataset.id) as any
            const soldData = soldResponse?.data || soldResponse
            soldMap[dataset.id] = soldData.recordsSold || 0
          } catch (error) {
            soldMap[dataset.id] = 0
          }
        })
      )
      setRecordsSoldMap(soldMap)
    } catch (error) {
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
                    <span className="stat-label">Records Sold</span>
                    <span className="stat-value">
                      {recordsSoldMap[dataset.id]?.toLocaleString() || '0'}
                    </span>
                  </div>
                  <div className="endpoint-stat">
                    <span className="stat-label">Price</span>
                    <span className="stat-value">
                      {dataset.name === 'General Warehouse Data' 
                        ? 'Variable'
                        : `$${dataset.price_per_record?.toFixed(6) || '0.000000'}/record`
                      }
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

