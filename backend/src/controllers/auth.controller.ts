import { Request, Response } from 'express'
import { AuthService } from '../services/auth.service.js'
import { SignupRequest, LoginRequest, WalletAuthRequest, NonceRequest } from '../types/auth.js'
import { z } from 'zod'
import logger from '../utils/logger.js'

const authService = new AuthService()

// Validation schemas
const signupSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

const nonceRequestSchema = z.object({
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid wallet address'),
})

const walletAuthSchema = z.object({
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid wallet address'),
  signature: z.string().min(1, 'Signature is required'),
  nonce: z.string().min(1, 'Nonce is required'),
})

export class AuthController {
  /**
   * Sign up a new user
   * POST /api/auth/signup
   */
  async signup(req: Request, res: Response): Promise<void> {
    try {
      logger.info(`Step 1: Signup request received`)
      // Validate request body
      logger.info(`Step 2: Validating request body`)
      const validatedData = signupSchema.parse(req.body) as SignupRequest
      logger.info(`Step 3: Request body validated successfully`)

      // Create user
      logger.info(`Step 4: Creating user account`)
      const result = await authService.signup(validatedData)
      logger.info(`Step 5: User account created successfully - userId: ${result.user.id}`)
      logger.info(`Step 6: Returning success response`)

      res.status(201).json({
        success: true,
        data: result,
        message: 'User created successfully',
      })
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.info(`Step 1: Validation error occurred`)
        logger.info(`Step 2: Returning 400 validation error response`)
        res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.errors,
        })
        return
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      const statusCode = errorMessage.includes('already exists') ? 409 : 500
      logger.info(`Step 1: Error occurred: ${errorMessage}`)
      logger.info(`Step 2: Returning ${statusCode} error response`)

      res.status(statusCode).json({
        success: false,
        error: errorMessage,
      })
    }
  }

  /**
   * Login an existing user
   * POST /api/auth/login
   */
  async login(req: Request, res: Response): Promise<void> {
    try {
      logger.info(`Step 1: Login request received`)
      // Validate request body
      logger.info(`Step 2: Validating request body`)
      const validatedData = loginSchema.parse(req.body) as LoginRequest
      logger.info(`Step 3: Request body validated successfully`)

      // Authenticate user
      logger.info(`Step 4: Authenticating user credentials`)
      const result = await authService.login(validatedData)
      logger.info(`Step 5: User authenticated successfully - userId: ${result.user.id}`)
      logger.info(`Step 6: Returning success response`)

      res.status(200).json({
        success: true,
        data: result,
        message: 'Login successful',
      })
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.info(`Step 1: Validation error occurred`)
        logger.info(`Step 2: Returning 400 validation error response`)
        res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.errors,
        })
        return
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      const statusCode = errorMessage.includes('Invalid') ? 401 : 500
      logger.info(`Step 1: Error occurred: ${errorMessage}`)
      logger.info(`Step 2: Returning ${statusCode} error response`)

      res.status(statusCode).json({
        success: false,
        error: errorMessage,
      })
    }
  }

  /**
   * Generate a nonce for wallet authentication
   * POST /api/auth/wallet/nonce
   */
  async generateNonce(req: Request, res: Response): Promise<void> {
    try {
      logger.info(`Step 1: Generate nonce request received`)
      // Validate request body
      logger.info(`Step 2: Validating wallet address`)
      const validatedData = nonceRequestSchema.parse(req.body) as NonceRequest
      logger.info(`Step 3: Wallet address validated: ${validatedData.walletAddress}`)

      // Generate nonce
      logger.info(`Step 4: Generating nonce for wallet`)
      const nonce = authService.generateNonce(validatedData.walletAddress)
      logger.info(`Step 5: Nonce generated successfully`)

      // Get the domain for the message
      const domain = process.env.AUTH_DOMAIN || 'localhost:8000'
      const message = `Sign in to ${domain}

Wallet Address: ${validatedData.walletAddress.toLowerCase()}
Nonce: ${nonce}

This request will not trigger a blockchain transaction or cost any gas fees.`
      logger.info(`Step 6: Authentication message created`)

      logger.info(`Step 7: Returning nonce response`)
      res.status(200).json({
        success: true,
        data: {
          nonce,
          message,
          walletAddress: validatedData.walletAddress,
        },
      })
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.info(`Step 1: Validation error occurred`)
        logger.info(`Step 2: Returning 400 validation error response`)
        res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.errors,
        })
        return
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.info(`Step 1: Error occurred: ${errorMessage}`)
      logger.info(`Step 2: Returning 500 error response`)
      res.status(500).json({
        success: false,
        error: errorMessage,
      })
    }
  }

  /**
   * Authenticate with wallet signature
   * POST /api/auth/wallet/login
   */
  async walletLogin(req: Request, res: Response): Promise<void> {
    try {
      logger.info(`Step 1: Wallet login request received`)
      // Validate request body
      logger.info(`Step 2: Validating wallet authentication data`)
      const validatedData = walletAuthSchema.parse(req.body) as WalletAuthRequest
      logger.info(`Step 3: Wallet authentication data validated`)

      // Authenticate with wallet
      logger.info(`Step 4: Verifying wallet signature`)
      const result = await authService.authenticateWithWallet(
        validatedData.walletAddress,
        validatedData.signature,
        validatedData.nonce
      )
      logger.info(`Step 5: Wallet signature verified successfully`)
      logger.info(`Step 6: User authenticated - userId: ${result.user.id}`)
      logger.info(`Step 7: Returning success response`)

      res.status(200).json({
        success: true,
        data: result,
        message: 'Wallet authentication successful',
      })
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.info(`Step 1: Validation error occurred`)
        logger.info(`Step 2: Returning 400 validation error response`)
        res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.errors,
        })
        return
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      const statusCode = 
        errorMessage.includes('Invalid') || 
        errorMessage.includes('expired') || 
        errorMessage.includes('failed') 
          ? 401 
          : 500
      logger.info(`Step 1: Error occurred: ${errorMessage}`)
      logger.info(`Step 2: Returning ${statusCode} error response`)

      res.status(statusCode).json({
        success: false,
        error: errorMessage,
      })
    }
  }
}

