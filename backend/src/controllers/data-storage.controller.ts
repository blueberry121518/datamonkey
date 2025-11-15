import { Request, Response } from 'express'
import { DataStorageService, QueryRequest } from '../services/data-storage.service.js'
import { z } from 'zod'
import logger from '../utils/logger.js'

const dataStorageService = new DataStorageService()

const uploadDataSchema = z.object({
  dataset_listing_id: z.string().uuid().optional().nullable(),
  records: z.array(z.record(z.any())).min(1),
  metadata: z.record(z.any()).optional(),
})

const querySchema = z.object({
  category: z.string().optional(),
  requiredFields: z.array(z.string()).optional(),
  filters: z.record(z.any()).optional(),
  minQuality: z.number().min(0).max(1).optional(),
  sampleSize: z.number().int().positive().max(100).optional(),
})

export class DataStorageController {
  /**
   * Upload data records to seller's storage
   * POST /api/seller/data/upload
   */
  async uploadData(req: Request, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
        })
        return
      }

      const validatedData = uploadDataSchema.parse(req.body)

      const records = await dataStorageService.uploadData(
        req.userId,
        validatedData.dataset_listing_id || null,
        validatedData.records,
        validatedData.metadata
      )

      res.status(201).json({
        success: true,
        data: {
          uploaded: records.length,
          records: records.map((r) => ({ id: r.id, created_at: r.created_at })),
        },
        message: `Successfully uploaded ${records.length} records`,
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
   * Query if producer has data matching requirements
   * GET /api/producer/:producerId/query
   * Used by agents to ask "do you have X data?"
   */
  async querySellerData(req: Request, res: Response): Promise<void> {
    try {
      const producerId = req.params.producerId || req.params.sellerId // Support both for backwards compatibility
      const query = querySchema.parse(req.query) as QueryRequest
      const agentId = req.query.agent_id as string | undefined

      // Log agent action
      if (agentId) {
        const { AgentActionService } = await import('../services/agent-action.service.js')
        const actionService = new AgentActionService()
        await actionService.logAction(
          agentId,
          'query_seller',
          {
            seller_id: producerId,
            query: query,
          },
          'pending'
        )
      }

      const result = await dataStorageService.querySellerData(producerId, query)

      // Update action status
      if (agentId) {
        const { AgentActionService } = await import('../services/agent-action.service.js')
        const actionService = new AgentActionService()
        await actionService.logAction(
          agentId,
          'query_seller',
          {
            seller_id: producerId,
            query: query,
            result: {
              match_count: result.matchCount,
              has_data: result.matchCount > 0,
            },
          },
          'success'
        )
      }

      res.status(200).json({
        success: true,
        data: result,
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
      const statusCode = errorMessage.includes('not found') ? 404 : 500

      res.status(statusCode).json({
        success: false,
        error: errorMessage,
      })
    }
  }

  /**
   * Get sample records for quality assessment
   * GET /api/seller/:sellerId/sample
   */
  async getSampleRecords(req: Request, res: Response): Promise<void> {
    try {
      const producerId = req.params.producerId || req.params.sellerId // Support both for backwards compatibility
      const datasetListingId = req.query.dataset_listing_id as string | undefined
      const sampleSize = parseInt(req.query.sampleSize as string) || 10

      const samples = await dataStorageService.getSampleRecords(
        producerId,
        datasetListingId || null,
        sampleSize
      )

      res.status(200).json({
        success: true,
        data: {
          samples,
          count: samples.length,
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
   * Get seller's data count
   * GET /api/seller/data/count
   */
  async getDataCount(req: Request, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
        })
        return
      }

      const datasetListingId = req.query.dataset_listing_id as string | undefined

      const count = await dataStorageService.getSellerDataCount(
        req.userId,
        datasetListingId
      )

      res.status(200).json({
        success: true,
        data: {
          count,
          dataset_listing_id: datasetListingId || null,
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
   * Get warehouse data stats (data without dataset_listing_id)
   * GET /api/seller/data/warehouse/stats
   */
  async getWarehouseStats(req: Request, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
        })
        return
      }

      logger.info(`[DataStorageController] getWarehouseStats called for user: ${req.userId}`)
      const stats = await dataStorageService.getWarehouseDataStats(req.userId)
      logger.info(`[DataStorageController] Warehouse stats for user ${req.userId}:`, JSON.stringify(stats, null, 2))

      // Disable caching to ensure fresh data
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
      res.setHeader('Pragma', 'no-cache')
      res.setHeader('Expires', '0')

      res.status(200).json({
        success: true,
        data: stats,
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.error(`[DataStorageController] getWarehouseStats error:`, error)
      res.status(500).json({
        success: false,
        error: errorMessage,
      })
    }
  }

  async ensureWarehouseEndpoints(req: Request, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' })
        return
      }

      logger.info(`[DataStorageController] ensureWarehouseEndpoints - user: ${req.userId}`)
      
      const { DatasetService } = await import('../services/dataset.service.js')
      const datasetService = new DatasetService()
      const datasetsBefore = await datasetService.getSellerDatasets(req.userId)
      logger.info(`[DataStorageController] Before: ${datasetsBefore.length} endpoints`)
      
      const { FileUploadController } = await import('./file-upload.controller.js')
      const fileUploadController = new FileUploadController()
      await (fileUploadController as any).ensureWarehouseEndpoints(req.userId)

      const datasetsAfter = await datasetService.getSellerDatasets(req.userId)
      logger.info(`[DataStorageController] After: ${datasetsAfter.length} endpoints`)

      res.status(200).json({
        success: true,
        data: {
          endpoints_created: datasetsAfter.length,
          endpoints: datasetsAfter.map(d => ({
            id: d.id,
            name: d.name,
            category: d.category,
            record_count: d.total_rows,
          })),
        },
      })
    } catch (error) {
      logger.error(`[DataStorageController] Error:`, error)
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  /**
   * @deprecated - Endpoints are now created automatically. Use ensureWarehouseEndpoints instead.
   * Create dataset from warehouse data
   * POST /api/seller/data/warehouse/create-endpoint
   */
  async createEndpointFromWarehouse(req: Request, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
        })
        return
      }

      const { name, description, category, price_per_record } = req.body

      // Get warehouse data stats
      const stats = await dataStorageService.getWarehouseDataStats(req.userId)

      if (stats.recordCount === 0) {
        res.status(400).json({
          success: false,
          error: 'No warehouse data available to create endpoint',
        })
        return
      }

      // Get sample records to auto-detect schema
      const { DatasetService } = await import('../services/dataset.service.js')
      const datasetService = new DatasetService()

      // Auto-detect metadata from sample
      const autoMetadata = datasetService.autoDetectMetadata(stats.sampleRecords)

      // Create dataset endpoint (automatically discoverable in marketplace)
      // This sets is_active = true, making it visible to consumer agents via GET /api/datasets
      const dataset = await datasetService.createDataset(req.userId, {
        name: name || `Warehouse Data - ${stats.categories[0] || 'General'}`,
        description: description || `Data from warehouse: ${stats.recordCount} records`,
        category: category || stats.categories[0] || 'General',
        type: 'api',
        price_per_record: price_per_record || 0.001,
        schema: autoMetadata.schema,
        total_rows: stats.recordCount,
        quality_score: autoMetadata.quality_score || 0.8,
        content_summary: autoMetadata.content_summary || `Dataset with ${stats.recordCount} records`,
      })

      // Link warehouse data to this dataset endpoint
      const { supabase } = await import('../config/supabase.js')
      await supabase
        .from('seller_data_storage')
        .update({ dataset_listing_id: dataset.id })
        .eq('seller_id', req.userId)
        .is('dataset_listing_id', null)

      res.status(201).json({
        success: true,
        data: {
          ...dataset,
          marketplace_endpoint: `/api/datasets/${dataset.id}`,
          discovery_endpoint: '/api/datasets',
          note: 'Endpoint is now discoverable by consumer agents in the Data Monkey marketplace',
        },
        message: `Successfully created discoverable endpoint from warehouse data. Consumer agents can now find this endpoint via GET /api/datasets`,
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

