import { Router } from 'express'
import { BuyerAgentController } from '../controllers/buyer-agent.controller.js'
import { authenticate } from '../middleware/auth.middleware.js'
import { upload } from '../middleware/upload.middleware.js'

const router = Router()
const agentController = new BuyerAgentController()

// Protected routes (require authentication)
router.post(
  '/generate-config',
  authenticate,
  upload.single('file'),
  agentController.generateAgentConfig.bind(agentController)
)
router.post('/', authenticate, agentController.createAgent.bind(agentController))
router.get('/', authenticate, agentController.getMyAgents.bind(agentController))
router.get('/:id', authenticate, agentController.getAgent.bind(agentController))
router.get(
  '/:id/balance',
  authenticate,
  agentController.getAgentBalance.bind(agentController)
)
router.post(
  '/:id/start',
  authenticate,
  agentController.startAgent.bind(agentController)
)
router.post(
  '/:id/stop',
  authenticate,
  agentController.stopAgent.bind(agentController)
)
router.delete(
  '/:id',
  authenticate,
  agentController.deleteAgent.bind(agentController)
)

export default router

