import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Modal from './Modal'
import './AuthModal.css'

interface SignupModalProps {
  isOpen: boolean
  onClose: () => void
  onSwitchToLogin: () => void
  onSuccess?: (token: string, user: any) => void
}

function SignupModal({ isOpen, onClose, onSwitchToLogin, onSuccess }: SignupModalProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Client-side validation
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    setLoading(true)

    try {
      const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'
      const response = await fetch(`${API_BASE_URL}/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      if (!response.ok) {
        // Handle validation errors
        if (data.details && Array.isArray(data.details)) {
          const errorMessages = data.details.map((d: any) => d.message).join(', ')
          throw new Error(errorMessages)
        }
        throw new Error(data.error || 'Signup failed')
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
        setConfirmPassword('')
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
    <Modal isOpen={isOpen} onClose={onClose} title="Create Account">
      <form onSubmit={handleSubmit} className="auth-form">
        {error && <div className="auth-error">{error}</div>}
        
        <div className="form-group">
          <label htmlFor="signup-email">Email</label>
          <input
            id="signup-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            disabled={loading}
          />
        </div>

        <div className="form-group">
          <label htmlFor="signup-password">Password</label>
          <input
            id="signup-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            required
            disabled={loading}
            minLength={8}
          />
        </div>

        <div className="form-group">
          <label htmlFor="signup-confirm-password">Confirm Password</label>
          <input
            id="signup-confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm your password"
            required
            disabled={loading}
            minLength={8}
          />
        </div>

        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Creating account...' : 'Sign Up'}
        </button>

        <div className="auth-switch">
          <span>Already have an account? </span>
          <button
            type="button"
            className="auth-link"
            onClick={() => {
              onClose()
              onSwitchToLogin()
            }}
          >
            Log in
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default SignupModal

