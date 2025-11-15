import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { supabase } from '../config/supabase.js'
import { User, SignupRequest, LoginRequest } from '../types/auth.js'

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-in-production'
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d'

export class AuthService {
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
  private generateToken(userId: string, email: string): string {
    return jwt.sign(
      { userId, email },
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
  verifyToken(token: string): { userId: string; email: string } {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string }
      return decoded
    } catch (error) {
      throw new Error('Invalid or expired token')
    }
  }
}

