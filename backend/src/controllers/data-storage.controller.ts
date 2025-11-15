import { Request, Response } from 'express'
import { DataStorageService, QueryRequest } from '../services/data-storage.service.js'
import { z } from 'zod'

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
   * Query if seller has data matching requirements
   * GET /api/seller/:sellerId/query
   * Used by agents to ask "do you have X data?"
   */
  async querySellerData(req: Request, res: Response): Promise<void> {
    try {
      const { sellerId } = req.params
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
            seller_id: sellerId,
            query: query,
          },
          'pending'
        )
      }

      const result = await dataStorageService.querySellerData(sellerId, query)

      // Update action status
      if (agentId) {
        const { AgentActionService } = await import('../services/agent-action.service.js')
        const actionService = new AgentActionService()
        await actionService.logAction(
          agentId,
          'query_seller',
          {
            seller_id: sellerId,
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
      const { sellerId } = req.params
      const datasetListingId = req.query.dataset_listing_id as string | undefined
      const sampleSize = parseInt(req.query.sampleSize as string) || 10

      const samples = await dataStorageService.getSampleRecords(
        sellerId,
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
}

