import app from './app.js'
import dotenv from 'dotenv'
import logger from './utils/logger.js'

dotenv.config()

const PORT = process.env.PORT || 8000

const server = app.listen(PORT, () => {
  logger.info(`Step 1: Server initialization complete`)
  logger.info(`Step 2: Server listening on port ${PORT}`)
  logger.info(`Step 3: Environment: ${process.env.NODE_ENV || 'development'}`)
  logger.info(`Step 4: Health check endpoint: http://localhost:${PORT}/health`)
  logger.info(`Step 5: Auth endpoint: http://localhost:${PORT}/api/auth/signup`)
  logger.info(`Step 6: Server ready to accept connections`)
})

// Simple force kill on shutdown signals - no graceful shutdown complexity
process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, force killing...')
  process.exit(0)
})

process.on('SIGINT', () => {
  logger.info('Received SIGINT, force killing...')
  process.exit(0)
})


