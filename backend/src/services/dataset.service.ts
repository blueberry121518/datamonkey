import { supabase } from '../config/supabase.js'
import { DatasetListing, CreateDatasetRequest, UpdateDatasetRequest } from '../types/dataset.js'

export class DatasetService {
  /**
   * Generate unique endpoint path for a dataset
   */
  private generateEndpointPath(sellerId: string, name: string): string {
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
    const randomId = Math.random().toString(36).substring(2, 8)
    return `/api/datasets/${slug}-${randomId}`
  }

  /**
   * Auto-detect metadata from data sample
   * This is a simplified version - can be enhanced with actual file parsing
   */
  private autoDetectMetadata(data: any): {
    schema?: Record<string, any>
    total_rows?: number
    content_summary?: string
    quality_score?: number
  } {
    const result: {
      schema?: Record<string, any>
      total_rows?: number
      content_summary?: string
      quality_score?: number
    } = {}

    if (Array.isArray(data) && data.length > 0) {
      result.total_rows = data.length

      // Generate JSON Schema from first record
      const firstRecord = data[0]
      if (typeof firstRecord === 'object' && firstRecord !== null) {
        const properties: Record<string, any> = {}
        const required: string[] = []

        Object.keys(firstRecord).forEach((key) => {
          const value = firstRecord[key]
          let type = 'string'

          if (typeof value === 'number') {
            type = Number.isInteger(value) ? 'integer' : 'number'
          } else if (typeof value === 'boolean') {
            type = 'boolean'
          } else if (Array.isArray(value)) {
            type = 'array'
          } else if (value === null || value === undefined) {
            // Optional field
          } else {
            type = 'string'
          }

          properties[key] = { type }
          if (value !== null && value !== undefined) {
            required.push(key)
          }
        })

        result.schema = {
          type: 'array',
          items: {
            type: 'object',
            properties,
            required,
          },
        }

        // Generate content summary
        result.content_summary = `Dataset with ${data.length} records containing ${Object.keys(firstRecord).length} fields: ${Object.keys(firstRecord).join(', ')}`

        // Calculate basic quality score
        let nonNullCount = 0
        let totalFields = 0

        data.forEach((record: any) => {
          Object.keys(firstRecord).forEach((key) => {
            totalFields++
            if (record[key] !== null && record[key] !== undefined && record[key] !== '') {
              nonNullCount++
            }
          })
        })

        result.quality_score = totalFields > 0 ? nonNullCount / totalFields : 0.5
      }
    }

    return result
  }

  /**
   * Create a new dataset listing
   */
  async createDataset(
    sellerId: string,
    data: CreateDatasetRequest
  ): Promise<DatasetListing> {
    const endpointPath = this.generateEndpointPath(sellerId, data.name)

    // Auto-detect metadata if sample data is provided
    let autoDetected = {}
    if (data.metadata?.sampleData) {
      autoDetected = this.autoDetectMetadata(data.metadata.sampleData)
      // Remove sampleData from metadata (don't store it)
      delete data.metadata.sampleData
    }

    // Merge auto-detected with manual metadata
    const finalMetadata = {
      ...data.metadata,
      ...(autoDetected.metadata || {}),
    }

    const datasetData = {
      seller_id: sellerId,
      name: data.name,
      description: data.description || null,
      category: data.category || null,
      endpoint_path: endpointPath,
      type: data.type || 'api',
      price_per_record: data.price_per_record || 0.001,
      metadata: finalMetadata,
      schema: data.schema || autoDetected.schema || null,
      total_rows: data.total_rows || autoDetected.total_rows || null,
      quality_score: data.quality_score || autoDetected.quality_score || null,
      content_summary: data.content_summary || autoDetected.content_summary || null,
      probe_endpoint: `${endpointPath}/probe`,
      is_active: true,
    }

    const { data: newDataset, error } = await supabase
      .from('dataset_listings')
      .insert(datasetData)
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to create dataset: ${error.message}`)
    }

    return newDataset as DatasetListing
  }

  /**
   * Get all datasets for a seller
   */
  async getSellerDatasets(sellerId: string): Promise<DatasetListing[]> {
    const { data, error } = await supabase
      .from('dataset_listings')
      .select('*')
      .eq('seller_id', sellerId)
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(`Failed to fetch datasets: ${error.message}`)
    }

    return (data || []) as DatasetListing[]
  }

  /**
   * Get a single dataset by ID
   */
  async getDatasetById(datasetId: string, sellerId?: string): Promise<DatasetListing> {
    let query = supabase.from('dataset_listings').select('*').eq('id', datasetId)

    // If sellerId provided, ensure the dataset belongs to the seller
    if (sellerId) {
      query = query.eq('seller_id', sellerId)
    }

    const { data, error } = await query.single()

    if (error) {
      throw new Error(`Failed to fetch dataset: ${error.message}`)
    }

    if (!data) {
      throw new Error('Dataset not found')
    }

    return data as DatasetListing
  }

  /**
   * Update a dataset listing
   */
  async updateDataset(
    datasetId: string,
    sellerId: string,
    updates: UpdateDatasetRequest
  ): Promise<DatasetListing> {
    // Verify ownership
    await this.getDatasetById(datasetId, sellerId)

    const { data, error } = await supabase
      .from('dataset_listings')
      .update(updates)
      .eq('id', datasetId)
      .eq('seller_id', sellerId)
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to update dataset: ${error.message}`)
    }

    return data as DatasetListing
  }

  /**
   * Delete a dataset listing
   */
  async deleteDataset(datasetId: string, sellerId: string): Promise<void> {
    // Verify ownership
    await this.getDatasetById(datasetId, sellerId)

    const { error } = await supabase
      .from('dataset_listings')
      .delete()
      .eq('id', datasetId)
      .eq('seller_id', sellerId)

    if (error) {
      throw new Error(`Failed to delete dataset: ${error.message}`)
    }
  }

  /**
   * Get all active datasets (for marketplace discovery)
   */
  async getActiveDatasets(filters?: {
    category?: string
    search?: string
    limit?: number
    offset?: number
  }): Promise<{ datasets: DatasetListing[]; total: number }> {
    let query = supabase
      .from('dataset_listings')
      .select('*', { count: 'exact' })
      .eq('is_active', true)

    if (filters?.category) {
      query = query.eq('category', filters.category)
    }

    if (filters?.search) {
      query = query.or(
        `name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`
      )
    }

    query = query.order('created_at', { ascending: false })

    if (filters?.limit) {
      query = query.limit(filters.limit)
    }

    if (filters?.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1)
    }

    const { data, error, count } = await query

    if (error) {
      throw new Error(`Failed to fetch datasets: ${error.message}`)
    }

    return {
      datasets: (data || []) as DatasetListing[],
      total: count || 0,
    }
  }
}

