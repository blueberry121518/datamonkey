import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { ethers } from 'ethers'
import crypto from 'crypto'
import { supabase } from '../config/supabase.js'
import { User, SignupRequest, LoginRequest } from '../types/auth.js'
import { WalletService } from './wallet.service.js'
import logger from '../utils/logger.js'

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-in-production'
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d'
const NONCE_EXPIRY_MS = 15 * 60 * 1000 // 15 minutes

// In-memory nonce storage (in production, use Redis or database)
interface NonceData {
  nonce: string
  walletAddress: string
  expiresAt: number
}

const nonceStore = new Map<string, NonceData>()

// Clean up expired nonces every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, data] of nonceStore.entries()) {
    if (data.expiresAt < now) {
      nonceStore.delete(key)
    }
  }
}, 5 * 60 * 1000)

export class AuthService {
  private walletService: WalletService

  constructor() {
    this.walletService = new WalletService()
  }
  /**
   * Hash a password using bcrypt
   */
  private async hashPassword(password: string): Promise<string> {
    const saltRounds = 10
    return bcrypt.hash(password, saltRounds)
  }

  /**
   * Compare a password with a hash
   */
  private async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash)
  }

  /**
   * Generate JWT token
   */
  private generateToken(userId: string, email: string | null): string {
    return jwt.sign(
      { userId, email: email || null },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    )
  }

  /**
   * Sign up a new user
   */
  async signup(data: SignupRequest): Promise<{ user: User; token: string }> {
    const { email, password } = data

    // Check if user already exists
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', email.toLowerCase())
      .single()

    if (existingUser) {
      throw new Error('User with this email already exists')
    }

    // Hash password
    const hashedPassword = await this.hashPassword(password)

    // Create user
    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert({
        email: email.toLowerCase(),
        password_hash: hashedPassword,
      })
      .select('id, email, created_at, updated_at')
      .single()

    if (insertError) {
      throw new Error(`Failed to create user: ${insertError.message}`)
    }

    // Create CDP wallet for the user
    try {
      await this.walletService.createWallet(newUser.id, `Data Monkey - ${newUser.email}`)
    } catch (walletError) {
      // Log error but don't fail signup - wallet can be created later
      console.error('Failed to create wallet during signup:', walletError)
    }

    // Generate token
    const token = this.generateToken(newUser.id, newUser.email)

    return {
      user: newUser as User,
      token,
    }
  }

  /**
   * Login an existing user
   */
  async login(data: LoginRequest): Promise<{ user: User; token: string }> {
    const { email, password } = data

    // Find user by email
    const { data: user, error: findError } = await supabase
      .from('users')
      .select('id, email, password_hash, created_at, updated_at')
      .eq('email', email.toLowerCase())
      .single()

    if (findError || !user) {
      throw new Error('Invalid email or password')
    }

    // Verify password
    const isValidPassword = await this.comparePassword(password, user.password_hash)
    if (!isValidPassword) {
      throw new Error('Invalid email or password')
    }

    // Generate token
    const token = this.generateToken(user.id, user.email)

    // Return user without password_hash
    const { password_hash, ...userWithoutPassword } = user

    return {
      user: userWithoutPassword as User,
      token,
    }
  }

  /**
   * Verify JWT token
   */
  verifyToken(token: string): { userId: string; email: string | null } {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string | null }
      return decoded
    } catch (error) {
      throw new Error('Invalid or expired token')
    }
  }

  /**
   * Generate a nonce for wallet authentication
   */
  generateNonce(walletAddress: string): string {
    logger.info('AuthService: Generating nonce', { walletAddress })
    
    // Generate a cryptographically secure random nonce
    const nonce = crypto.randomBytes(32).toString('hex')
    
    // Store nonce with expiration
    nonceStore.set(nonce, {
      nonce,
      walletAddress: walletAddress.toLowerCase(),
      expiresAt: Date.now() + NONCE_EXPIRY_MS,
    })

    logger.debug('AuthService: Nonce generated and stored', { 
      nonce: nonce.substring(0, 10) + '...',
      expiresAt: new Date(Date.now() + NONCE_EXPIRY_MS).toISOString()
    })

    return nonce
  }

  /**
   * Verify wallet signature and authenticate user
   */
  async authenticateWithWallet(
    walletAddress: string,
    signature: string,
    nonce: string
  ): Promise<{ user: User; token: string }> {
    logger.info('AuthService: authenticateWithWallet called', { 
      walletAddress,
      nonce: nonce.substring(0, 10) + '...',
      signatureLength: signature.length 
    })

    // Validate and get nonce data
    const nonceData = nonceStore.get(nonce)
    
    if (!nonceData) {
      logger.error('AuthService: Nonce not found in store', { nonce: nonce.substring(0, 10) + '...' })
      throw new Error('Invalid or expired nonce')
    }

    if (nonceData.expiresAt < Date.now()) {
      logger.warn('AuthService: Nonce expired', { 
        nonce: nonce.substring(0, 10) + '...',
        expiredAt: new Date(nonceData.expiresAt).toISOString(),
        now: new Date().toISOString()
      })
      nonceStore.delete(nonce)
      throw new Error('Nonce has expired')
    }

    // Verify wallet address matches
    const normalizedAddress = walletAddress.toLowerCase()
    if (nonceData.walletAddress !== normalizedAddress) {
      logger.error('AuthService: Wallet address mismatch', {
        expected: nonceData.walletAddress,
        received: normalizedAddress
      })
      throw new Error('Wallet address does not match nonce')
    }

    // Create the message that should have been signed
    const domain = process.env.AUTH_DOMAIN || 'localhost:8000'
    const message = `Sign in to ${domain}

Wallet Address: ${normalizedAddress}
Nonce: ${nonce}

This request will not trigger a blockchain transaction or cost any gas fees.`

    try {
      logger.debug('AuthService: Verifying signature', { message })
      
      // Verify the signature
      const recoveredAddress = ethers.verifyMessage(message, signature)
      
      logger.debug('AuthService: Signature recovered', { 
        recoveredAddress, 
        expectedAddress: normalizedAddress 
      })
      
      // Normalize addresses for comparison
      if (recoveredAddress.toLowerCase() !== normalizedAddress) {
        logger.error('AuthService: Signature verification failed - address mismatch', {
          recovered: recoveredAddress.toLowerCase(),
          expected: normalizedAddress
        })
        throw new Error('Signature verification failed')
      }

      logger.info('AuthService: Signature verified successfully')

      // Delete used nonce to prevent replay attacks
      nonceStore.delete(nonce)

      // Find or create user by wallet address
      let user = await this.findUserByWalletAddress(normalizedAddress)

      if (!user) {
        // Create new user with wallet address
        user = await this.createUserFromWallet(normalizedAddress)
      }

      // Generate JWT token
      const token = this.generateToken(user.id, user.email || '')

      return {
        user,
        token,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Signature verification failed'
      throw new Error(`Authentication failed: ${errorMessage}`)
    }
  }

  /**
   * Find user by wallet address
   */
  private async findUserByWalletAddress(walletAddress: string): Promise<User | null> {
    const { data, error } = await supabase
      .from('users')
      .select('id, email, created_at, updated_at')
      .eq('wallet_address', walletAddress.toLowerCase())
      .single()

    if (error || !data) {
      return null
    }

    return data as User
  }

  /**
   * Create a new user from wallet address
   */
  private async createUserFromWallet(walletAddress: string): Promise<User> {
    // Create user with wallet address
    // Email is optional for wallet-only users
    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert({
        wallet_address: walletAddress.toLowerCase(),
        email: null, // Can be null for wallet-only auth
      })
      .select('id, email, created_at, updated_at')
      .single()

    if (insertError) {
      throw new Error(`Failed to create user: ${insertError.message}`)
    }

    return newUser as User
  }

  /**
   * Get or create user wallet info (for Coinbase CDP Embedded Wallets)
   * This method links a CDP embedded wallet address to a user
   */
  async linkWalletToUser(walletAddress: string, email?: string): Promise<User> {
    const normalizedAddress = walletAddress.toLowerCase()

    // Check if user exists with this wallet
    let user = await this.findUserByWalletAddress(normalizedAddress)

    if (user) {
      // If email provided and different, update it
      if (email && user.email !== email) {
        const { data: updatedUser, error } = await supabase
          .from('users')
          .update({ email: email.toLowerCase() })
          .eq('id', user.id)
          .select('id, email, created_at, updated_at')
          .single()

        if (!error && updatedUser) {
          return updatedUser as User
        }
      }
      return user
    }

    // Check if user exists with this email (if provided)
    if (email) {
      const { data: existingUser } = await supabase
        .from('users')
        .select('id, email, wallet_address, created_at, updated_at')
        .eq('email', email.toLowerCase())
        .single()

      if (existingUser) {
        // Link wallet to existing user
        const { data: updatedUser, error } = await supabase
          .from('users')
          .update({ wallet_address: normalizedAddress })
          .eq('id', existingUser.id)
          .select('id, email, created_at, updated_at')
          .single()

        if (!error && updatedUser) {
          return updatedUser as User
        }
      }
    }

    // Create new user
    return await this.createUserFromWallet(normalizedAddress)
  }
}

