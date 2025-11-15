import { Router } from 'express'
import { BuyerAgentController } from '../controllers/buyer-agent.controller.js'
import { authenticate } from '../middleware/auth.middleware.js'

const router = Router()
const agentController = new BuyerAgentController()

// Protected routes (require authentication)
router.post('/', authenticate, agentController.createAgent.bind(agentController))
router.get('/', authenticate, agentController.getMyAgents.bind(agentController))
router.get('/:id', authenticate, agentController.getAgent.bind(agentController))
router.patch(
  '/:id/status',
  authenticate,
  agentController.updateAgentStatus.bind(agentController)
)
router.get(
  '/:id/balance',
  authenticate,
  agentController.getAgentBalance.bind(agentController)
)

export default router

