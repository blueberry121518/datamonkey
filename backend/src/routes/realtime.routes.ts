import { Router, Request, Response, NextFunction } from 'express'
import { AgentActionService } from '../services/agent-action.service.js'
import { AuthService } from '../services/auth.service.js'

const router = Router()
const agentActionService = new AgentActionService()
const authService = new AuthService()

/**
 * Custom auth middleware for SSE (supports token in query param)
 */
const authenticateSSE = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Try to get token from query parameter (for SSE)
    const token = (req.query.token as string) || req.headers.authorization?.replace('Bearer ', '')

    if (!token) {
      res.status(401).json({ success: false, error: 'Unauthorized' })
      return
    }

    const decoded = authService.verifyToken(token)
    ;(req as any).userId = decoded.userId
    next()
  } catch (error) {
    res.status(401).json({ success: false, error: 'Invalid token' })
  }
}

/**
 * Server-Sent Events (SSE) endpoint for real-time agent action updates
 * GET /api/realtime/agent/:agentId?token=xxx
 */
router.get(
  '/agent/:agentId',
  authenticateSSE,
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

