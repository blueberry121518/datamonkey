import { Request, Response } from 'express'
import { AuthService } from '../services/auth.service.js'
import { SignupRequest, LoginRequest } from '../types/auth.js'
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
}

