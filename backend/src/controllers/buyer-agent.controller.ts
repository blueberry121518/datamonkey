import { Request, Response } from 'express'
import { BuyerAgentService, CreateAgentRequest } from '../services/buyer-agent.service.js'
import { z } from 'zod'

const buyerAgentService = new BuyerAgentService()

const createAgentSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  goal: z.string().min(1),
  requirements: z.object({
    category: z.string().optional(),
    requiredFields: z.array(z.string()).optional(),
    format: z.string().optional(),
    minQuality: z.number().min(0).max(1).optional(),
    filters: z.record(z.any()).optional(),
  }),
  budget: z.number().min(0),
  quality_threshold: z.number().min(0).max(1).optional(),
  quantity_required: z.number().int().positive().optional(),
})

export class BuyerAgentController {
  /**
   * Initialize a new buyer agent
   * POST /api/agents
   */
  async createAgent(req: Request, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
        })
        return
      }

      const validatedData = createAgentSchema.parse(req.body) as CreateAgentRequest

      const agent = await buyerAgentService.createAgent(req.userId, validatedData)

      res.status(201).json({
        success: true,
        data: agent,
        message: 'Agent initialized successfully',
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
   * Get all agents for the buyer
   * GET /api/agents
   */
  async getMyAgents(req: Request, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
        })
        return
      }

      const agents = await buyerAgentService.getBuyerAgents(req.userId)

      res.status(200).json({
        success: true,
        data: agents,
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
   * Get a single agent
   * GET /api/agents/:id
   */
  async getAgent(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params
      const buyerId = req.userId // Optional - for ownership check

      const agent = await buyerAgentService.getAgent(id, buyerId)

      res.status(200).json({
        success: true,
        data: agent,
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
   * Update agent status
   * PATCH /api/agents/:id/status
   */
  async updateAgentStatus(req: Request, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
        })
        return
      }

      const { id } = req.params
      const { status } = req.body

      if (!['active', 'paused', 'completed', 'failed'].includes(status)) {
        res.status(400).json({
          success: false,
          error: 'Invalid status',
        })
        return
      }

      const agent = await buyerAgentService.updateAgentStatus(
        id,
        req.userId,
        status
      )

      res.status(200).json({
        success: true,
        data: agent,
        message: 'Agent status updated',
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
   * Get agent wallet balance
   * GET /api/agents/:id/balance
   */
  async getAgentBalance(req: Request, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
        })
        return
      }

      const { id } = req.params

      // Verify ownership
      await buyerAgentService.getAgent(id, req.userId)

      const balance = await buyerAgentService.getAgentBalance(id)

      res.status(200).json({
        success: true,
        data: balance,
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
}

