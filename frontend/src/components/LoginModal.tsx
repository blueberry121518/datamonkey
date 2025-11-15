import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Modal from './Modal'
import './AuthModal.css'

interface LoginModalProps {
  isOpen: boolean
  onClose: () => void
  onSwitchToSignup: () => void
  onSuccess?: (token: string, user: any) => void
}

function LoginModal({ isOpen, onClose, onSwitchToSignup, onSuccess }: LoginModalProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Login failed')
      }

      if (data.success && data.data) {
        // Store token inside user object for consistency with ApiClient
        const userWithToken = {
          ...data.data.user,
          token: data.data.token,
        }
        localStorage.setItem('user', JSON.stringify(userWithToken))
        
        if (onSuccess) {
          onSuccess(data.data.token, data.data.user)
        }
        
        onClose()
        // Reset form
        setEmail('')
        setPassword('')
        // Navigate to dashboard
        navigate('/dashboard')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Log In">
      <form onSubmit={handleSubmit} className="auth-form">
        {error && <div className="auth-error">{error}</div>}
        
        <div className="form-group">
          <label htmlFor="login-email">Email</label>
          <input
            id="login-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            disabled={loading}
          />
        </div>

        <div className="form-group">
          <label htmlFor="login-password">Password</label>
          <input
            id="login-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            required
            disabled={loading}
            minLength={1}
          />
        </div>

        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Logging in...' : 'Log In'}
        </button>

        <div className="auth-switch">
          <span>Don't have an account? </span>
          <button
            type="button"
            className="auth-link"
            onClick={() => {
              onClose()
              onSwitchToSignup()
            }}
          >
            Sign up
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default LoginModal

