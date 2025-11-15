import { Request, Response } from 'express'
import { AgentActionService } from '../services/agent-action.service.js'

const agentActionService = new AgentActionService()

export class AgentActionController {
  /**
   * Get all actions for an agent
   * GET /api/agent-actions/agent/:agentId
   */
  async getAgentActions(req: Request, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
        })
        return
      }

      const { agentId } = req.params
      const limit = parseInt(req.query.limit as string) || 100

      // Verify agent belongs to user (should be done via service)
      const actions = await agentActionService.getAgentActions(agentId, limit)

      res.status(200).json({
        success: true,
        data: actions,
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
   * Get recent actions (for real-time updates)
   * GET /api/agent-actions/agent/:agentId/recent?since=timestamp
   */
  async getRecentActions(req: Request, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
        })
        return
      }

      const { agentId } = req.params
      const since = req.query.since as string | undefined

      const actions = await agentActionService.getRecentActions(agentId, since)

      res.status(200).json({
        success: true,
        data: actions,
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

