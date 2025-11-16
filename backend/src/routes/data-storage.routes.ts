import { Router } from 'express'
import { DataStorageController } from '../controllers/data-storage.controller.js'
import { authenticate } from '../middleware/auth.middleware.js'

const router = Router()
const dataStorageController = new DataStorageController()

// Protected routes (producer uploads)
router.get(
  '/warehouse/stats',
  authenticate,
  dataStorageController.getWarehouseStats.bind(dataStorageController)
)
router.post(
  '/warehouse/ensure-endpoints',
  authenticate,
  dataStorageController.ensureWarehouseEndpoints.bind(dataStorageController)
)
router.post(
  '/warehouse/create-endpoint',
  authenticate,
  dataStorageController.createEndpointFromWarehouse.bind(dataStorageController)
)

// Public routes (agents can query)
router.get(
  '/producer/:producerId/query',
  dataStorageController.querySellerData.bind(dataStorageController)
)
router.get(
  '/producer/:producerId/sample',
  dataStorageController.getSampleRecords.bind(dataStorageController)
)

export default router

