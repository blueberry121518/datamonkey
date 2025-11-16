import express, { Express, Request, Response, NextFunction } from 'express'
import cors from 'cors'
import logger from './utils/logger.js'
import authRoutes from './routes/auth.routes.js'
import datasetRoutes from './routes/dataset.routes.js'
import dataStorageRoutes from './routes/data-storage.routes.js'
import agentRoutes from './routes/agent.routes.js'
import fileUploadRoutes from './routes/file-upload.routes.js'
import agentActionRoutes from './routes/agent-actions.routes.js'

const app: Express = express()

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now()
  
  res.on('finish', () => {
    const duration = Date.now() - start
    const fullPath = req.originalUrl || req.url
    logger.info(`Step: Request completed - ${req.method} ${fullPath} → ${res.statusCode} (${duration}ms)`)
  })
  
  next()
})

// Middleware
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  logger.info(`Step 1: Health check endpoint accessed`)
  logger.info(`Step 2: Returning health status`)
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

// 404 handler
app.use((req: Request, res: Response) => {
  logger.info(`Step 1: Route not found - ${req.method} ${req.path}`)
  logger.info(`Step 2: Returning 404 error response`)
  res.status(404).json({
    success: false,
    error: 'Route not found',
  })
})

// Error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.info(`Step 1: Error caught in ${req.method} ${req.path}`)
  logger.info(`Step 2: Error message: ${err.message}`)
  if (process.env.NODE_ENV === 'development') {
    logger.info(`Step 3: Stack trace: ${err.stack}`)
  }
  logger.info(`Step 4: Returning 500 error response`)
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  })
})

export default app

