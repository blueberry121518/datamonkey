export interface DatasetListing {
  id: string
  seller_id: string
  name: string
  description?: string
  category?: string
  endpoint_path: string
  type: 'api' | 'agent'
  price_per_record: number
  metadata: Record<string, any>
  schema?: Record<string, any> // JSON Schema
  total_rows?: number
  quality_score?: number
  content_summary?: string
  probe_endpoint?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface CreateDatasetRequest {
  name: string
  description?: string
  category?: string
  type?: 'api' | 'agent'
  price_per_record?: number
  metadata?: Record<string, any>
  schema?: Record<string, any>
  total_rows?: number
  quality_score?: number
  content_summary?: string
  // For file uploads (future)
  file?: File
  // For API endpoints
  endpoint_url?: string
}

export interface UpdateDatasetRequest {
  name?: string
  description?: string
  category?: string
  price_per_record?: number
  metadata?: Record<string, any>
  schema?: Record<string, any>
  total_rows?: number
  quality_score?: number
  content_summary?: string
  is_active?: boolean
}

export interface DatasetMetadata {
  category?: string
  tags?: string[]
  format?: string // 'json', 'csv', 'parquet', etc.
  encoding?: string
  compression?: string
  fields?: Array<{
    name: string
    type: string
    description?: string
  }>
  [key: string]: any
}

