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
    logger.info(`Step 1: Authentication middleware started for ${req.method} ${req.originalUrl || req.url}`)
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.info(`Step 2: No authorization token found`)
      logger.info(`Step 3: Returning 401 unauthorized response`)
      res.status(401).json({
        success: false,
        error: 'No token provided',
      })
      return
    }

    const token = authHeader.substring(7) // Remove 'Bearer ' prefix
    logger.info(`Step 2: Authorization token extracted`)

    // Verify token
    logger.info(`Step 3: Verifying token`)
    const decoded = authService.verifyToken(token)
    logger.info(`Step 4: Token verified successfully`)

    // Attach user info to request
    req.userId = decoded.userId
    req.userEmail = decoded.email || undefined
    logger.info(`Step 5: User info attached to request - userId: ${decoded.userId}`)
    logger.info(`Step 6: Authentication successful, proceeding to next middleware`)
    next()
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Invalid token'
    logger.info(`Step 1: Authentication error occurred`)
    logger.info(`Step 2: Error message: ${errorMessage}`)
    logger.info(`Step 3: Returning 401 unauthorized response`)
    res.status(401).json({
      success: false,
      error: errorMessage,
    })
  }
}

