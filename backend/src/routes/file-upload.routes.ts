import { Router } from 'express'
import { FileUploadController } from '../controllers/file-upload.controller.js'
import { authenticate } from '../middleware/auth.middleware.js'
import { upload } from '../middleware/upload.middleware.js'

const router = Router()
const fileUploadController = new FileUploadController()

// Protected routes (require authentication)
router.post(
  '/upload',
  authenticate,
  upload.array('files', 10), // Max 10 files at once
  fileUploadController.uploadFiles.bind(fileUploadController)
)

router.get(
  '/view',
  authenticate,
  fileUploadController.viewAllData.bind(fileUploadController)
)

router.get(
  '/records',
  authenticate,
  fileUploadController.getDataRecords.bind(fileUploadController)
)

export default router

