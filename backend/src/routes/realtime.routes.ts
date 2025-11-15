import { Router, Request, Response } from 'express'
import { authenticate } from '../middleware/auth.middleware.js'
import { AgentActionService } from '../services/agent-action.service.js'

const router = Router()
const agentActionService = new AgentActionService()

/**
 * Server-Sent Events (SSE) endpoint for real-time agent action updates
 * GET /api/realtime/agent/:agentId
 */
router.get(
  '/agent/:agentId',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const { agentId } = req.params

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no') // Disable nginx buffering

    // Send initial connection message
    res.write(`data: ${JSON.stringify({ type: 'connected', agentId })}\n\n`)

    let lastCheck = new Date().toISOString()

    // Poll for new actions every 2 seconds
    const interval = setInterval(async () => {
      try {
        const recentActions = await agentActionService.getRecentActions(agentId, lastCheck)

        if (recentActions.length > 0) {
          // Update last check time
          lastCheck = new Date().toISOString()

          // Send each new action
          for (const action of recentActions) {
            res.write(`data: ${JSON.stringify({ type: 'action', data: action })}\n\n`)
          }
        }
      } catch (error) {
        console.error('SSE error:', error)
        res.write(`data: ${JSON.stringify({ type: 'error', message: 'Failed to fetch actions' })}\n\n`)
      }
    }, 2000) // Poll every 2 seconds

    // Clean up on client disconnect
    req.on('close', () => {
      clearInterval(interval)
      res.end()
    })
  }
)

export default router

