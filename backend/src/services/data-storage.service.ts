import { supabase } from '../config/supabase.js'
import logger from '../utils/logger.js'

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

  /**
   * Get warehouse data stats (data without dataset_listing_id)
   */
  async getWarehouseDataStats(sellerId: string): Promise<{
    recordCount: number
    categories: string[]
    sampleRecords: Array<Record<string, any>>
    fields: string[]
  }> {
    const { data, error } = await supabase
      .from('seller_data_storage')
      .select('data_record, metadata')
      .eq('seller_id', sellerId)
      .is('dataset_listing_id', null)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) {
      throw new Error(`Failed to get warehouse data: ${error.message}`)
    }

    const records = (data || []).map((d) => d.data_record)
    const categories = new Set<string>()
    const fields = new Set<string>()

    records.forEach((record) => {
      if (record && typeof record === 'object') {
        Object.keys(record).forEach((key) => fields.add(key))
        if (record.category) {
          categories.add(String(record.category))
        }
      }
    })

    // Get category from metadata if available
    data?.forEach((item) => {
      if (item.metadata?.category) {
        categories.add(String(item.metadata.category))
      }
    })

    // Get actual count (not just limited records)
    const { count, error: countError } = await supabase
      .from('seller_data_storage')
      .select('*', { count: 'exact', head: true })
      .eq('seller_id', sellerId)
      .is('dataset_listing_id', null)

    if (countError) {
      logger.error(`[DataStorageService] Error getting warehouse count: ${countError.message}`)
      throw new Error(`Failed to get warehouse data count: ${countError.message}`)
    }

    logger.info(`[DataStorageService] Warehouse record count for seller ${sellerId}: ${count || 0}`)
    logger.info(`[DataStorageService] Fetched ${data?.length || 0} warehouse records for analysis`)

    const result = {
      recordCount: count || 0,
      categories: Array.from(categories),
      sampleRecords: records.slice(0, 10),
      fields: Array.from(fields),
    }

    logger.info(`[DataStorageService] Warehouse stats result:`, JSON.stringify(result, null, 2))

    return result
  }

  /**
   * Get ALL seller data categorized into general vs structured
   * General = unstructured warehouse data (dataset_listing_id is NULL)
   * Structured = data with dataset_listing_id (already linked to specific datasets)
   */
  async getAllSellerDataCategorized(sellerId: string): Promise<{
    general: {
      recordCount: number
      sampleRecords: Array<Record<string, any>>
      fields: string[]
    }
    structured: Map<string, {
      recordCount: number
      sampleRecords: Array<Record<string, any>>
      fields: string[]
      dataset_listing_id: string
    }>
  }> {
    const { data, error } = await supabase
      .from('seller_data_storage')
      .select('id, data_record, metadata, dataset_listing_id')
      .eq('seller_id', sellerId)
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(`Failed to get seller data: ${error.message}`)
    }

    const generalRecords: Array<Record<string, any>> = []
    const generalFields = new Set<string>()
    
    const structuredMap = new Map<string, {
      recordCount: number
      sampleRecords: Array<Record<string, any>>
      fields: Set<string>
      dataset_listing_id: string
    }>()

    data?.forEach((item) => {
      if (!item.dataset_listing_id) {
        // General/unstructured data
        if (item.data_record && typeof item.data_record === 'object') {
          generalRecords.push(item.data_record)
          Object.keys(item.data_record).forEach((key) => generalFields.add(key))
        }
      } else {
        // Structured data (already linked to a dataset)
        const datasetId = item.dataset_listing_id
        const structured = structuredMap.get(datasetId) || {
          recordCount: 0,
          sampleRecords: [] as Array<Record<string, any>>,
          fields: new Set<string>(),
          dataset_listing_id: datasetId,
        }

        structured.recordCount++
        if (structured.sampleRecords.length < 10 && item.data_record) {
          structured.sampleRecords.push(item.data_record)
        }

        if (item.data_record && typeof item.data_record === 'object') {
          Object.keys(item.data_record).forEach((key) => structured.fields.add(key))
        }

        structuredMap.set(datasetId, structured)
      }
    })

    // Convert Set to Array for structured data
    const structuredResult = new Map<string, {
      recordCount: number
      sampleRecords: Array<Record<string, any>>
      fields: string[]
      dataset_listing_id: string
    }>()

    structuredMap.forEach((value, datasetId) => {
      structuredResult.set(datasetId, {
        recordCount: value.recordCount,
        sampleRecords: value.sampleRecords,
        fields: Array.from(value.fields),
        dataset_listing_id: datasetId,
      })
    })

    return {
      general: {
        recordCount: generalRecords.length,
        sampleRecords: generalRecords.slice(0, 10),
        fields: Array.from(generalFields),
      },
      structured: structuredResult,
    }
  }
}

