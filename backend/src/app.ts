import express, { Express, Request, Response, NextFunction } from 'express'
import cors from 'cors'
import authRoutes from './routes/auth.routes.js'
import datasetRoutes from './routes/dataset.routes.js'
import dataStorageRoutes from './routes/data-storage.routes.js'
import agentRoutes from './routes/agent.routes.js'
import fileUploadRoutes from './routes/file-upload.routes.js'
import agentActionRoutes from './routes/agent-actions.routes.js'
import realtimeRoutes from './routes/realtime.routes.js'

const app: Express = express()

// Middleware
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    message: 'Data Monkey API is running',
    timestamp: new Date().toISOString(),
  })
})

// API routes
app.use('/api/auth', authRoutes)
app.use('/api/datasets', datasetRoutes)
app.use('/api/seller/data', dataStorageRoutes)
app.use('/api/seller/files', fileUploadRoutes)
app.use('/api/agents', agentRoutes)
app.use('/api/agent-actions', agentActionRoutes)
app.use('/api/realtime', realtimeRoutes)

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
  })
})

// Error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err)
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  })
})

export default app

