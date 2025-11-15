export interface User {
  id: string
  email: string | null
  created_at: string
  updated_at: string
}

export interface SignupRequest {
  email: string
  password: string
}

export interface LoginRequest {
  email: string
  password: string
}

export interface WalletAuthRequest {
  walletAddress: string
  signature: string
  nonce: string
}

export interface NonceRequest {
  walletAddress: string
}

export interface AuthResponse {
  user: Omit<User, 'password'>
  token: string
}

