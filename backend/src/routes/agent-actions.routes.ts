import { Router } from 'express'
import { AgentActionController } from '../controllers/agent-action.controller.js'
import { authenticate } from '../middleware/auth.middleware.js'

const router = Router()
const agentActionController = new AgentActionController()

// Protected routes
router.get(
  '/agent/:agentId',
  authenticate,
  agentActionController.getAgentActions.bind(agentActionController)
)

router.get(
  '/agent/:agentId/recent',
  authenticate,
  agentActionController.getRecentActions.bind(agentActionController)
)

export default router

