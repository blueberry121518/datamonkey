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
  upload.array('files', 10),
  fileUploadController.uploadFiles.bind(fileUploadController)
)

router.post(
  '/suggest-metadata',
  authenticate,
  upload.array('files', 1),
  fileUploadController.suggestMetadata.bind(fileUploadController)
)

export default router

