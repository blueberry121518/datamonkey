import express, { Express, Request, Response, NextFunction } from 'express'
import cors from 'cors'
import logger from './utils/logger.js'
import authRoutes from './routes/auth.routes.js'
import datasetRoutes from './routes/dataset.routes.js'
import dataStorageRoutes from './routes/data-storage.routes.js'
import agentRoutes from './routes/agent.routes.js'
import fileUploadRoutes from './routes/file-upload.routes.js'
import agentActionRoutes from './routes/agent-actions.routes.js'
import realtimeRoutes from './routes/realtime.routes.js'

const app: Express = express()

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now()
  
  res.on('finish', () => {
    const duration = Date.now() - start
    const statusEmoji = res.statusCode >= 400 ? '❌' : res.statusCode >= 300 ? '⚠️' : '✅'
    const fullPath = req.originalUrl || req.url
    logger.info(`${statusEmoji} ${req.method} ${fullPath} → ${res.statusCode} (${duration}ms)`)
  })
  
  next()
})

// Middleware
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  logger.debug('Health check requested')
  res.status(200).json({
    status: 'ok',
    message: 'Data Monkey API is running',
    timestamp: new Date().toISOString(),
  })
})

// API routes
app.use('/api/auth', authRoutes)
app.use('/api/datasets', datasetRoutes)
app.use('/api/producer/data', dataStorageRoutes)
app.use('/api/producer/files', fileUploadRoutes)
app.use('/api/agents', agentRoutes)
app.use('/api/agent-actions', agentActionRoutes)
app.use('/api/realtime', realtimeRoutes)

// 404 handler
app.use((req: Request, res: Response) => {
  logger.warn(`404 Not Found: ${req.method} ${req.path}`)
  res.status(404).json({
    success: false,
    error: 'Route not found',
  })
})

// Error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error(`Error in ${req.method} ${req.path}: ${err.message}`)
  if (process.env.NODE_ENV === 'development') {
    console.error('Stack trace:', err.stack)
  }
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  })
})

export default app

