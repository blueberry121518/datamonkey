import { Router } from 'express'
import { DatasetController } from '../controllers/dataset.controller.js'
import { authenticate } from '../middleware/auth.middleware.js'
import { x402PaymentMiddleware } from '../middleware/x402.middleware.js'

const router = Router()
const datasetController = new DatasetController()

// Public routes
router.get('/', datasetController.getActiveDatasets.bind(datasetController))

// Protected routes (require authentication) - must come before /:id routes
router.post('/', authenticate, datasetController.createDataset.bind(datasetController))
router.get('/my', authenticate, datasetController.getMyDatasets.bind(datasetController))

// Public routes with IDs
router.get('/:id/probe', datasetController.probeDataset.bind(datasetController))
router.get('/:id', datasetController.getDataset.bind(datasetController))

// x402 Payment-protected route (serves dataset data after payment)
router.get(
  '/:id/data',
  x402PaymentMiddleware,
  datasetController.serveDataset.bind(datasetController)
)

// Protected routes with IDs
router.put('/:id', authenticate, datasetController.updateDataset.bind(datasetController))
router.delete('/:id', authenticate, datasetController.deleteDataset.bind(datasetController))
router.get('/:id/interactions', authenticate, datasetController.getDatasetInteractions.bind(datasetController))
router.get('/:id/sample', authenticate, datasetController.getDatasetSample.bind(datasetController))

export default router

