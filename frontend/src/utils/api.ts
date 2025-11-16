const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'

interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

class ApiClient {
  private getAuthToken(): string | null {
    const userStr = localStorage.getItem('user')
    if (userStr) {
      try {
        const user = JSON.parse(userStr)
        return user.token || null
      } catch {
        return null
      }
    }
    return null
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = this.getAuthToken()
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    })

    const data: ApiResponse<T> = await response.json()

    if (!response.ok || !data.success) {
      throw new Error(data.error || `HTTP error! status: ${response.status}`)
    }

    return data.data as T
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

  async getDatasetRecordsSold(datasetId: string) {
    return this.request(`/datasets/${datasetId}/records-sold`)
  }

  async getWarehouseStats() {
    return this.request('/producer/data/warehouse/stats')
  }

  async ensureWarehouseEndpoints() {
    return this.request('/producer/data/warehouse/ensure-endpoints', {
      method: 'POST',
    })
  }

  async getSellerStats() {
    return this.request('/datasets/stats')
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

  async suggestMetadata(formData: FormData, uploadType: 'structured' | 'unstructured' = 'structured') {
    const token = this.getAuthToken()
    const headers: Record<string, string> = {}
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    const response = await fetch(`${API_BASE_URL}/producer/files/suggest-metadata?type=${uploadType}`, {
      method: 'POST',
      headers,
      body: formData,
    })

    const data = await response.json()
    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Failed to suggest metadata')
    }
    return data
  }

  async uploadFiles(formData: FormData) {
    const token = this.getAuthToken()
    const headers: Record<string, string> = {}
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    try {
      const response = await fetch(`${API_BASE_URL}/producer/files/upload`, {
        method: 'POST',
        headers,
        body: formData,
      })

      if (!response.ok) {
        // Try to parse error response
        let errorMessage = `Upload failed with status ${response.status}`
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorMessage
        } catch {
          // If response is not JSON, use status text
          errorMessage = response.statusText || errorMessage
        }
        throw new Error(errorMessage)
      }

      const data = await response.json()
      if (!data.success) {
        throw new Error(data.error || 'Failed to upload files')
      }
      return data
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        throw new Error('Cannot connect to server. Please check if the backend is running.')
      }
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

    const response = await fetch(`${API_BASE_URL}/agents/generate-config`, {
      method: 'POST',
      headers,
      body: formData,
    })

    const data = await response.json()
    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Failed to generate agent config')
    }
    return data
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

