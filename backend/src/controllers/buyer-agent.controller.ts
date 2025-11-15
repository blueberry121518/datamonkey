import { Request, Response } from 'express'
import { BuyerAgentService, CreateAgentRequest } from '../services/buyer-agent.service.js'
import { LLMParsingService } from '../services/llm-parsing.service.js'
import { AgentExecutionService } from '../services/agent-execution.service.js'
import { getFileType } from '../middleware/upload.middleware.js'
import { z } from 'zod'
import logger from '../utils/logger.js'

const buyerAgentService = new BuyerAgentService()
const llmParsingService = new LLMParsingService()
const agentExecutionService = new AgentExecutionService()

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
  }).optional(),
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

      // Provide default requirements if not provided
      const agentData: CreateAgentRequest = {
        ...validatedData,
        requirements: validatedData.requirements || {},
      }

      const agent = await buyerAgentService.createAgent(req.userId, agentData)

      // Start agent execution in background
      agentExecutionService.startAgent(agent.id).catch((error) => {
        logger.error(`Failed to start agent ${agent.id}:`, error)
      })

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
      let agent = await buyerAgentService.getAgent(id, req.userId)

      // If agent doesn't have a wallet, try to fix it automatically
      if (!agent.wallet_id) {
        console.log(`[CONTROLLER_DEBUG] Agent ${id} has no wallet_id, attempting to fix...`)
        try {
          agent = await buyerAgentService.fixAgentWallet(id, req.userId)
          console.log(`[CONTROLLER_DEBUG] ✅ Fixed wallet for agent ${id}: ${agent.wallet_id}`)
        } catch (fixError) {
          console.error(`[CONTROLLER_DEBUG] ❌ Failed to fix wallet:`, fixError)
          res.status(200).json({
            success: true,
            data: null,
          })
          return
        }
      }

      if (!agent.wallet_id) {
        res.status(200).json({
          success: true,
          data: null,
        })
        return
      }

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

  /**
   * Generate agent configuration from natural language or example file
   * POST /api/agents/generate-config
   */
  async generateAgentConfig(req: Request, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
        })
        return
      }

      const { description } = req.body
      const file = req.file as Express.Multer.File | undefined

      if ((!description || !description.trim()) && !file) {
        res.status(400).json({
          success: false,
          error: 'Either description or file is required',
        })
        return
      }

      logger.info('Generating agent config', {
        userId: req.userId,
        hasFile: !!file,
        filename: file?.originalname,
      })

      let exampleFile: {
        filename: string
        mimeType: string
        fileType: string
        fileData: Buffer | string
      } | undefined

      if (file) {
        const fileType = getFileType(file.mimetype)
        exampleFile = {
          filename: file.originalname,
          mimeType: file.mimetype,
          fileType,
          fileData: file.buffer,
        }
      }

      const config = await llmParsingService.generateAgentConfig(
        description?.trim() || (file ? `I need data similar to the uploaded file: ${file.originalname}` : ''),
        exampleFile
      )

      res.status(200).json({
        success: true,
        data: config,
        message: 'Agent configuration generated successfully',
      })
    } catch (error) {
      logger.error('Failed to generate agent config:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      res.status(500).json({
        success: false,
        error: errorMessage,
      })
    }
  }

  /**
   * Start agent execution
   * POST /api/agents/:id/start
   */
  async startAgent(req: Request, res: Response): Promise<void> {
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

      await agentExecutionService.startAgent(id)

      res.status(200).json({
        success: true,
        message: 'Agent started successfully',
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
   * Stop agent execution
   * POST /api/agents/:id/stop
   */
  async stopAgent(req: Request, res: Response): Promise<void> {
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

      agentExecutionService.stopAgent(id)

      res.status(200).json({
        success: true,
        message: 'Agent stopped successfully',
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
   * Manually fix agent wallet
   * POST /api/agents/:id/fix-wallet
   */
  async fixAgentWallet(req: Request, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
        })
        return
      }

      const { id } = req.params
      console.log(`[CONTROLLER_DEBUG] Manual wallet fix requested for agent ${id}`)
      
      const agent = await buyerAgentService.fixAgentWallet(id, req.userId)

      res.status(200).json({
        success: true,
        data: agent,
        message: 'Agent wallet fixed successfully',
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
   * Delete an agent
   * DELETE /api/agents/:id
   */
  async deleteAgent(req: Request, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
        })
        return
      }

      const { id } = req.params

      // Stop agent if running
      agentExecutionService.stopAgent(id)

      // Delete agent
      await buyerAgentService.deleteAgent(id, req.userId)

      res.status(200).json({
        success: true,
        message: 'Agent deleted successfully',
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

