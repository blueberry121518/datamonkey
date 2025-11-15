import { Router } from 'express'
import { DataStorageController } from '../controllers/data-storage.controller.js'
import { authenticate } from '../middleware/auth.middleware.js'

const router = Router()
const dataStorageController = new DataStorageController()

// Protected routes (seller uploads)
router.post(
  '/upload',
  authenticate,
  dataStorageController.uploadData.bind(dataStorageController)
)
router.get(
  '/count',
  authenticate,
  dataStorageController.getDataCount.bind(dataStorageController)
)

// Public routes (agents can query)
router.get(
  '/seller/:sellerId/query',
  dataStorageController.querySellerData.bind(dataStorageController)
)
router.get(
  '/seller/:sellerId/sample',
  dataStorageController.getSampleRecords.bind(dataStorageController)
)

export default router

