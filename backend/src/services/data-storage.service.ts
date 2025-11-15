import { supabase } from '../config/supabase.js'

export interface DataRecord {
  id: string
  seller_id: string
  dataset_listing_id?: string
  data_record: Record<string, any>
  metadata?: Record<string, any>
  created_at: string
}

export interface QueryRequest {
  category?: string
  requiredFields?: string[]
  filters?: Record<string, any>
  minQuality?: number
  sampleSize?: number
}

export class DataStorageService {
  /**
   * Upload data records to seller's storage
   * Sellers can upload unlimited data
   */
  async uploadData(
    sellerId: string,
    datasetListingId: string | null,
    records: Array<Record<string, any>>,
    metadata?: Record<string, any>
  ): Promise<DataRecord[]> {
    const dataToInsert = records.map((record) => ({
      seller_id: sellerId,
      dataset_listing_id: datasetListingId || null,
      data_record: record,
      metadata: metadata || {},
    }))

    const { data, error } = await supabase
      .from('seller_data_storage')
      .insert(dataToInsert)
      .select()

    if (error) {
      throw new Error(`Failed to upload data: ${error.message}`)
    }

    return (data || []) as DataRecord[]
  }

  /**
   * Query if seller has data matching requirements
   * Used by agents to ask "do you have X data?"
   */
  async querySellerData(
    sellerId: string,
    query: QueryRequest
  ): Promise<{
    hasData: boolean
    matchCount: number
    sampleRecords?: Array<Record<string, any>>
    qualityScore?: number
    estimatedPrice?: string
  }> {
    let queryBuilder = supabase
      .from('seller_data_storage')
      .select('*', { count: 'exact' })
      .eq('seller_id', sellerId)

    // If dataset listing ID provided, filter by it
    if (query.filters?.dataset_listing_id) {
      queryBuilder = queryBuilder.eq('dataset_listing_id', query.filters.dataset_listing_id)
    }

    // Build JSONB query for required fields
    // Note: This is a simplified check - in production, you might want more sophisticated matching
    // For now, we'll check if records have the required fields in a post-query filter

    // Apply additional filters
    if (query.filters) {
      Object.entries(query.filters).forEach(([key, value]) => {
        if (key !== 'dataset_listing_id') {
          // Filter on data_record fields
          queryBuilder = queryBuilder.eq(`data_record->>${key}`, value)
        }
      })
    }

    // Get all matching records first (we'll filter by required fields in code)
    const { data: allData, error: dataError } = await queryBuilder.select('data_record, metadata')

    if (dataError) {
      throw new Error(`Failed to query data: ${dataError.message}`)
    }

    // Filter by required fields if specified
    let filteredData = allData || []
    if (query.requiredFields && query.requiredFields.length > 0) {
      filteredData = filteredData.filter((item: any) => {
        const record = item.data_record
        return query.requiredFields!.every((field) => {
          return record[field] !== undefined && record[field] !== null && record[field] !== ''
        })
      })
    }

    const matchCount = filteredData.length

    if (matchCount === 0) {
      return {
        hasData: false,
        matchCount: 0,
      }
    }

    // Get sample records for quality assessment
    const sampleSize = query.sampleSize || 10
    const sampleData = filteredData.slice(0, sampleSize)

    // Calculate quality score from sample
    const qualityScore = this.calculateQualityScore(
      sampleData.map((d: any) => d.data_record),
      query.requiredFields || []
    )

    return {
      hasData: true,
      matchCount,
      sampleRecords: sampleData.map((d: any) => d.data_record),
      qualityScore,
      estimatedPrice: this.estimatePrice(matchCount, query),
    }
  }

  /**
   * Get sample records for quality assessment
   */
  async getSampleRecords(
    sellerId: string,
    datasetListingId: string | null,
    sampleSize: number = 10
  ): Promise<Array<Record<string, any>>> {
    let queryBuilder = supabase
      .from('seller_data_storage')
      .select('data_record')
      .eq('seller_id', sellerId)
      .limit(sampleSize)

    if (datasetListingId) {
      queryBuilder = queryBuilder.eq('dataset_listing_id', datasetListingId)
    }

    const { data, error } = await queryBuilder.order('created_at', { ascending: false })

    if (error) {
      throw new Error(`Failed to get sample records: ${error.message}`)
    }

    return (data || []).map((d) => d.data_record)
  }

  /**
   * Get data records for purchase
   */
  async getDataRecords(
    sellerId: string,
    datasetListingId: string | null,
    quantity: number,
    offset: number = 0
  ): Promise<Array<Record<string, any>>> {
    let queryBuilder = supabase
      .from('seller_data_storage')
      .select('data_record')
      .eq('seller_id', sellerId)
      .range(offset, offset + quantity - 1)

    if (datasetListingId) {
      queryBuilder = queryBuilder.eq('dataset_listing_id', datasetListingId)
    }

    const { data, error } = await queryBuilder.order('created_at', { ascending: false })

    if (error) {
      throw new Error(`Failed to get data records: ${error.message}`)
    }

    return (data || []).map((d) => d.data_record)
  }

  /**
   * Calculate quality score from sample records
   */
  private calculateQualityScore(
    records: Array<Record<string, any>>,
    requiredFields: string[]
  ): number {
    if (records.length === 0) return 0

    let totalScore = 0
    records.forEach((record) => {
      let recordScore = 0
      requiredFields.forEach((field) => {
        if (record[field] !== undefined && record[field] !== null && record[field] !== '') {
          recordScore += 1 / requiredFields.length
        }
      })
      totalScore += recordScore
    })

    return totalScore / records.length
  }

  /**
   * Estimate price based on match count and query
   */
  private estimatePrice(matchCount: number, query: QueryRequest): string {
    // Default price per record (can be enhanced with actual pricing logic)
    const pricePerRecord = 0.001
    return (matchCount * pricePerRecord).toFixed(6)
  }

  /**
   * Get total record count for a seller
   */
  async getSellerDataCount(sellerId: string, datasetListingId?: string): Promise<number> {
    let queryBuilder = supabase
      .from('seller_data_storage')
      .select('*', { count: 'exact', head: true })
      .eq('seller_id', sellerId)

    if (datasetListingId) {
      queryBuilder = queryBuilder.eq('dataset_listing_id', datasetListingId)
    }

    const { count, error } = await queryBuilder

    if (error) {
      throw new Error(`Failed to get data count: ${error.message}`)
    }

    return count || 0
  }
}

