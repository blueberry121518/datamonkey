import logger from './logger.js'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'

interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

class ApiClient {
  private getAuthToken(): string | null {
    // Try to get token from user object first
    const userStr = localStorage.getItem('user')
    if (userStr) {
      try {
        const user = JSON.parse(userStr)
        if (user.token) {
          return user.token
        }
      } catch {
        // Invalid JSON, continue to check separate token
      }
    }
    
    // Fallback: check for separate token storage (for backwards compatibility)
    return localStorage.getItem('token')
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const startTime = Date.now()
    const token = this.getAuthToken()
    const method = options.method || 'GET'
    const url = `${API_BASE_URL}${endpoint}`
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    logger.apiRequest(method, endpoint, options.body ? JSON.parse(options.body as string) : undefined)

    try {
      console.log(`[API] ${method} ${endpoint} - Starting request...`)
      console.log(`[API] URL: ${url}`)
      console.log(`[API] Has token: ${!!token}`)
      
      const response = await fetch(url, {
        ...options,
        headers,
      })

      const duration = Date.now() - startTime
      console.log(`[API] ${method} ${endpoint} - Response status: ${response.status}`)
      console.log(`[API] ${method} ${endpoint} - Response ok: ${response.ok}`)
      
      const rawData = await response.json()
      console.log(`[API] ${method} ${endpoint} - Raw response data:`, rawData)
      
      const data: ApiResponse<T> = rawData

      logger.apiResponse(method, endpoint, response.status, duration)

      if (!response.ok || !data.success) {
        console.error(`[API] ${method} ${endpoint} - Error response:`, data)
        logger.error(`API ${method} ${endpoint} failed: ${data.error || response.status}`)
        throw new Error(data.error || `HTTP error! status: ${response.status}`)
      }

      console.log(`[API] ${method} ${endpoint} - Extracted data:`, data.data)
      console.log(`[API] ${method} ${endpoint} - Data type:`, typeof data.data)
      console.log(`[API] ${method} ${endpoint} - Is array:`, Array.isArray(data.data))
      
      return data.data as T
    } catch (error) {
      const duration = Date.now() - startTime
      console.error(`[API] ${method} ${endpoint} - Request failed:`, error)
      logger.error(`API ${method} ${endpoint} error (${duration}ms): ${error instanceof Error ? error.message : 'Unknown error'}`)
      throw error
    }
  }

  // Dataset endpoints
  async createDataset(datasetData: any) {
    return this.request('/datasets', {
      method: 'POST',
      body: JSON.stringify(datasetData),
    })
  }

  async getMyDatasets() {
    return this.request('/datasets/my')
  }

  async getDatasetInteractions(datasetId: string, limit: number = 100) {
    return this.request(`/datasets/${datasetId}/interactions?limit=${limit}`)
  }

  async getDatasetSample(datasetId: string, size: number = 10) {
    return this.request(`/datasets/${datasetId}/sample?size=${size}`)
  }

  async getWarehouseStats() {
    return this.request('/producer/data/warehouse/stats')
  }

  async ensureWarehouseEndpoints() {
    return this.request('/producer/data/warehouse/ensure-endpoints', {
      method: 'POST',
    })
  }

  async createEndpointFromWarehouse(data: {
    name?: string
    description?: string
    category?: string
    price_per_record?: number
  }) {
    return this.request('/producer/data/warehouse/create-endpoint', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  // File upload endpoints
  async suggestMetadata(formData: FormData, uploadType: 'structured' | 'unstructured' = 'structured') {
    const startTime = Date.now()
    const token = this.getAuthToken()
    const headers: Record<string, string> = {}

    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    try {
      const url = `${API_BASE_URL}/producer/files/suggest-metadata?type=${uploadType}`
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: formData,
      })

      const duration = Date.now() - startTime
      const data = await response.json()

      if (!response.ok) {
        logger.error(`API POST /producer/files/suggest-metadata error (${duration}ms): ${data.error || 'Unknown error'}`)
        throw new Error(data.error || 'Failed to suggest metadata')
      }

      logger.info(`API POST /producer/files/suggest-metadata success (${duration}ms)`)
      return data
    } catch (error) {
      const duration = Date.now() - startTime
      logger.error(`API POST /producer/files/suggest-metadata error (${duration}ms): ${error instanceof Error ? error.message : 'Unknown error'}`)
      throw error
    }
  }

