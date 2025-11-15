import { Request, Response, NextFunction } from 'express'
import { AuthService } from '../services/auth.service.js'
import logger from '../utils/logger.js'

const authService = new AuthService()

// Extend Express Request to include user info
declare global {
  namespace Express {
    interface Request {
      userId?: string
      userEmail?: string
    }
  }
}

/**
 * Authentication middleware
 * Verifies JWT token and attaches user info to request
 */
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.warn(`Auth failed: No token provided for ${req.method} ${req.originalUrl || req.url}`)
      res.status(401).json({
        success: false,
        error: 'No token provided',
      })
      return
    }

    const token = authHeader.substring(7) // Remove 'Bearer ' prefix
    logger.debug(`Verifying token for ${req.method} ${req.originalUrl || req.url}`)

    // Verify token
    const decoded = authService.verifyToken(token)

    // Attach user info to request
    req.userId = decoded.userId
    req.userEmail = decoded.email || undefined

    logger.debug(`Auth successful: User ${decoded.userId}${decoded.email ? ` (${decoded.email})` : ' (wallet auth)'}`)
    next()
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Invalid token'
    logger.error(`Auth failed for ${req.method} ${req.originalUrl || req.url}: ${errorMessage}`)
    res.status(401).json({
      success: false,
      error: errorMessage,
    })
  }
}

