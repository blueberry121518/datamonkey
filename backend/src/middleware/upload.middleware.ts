import multer from 'multer'
import path from 'path'
import { Request } from 'express'

// Configure multer for file uploads
const storage = multer.memoryStorage() // Store in memory for processing

export const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
  },
  fileFilter: (req: Request, file, cb) => {
    // Accept all file types
    cb(null, true)
  },
})

// Helper to get file type from mime type
export function getFileType(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType.startsWith('video/')) return 'video'
  if (mimeType.startsWith('audio/')) return 'audio'
  if (mimeType === 'application/json') return 'json'
  if (mimeType === 'text/csv' || mimeType === 'application/csv') return 'csv'
  if (mimeType.startsWith('text/')) return 'text'
  if (mimeType === 'application/pdf') return 'pdf'
  return 'unknown'
}