  async uploadFiles(formData: FormData) {
    const startTime = Date.now()
    const token = this.getAuthToken()
    const headers: Record<string, string> = {}
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    const fileCount = formData.getAll('files').length
    logger.apiRequest('POST', '/producer/files/upload', { fileCount })

    try {
      const response = await fetch(`${API_BASE_URL}/producer/files/upload`, {
        method: 'POST',
        headers,
        body: formData,
      })

      const duration = Date.now() - startTime
      
      // Check if response is JSON
      const contentType = response.headers.get('content-type')
      let data: ApiResponse<any>
      
      if (contentType && contentType.includes('application/json')) {
        data = await response.json()
      } else {
        // If not JSON, read as text for error messages
        const text = await response.text()
        logger.error(`File upload failed: Non-JSON response: ${text}`)
        throw new Error(`Server error: ${response.status} ${response.statusText} - ${text}`)
      }
      
      logger.apiResponse('POST', '/seller/files/upload', response.status, duration)

      if (!response.ok || !data.success) {
        logger.error(`File upload failed: ${data.error || response.status}`)
        throw new Error(data.error || `HTTP error! status: ${response.status}`)
      }

      return data
    } catch (error) {
      const duration = Date.now() - startTime
      logger.error(`File upload error (${duration}ms): ${error instanceof Error ? error.message : 'Unknown error'}`)
      throw error
    }
  }


  // Agent endpoints
  async getMyAgents() {
    return this.request('/agents')
  }

  async getAgent(agentId: string) {
    return this.request(`/agents/${agentId}`)
  }

  async getAgentBalance(agentId: string) {
    return this.request(`/agents/${agentId}/balance`)
  }

  async deleteAgent(agentId: string) {
    return this.request(`/agents/${agentId}`, {
      method: 'DELETE',
    })
  }

  async createAgent(agentData: any) {
    return this.request('/agents', {
      method: 'POST',
      body: JSON.stringify(agentData),
    })
  }

  async generateAgentConfig(description: string, file?: File) {
    const startTime = Date.now()
    const token = this.getAuthToken()
    const formData = new FormData()
    
    formData.append('description', description)
    if (file) {
      formData.append('file', file)
    }

    const headers: Record<string, string> = {}
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    try {
      const url = `${API_BASE_URL}/agents/generate-config`
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: formData,
      })

      const duration = Date.now() - startTime
      const data = await response.json()

      if (!response.ok) {
        logger.error(`API POST /agents/generate-config error (${duration}ms): ${data.error || 'Unknown error'}`)
        throw new Error(data.error || 'Failed to generate agent config')
      }

      logger.info(`API POST /agents/generate-config success (${duration}ms)`)
      return data
    } catch (error) {
      const duration = Date.now() - startTime
      logger.error(`API POST /agents/generate-config error (${duration}ms): ${error instanceof Error ? error.message : 'Unknown error'}`)
      throw error
    }
  }

  // Agent action endpoints
  async getAgentActions(agentId: string, limit?: number) {
    const params = limit ? `?limit=${limit}` : ''
    return this.request(`/agent-actions/agent/${agentId}${params}`)
  }

  async getRecentAgentActions(agentId: string, since?: string) {
    const params = since ? `?since=${since}` : ''
    return this.request(`/agent-actions/agent/${agentId}/recent${params}`)
  }
}

export const apiClient = new ApiClient()

