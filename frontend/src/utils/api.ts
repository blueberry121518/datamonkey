const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'

interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

class ApiClient {
  private getAuthToken(): string | null {
    const userStr = localStorage.getItem('user')
    if (!userStr) return null
    
    try {
      const user = JSON.parse(userStr)
      return user.token || null
    } catch {
      return null
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = this.getAuthToken()
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
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

  async getDataset(id: string) {
    return this.request(`/datasets/${id}`)
  }

  async updateDataset(id: string, updates: any) {
    return this.request(`/datasets/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    })
  }

  async deleteDataset(id: string) {
    return this.request(`/datasets/${id}`, {
      method: 'DELETE',
    })
  }

  async getActiveDatasets(filters?: {
    category?: string
    search?: string
    limit?: number
    offset?: number
  }) {
    const params = new URLSearchParams()
    if (filters?.category) params.append('category', filters.category)
    if (filters?.search) params.append('search', filters.search)
    if (filters?.limit) params.append('limit', filters.limit.toString())
    if (filters?.offset) params.append('offset', filters.offset.toString())

    const query = params.toString()
    return this.request(`/datasets${query ? `?${query}` : ''}`)
  }

  // File upload endpoints
  async uploadFiles(formData: FormData) {
    const token = this.getAuthToken()
    const headers: HeadersInit = {}
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    const response = await fetch(`${API_BASE_URL}/seller/files/upload`, {
      method: 'POST',
      headers,
      body: formData,
    })

    const data: ApiResponse<any> = await response.json()
    if (!response.ok || !data.success) {
      throw new Error(data.error || `HTTP error! status: ${response.status}`)
    }

    return data
  }

  async viewAllData() {
    return this.request('/seller/files/view')
  }

  async getDataRecords(offset: number, limit: number) {
    return this.request(`/seller/files/records?offset=${offset}&limit=${limit}`)
  }

  // Agent endpoints
  async getMyAgents() {
    return this.request('/agents')
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

