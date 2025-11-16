import { Request, Response } from 'express'
import { DatasetService } from '../services/dataset.service.js'
import { CreateDatasetRequest } from '../types/dataset.js'
import { z } from 'zod'
import logger from '../utils/logger.js'

const datasetService = new DatasetService()

// Validation schemas
const createDatasetSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255, 'Name too long'),
  description: z.string().max(2000, 'Description too long').optional(),
  category: z.string().max(100).optional(),
  type: z.enum(['api', 'agent']).optional(),
  price_per_record: z.number().min(0, 'Price must be positive').optional(),
  metadata: z.record(z.any()).optional(),
  schema: z.record(z.any()).optional(),
  total_rows: z.number().int().positive().optional(),
  quality_score: z.number().min(0).max(1).optional(),
  content_summary: z.string().optional(),
  endpoint_url: z.string().url().optional(),
})


export class DatasetController {
  /**
   * Create a new dataset listing
   * POST /api/datasets
   */
  async createDataset(req: Request, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
        })
        return
      }

      // Validate request body
      const validatedData = createDatasetSchema.parse(req.body) as CreateDatasetRequest

      // Create dataset
      const dataset = await datasetService.createDataset(req.userId, validatedData)

      res.status(201).json({
        success: true,
        data: dataset,
        message: 'Dataset created successfully',
      })
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.errors,
        })
        return
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      res.status(500).json({
        success: false,
        error: errorMessage,
      })
    }
  }

  /**
   * Get all datasets for the authenticated seller
   * GET /api/datasets/my
   */
  async getMyDatasets(req: Request, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
        })
        return
      }

      logger.info(`Step 1: Get my datasets request received for user: ${req.userId}`)
      logger.info(`Step 2: Fetching seller datasets`)
      const datasets = await datasetService.getSellerDatasets(req.userId)
      logger.info(`Step 3: Found ${datasets?.length || 0} datasets`)
      logger.info(`Step 4: Returning datasets response`)

      // Disable caching to ensure fresh data
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
      res.setHeader('Pragma', 'no-cache')
      res.setHeader('Expires', '0')

      res.status(200).json({
        success: true,
        data: datasets || [],
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.info(`Step 1: Error getting datasets: ${errorMessage}`)
      logger.info(`Step 2: Returning 500 error response`)
      res.status(500).json({
        success: false,
        error: errorMessage,
      })
    }
  }

  /**
   * Get a single dataset by ID
   * GET /api/datasets/:id
   */
  async getDataset(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params
      const sellerId = req.userId // Optional - for ownership check

      const dataset = await datasetService.getDatasetById(id, sellerId)

      res.status(200).json({
        success: true,
        data: dataset,
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      const statusCode = errorMessage.includes('not found') ? 404 : 500

      res.status(statusCode).json({
        success: false,
        error: errorMessage,
      })
    }
  }


  /**
   * Get all active datasets (for marketplace discovery)
   * GET /api/datasets
   */
  async getActiveDatasets(req: Request, res: Response): Promise<void> {
    try {
      const { category, search, limit, offset } = req.query

      const filters = {
        category: category as string | undefined,
        search: search as string | undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined,
      }

      const result = await datasetService.getActiveDatasets(filters)

      res.status(200).json({
        success: true,
        data: result.datasets,
        pagination: {
          total: result.total,
          limit: filters.limit || 10,
          offset: filters.offset || 0,
        },
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      res.status(500).json({
        success: false,
        error: errorMessage,
      })
    }
  }

  /**
   * Serve dataset data (with x402 payment)
   * GET /api/datasets/:id/data
   * This endpoint is protected by x402PaymentMiddleware
   * Payment is verified before this handler is called
   */
  async serveDataset(req: Request, res: Response): Promise<void> {
    try {
      const dataset = (req as any).dataset
      const payment = (req as any).payment
      const quantity = parseInt(req.query.quantity as string) || 1

      if (!dataset) {
        res.status(404).json({
          success: false,
          error: 'Dataset not found',
        })
        return
      }

      // Fetch actual data from seller's storage
      const { DataStorageService } = await import('../services/data-storage.service.js')
      const dataStorageService = new DataStorageService()
      
      // For virtual warehouse endpoints, fetch data where dataset_listing_id IS NULL
      // For structured datasets, fetch data linked to dataset.id
      const datasetListingId = dataset.id.startsWith('warehouse-') ? null : dataset.id
      
      const actualData = await dataStorageService.getDataRecords(
        dataset.seller_id,
        datasetListingId,
        quantity,
        0
      )

      // If no data available, return empty array
      const records = actualData.length > 0 ? actualData : this.generateMockData(dataset, quantity)

      // Log agent actions
      const agentId = (req as any).agentId
      if (agentId) {
        const { AgentActionService } = await import('../services/agent-action.service.js')
        const actionService = new AgentActionService()

        // Log payment verified
        await actionService.logAction(
          agentId,
          'payment_verified',
          {
            dataset_id: dataset.id,
            amount: payment.amount,
            quantity,
          },
          'success'
        )

        // Log data received
        await actionService.logAction(
          agentId,
          'data_received',
          {
            dataset_id: dataset.id,
            dataset_name: dataset.name,
            quantity: records.length,
            records_preview: records.slice(0, 3), // First 3 records
          },
          'success'
        )

        // Log purchase complete
        await actionService.logAction(
          agentId,
          'purchase_complete',
          {
            dataset_id: dataset.id,
            quantity,
            amount: payment.amount,
            total_records: records.length,
          },
          'success'
        )
      }

      res.status(200).json({
        success: true,
        data: {
          dataset_id: dataset.id,
          dataset_name: dataset.name,
          quantity: quantity,
          records: records,
          schema: dataset.schema,
          metadata: {
            total_available: dataset.total_rows,
            quality_score: dataset.quality_score,
          },
        },
        payment: {
          amount: payment.amount,
          recipient: payment.recipient,
          verified: true,
        },
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      res.status(500).json({
        success: false,
        error: errorMessage,
      })
    }
  }

  /**
   * Probe endpoint - returns dataset metadata without payment
   * GET /api/datasets/:id/probe
   */
  async probeDataset(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params
      const dataset = await datasetService.getDatasetById(id)

      if (!dataset.is_active) {
        res.status(404).json({
          success: false,
          error: 'Dataset not found',
        })
        return
      }

      // Return metadata without requiring payment
      res.status(200).json({
        success: true,
        data: {
          id: dataset.id,
          name: dataset.name,
          description: dataset.description,
          category: dataset.category,
          schema: dataset.schema,
          price_per_record: dataset.price_per_record,
          total_rows: dataset.total_rows,
          quality_score: dataset.quality_score,
          content_summary: dataset.content_summary,
          metadata: dataset.metadata,
          endpoint: `/api/datasets/${dataset.id}/data`,
          probe_endpoint: `/api/datasets/${dataset.id}/probe`,
        },
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      const statusCode = errorMessage.includes('not found') ? 404 : 500

      res.status(statusCode).json({
        success: false,
        error: errorMessage,
      })
    }
  }

  /**
   * Generate mock data based on dataset schema
   * TODO: Replace with actual data fetching from storage
   */
  private generateMockData(dataset: any, quantity: number): any[] {
    const data: any[] = []
    const schema = dataset.schema

    if (!schema || !schema.items || !schema.items.properties) {
      // No schema - return empty array or basic structure
      return Array(quantity).fill({})
    }

    const properties = schema.items.properties
    const required = schema.items.required || []

    for (let i = 0; i < quantity; i++) {
      const record: any = {}
      Object.keys(properties).forEach((key) => {
        const prop = properties[key]
        switch (prop.type) {
          case 'string':
            record[key] = `sample_${key}_${i}`
            break
          case 'number':
          case 'integer':
            record[key] = i + Math.random() * 100
            break
          case 'boolean':
            record[key] = i % 2 === 0
            break
          case 'array':
            record[key] = []
            break
          default:
            record[key] = null
        }
      })
      data.push(record)
    }

    return data
  }

  /**
   * Get interactions for a dataset (agent queries and purchases)
   * GET /api/datasets/:id/interactions
   */
  async getDatasetInteractions(req: Request, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
        })
        return
      }

      const { id } = req.params
      const limit = parseInt(req.query.limit as string) || 100

      // Verify dataset belongs to user
      const dataset = await datasetService.getDatasetById(id, req.userId)

      // Get interactions for this dataset
      const { AgentActionService } = await import('../services/agent-action.service.js')
      const actionService = new AgentActionService()
      const interactions = await actionService.getDatasetInteractions(id, limit)

      res.status(200).json({
        success: true,
        data: interactions,
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      const statusCode = errorMessage.includes('not found') ? 404 : 500
      res.status(statusCode).json({
        success: false,
        error: errorMessage,
      })
    }
  }

  /**
   * Get sample data records for a dataset
   * GET /api/datasets/:id/sample
   */
  async getDatasetSample(req: Request, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
        })
        return
      }

      const { id } = req.params
      const sampleSize = parseInt(req.query.size as string) || 10

      logger.info(`[DatasetController] getDatasetSample called - datasetId: ${id}, sampleSize: ${sampleSize}, userId: ${req.userId}`)

      // Verify dataset belongs to user
      const dataset = await datasetService.getDatasetById(id, req.userId)
      logger.info(`[DatasetController] Dataset found - name: ${dataset.name}, seller_id: ${dataset.seller_id}, is_warehouse: ${dataset.id.startsWith('warehouse-')}`)

      // Get sample records
      const { DataStorageService } = await import('../services/data-storage.service.js')
      const dataStorageService = new DataStorageService()
      
      // For virtual warehouse endpoints, fetch data where dataset_listing_id IS NULL
      // For structured datasets, fetch data linked to dataset.id
      const datasetListingId = dataset.id.startsWith('warehouse-') ? null : dataset.id
      logger.info(`[DatasetController] Fetching records - seller_id: ${dataset.seller_id}, dataset_listing_id: ${datasetListingId || 'NULL (warehouse)'}, sampleSize: ${sampleSize}`)
      
      const samples = await dataStorageService.getSampleRecords(
        dataset.seller_id,
        datasetListingId,
        sampleSize
      )

      logger.info(`[DatasetController] Retrieved ${samples.length} sample records`)

      res.status(200).json({
        success: true,
        data: samples,
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.error(`[DatasetController] Error in getDatasetSample: ${errorMessage}`)
      const statusCode = errorMessage.includes('not found') ? 404 : 500
      res.status(statusCode).json({
        success: false,
        error: errorMessage,
      })
    }
  }

  /**
   * Get seller statistics (sales, revenue, etc.)
   * GET /api/datasets/stats
   */
  async getSellerStats(req: Request, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
        })
        return
      }

      // Get active endpoints count
      const allDatasets = await datasetService.getSellerDatasets(req.userId)
      const activeEndpoints = allDatasets.filter(d => d.is_active).length

      // Get sales stats from agent actions
      const { AgentActionService } = await import('../services/agent-action.service.js')
      const actionService = new AgentActionService()
      const salesStats = await actionService.getSellerStats(req.userId)

      res.status(200).json({
        success: true,
        data: {
          totalSales: salesStats.totalSales,
          totalRevenue: salesStats.totalRevenue,
          activeEndpoints,
          totalRecordsSold: salesStats.totalRecordsSold,
          recentSales: salesStats.recentSales,
        },
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      res.status(500).json({
        success: false,
        error: errorMessage,
      })
    }
  }

  /**
   * Get records sold for a specific dataset
   * GET /api/datasets/:id/records-sold
   */
  async getDatasetRecordsSold(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params
      
      if (!id) {
        res.status(400).json({
          success: false,
          error: 'Dataset ID required',
        })
        return
      }

      // For virtual warehouse endpoints, use the warehouse-{sellerId} format for querying
      // The interactions are stored with the dataset ID used in the purchase
      const { AgentActionService } = await import('../services/agent-action.service.js')
      const actionService = new AgentActionService()
      const interactions = await actionService.getDatasetInteractions(id, 1000)
      
      // Count records sold from purchase_complete actions
      let recordsSold = 0
      interactions.forEach((action) => {
        if (action.action_type === 'purchase_complete' && action.status === 'success') {
          const details = action.details as Record<string, any>
          const quantity = parseInt(details?.quantity || '0')
          recordsSold += quantity
        }
      })

      res.status(200).json({
        success: true,
        data: {
          recordsSold,
        },
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      res.status(500).json({
        success: false,
        error: errorMessage,
      })
    }
  }
}

