import { Request, Response } from 'express'
import { AuthService } from '../services/auth.service.js'
import { SignupRequest, LoginRequest, WalletAuthRequest, NonceRequest } from '../types/auth.js'
import { z } from 'zod'

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
      // Validate request body
      const validatedData = signupSchema.parse(req.body) as SignupRequest

      // Create user
      const result = await authService.signup(validatedData)

      res.status(201).json({
        success: true,
        data: result,
        message: 'User created successfully',
      })
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.errors,
        })
        return
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      const statusCode = errorMessage.includes('already exists') ? 409 : 500

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
      // Validate request body
      const validatedData = loginSchema.parse(req.body) as LoginRequest

      // Authenticate user
      const result = await authService.login(validatedData)

      res.status(200).json({
        success: true,
        data: result,
        message: 'Login successful',
      })
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.errors,
        })
        return
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      const statusCode = errorMessage.includes('Invalid') ? 401 : 500

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
      const logger = (await import('../utils/logger.js')).default
      logger.info('AuthController: generateNonce request', { 
        body: req.body,
        ip: req.ip 
      })

      // Validate request body
      const validatedData = nonceRequestSchema.parse(req.body) as NonceRequest

      logger.info('AuthController: Generating nonce', { 
        walletAddress: validatedData.walletAddress 
      })

      // Generate nonce
      const nonce = authService.generateNonce(validatedData.walletAddress)

      // Get the domain for the message
      const domain = process.env.AUTH_DOMAIN || 'localhost:8000'
      const message = `Sign in to ${domain}

Wallet Address: ${validatedData.walletAddress.toLowerCase()}
Nonce: ${nonce}

This request will not trigger a blockchain transaction or cost any gas fees.`

      logger.info('AuthController: Nonce generated successfully', { 
        walletAddress: validatedData.walletAddress,
        nonceLength: nonce.length 
      })

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
        res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.errors,
        })
        return
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
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
      const logger = (await import('../utils/logger.js')).default
      logger.info('AuthController: walletLogin request', { 
        walletAddress: req.body?.walletAddress,
        hasSignature: !!req.body?.signature,
        hasNonce: !!req.body?.nonce,
        ip: req.ip 
      })

      // Validate request body
      const validatedData = walletAuthSchema.parse(req.body) as WalletAuthRequest

      logger.info('AuthController: Authenticating wallet', { 
        walletAddress: validatedData.walletAddress,
        nonce: validatedData.nonce.substring(0, 10) + '...'
      })

      // Authenticate with wallet
      const result = await authService.authenticateWithWallet(
        validatedData.walletAddress,
        validatedData.signature,
        validatedData.nonce
      )

      logger.info('AuthController: Wallet authentication successful', { 
        userId: result.user.id,
        walletAddress: validatedData.walletAddress 
      })

      res.status(200).json({
        success: true,
        data: result,
        message: 'Wallet authentication successful',
      })
    } catch (error) {
      if (error instanceof z.ZodError) {
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

      res.status(statusCode).json({
        success: false,
        error: errorMessage,
      })
    }
  }
}

