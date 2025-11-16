import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import LoginModal from './LoginModal'
import SignupModal from './SignupModal'
import SellerView from './SellerView'
import BuyerView from './BuyerView'
import ProfileMenu from './ProfileMenu'
import './Dashboard.css'

function Dashboard() {
  const [user, setUser] = useState<any>(null)
  const [searchParams] = useSearchParams()
  const initialView = (searchParams.get('view') as 'producer' | 'consumer') || 'producer'
  const [view, setView] = useState<'producer' | 'consumer'>(initialView)
  const [isLoginOpen, setIsLoginOpen] = useState(false)
  const [isSignupOpen, setIsSignupOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    // Check if user is logged in
    const storedUser = localStorage.getItem('user')
    
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser)
        if (user.token) {
          setUser(user)
          setIsLoading(false)
          
          // Endpoints are automatically maintained when data is uploaded
          // No need to call ensureWarehouseEndpoints on page load
          
          // Check if there's an intended view from sessionStorage (after login)
          const intendedView = sessionStorage.getItem('intendedView')
          if (intendedView && (intendedView === 'producer' || intendedView === 'consumer')) {
            setView(intendedView)
            sessionStorage.removeItem('intendedView')
            navigate(`/dashboard?view=${intendedView}`, { replace: true })
          }
          return
        }
      } catch {
        // Invalid JSON, continue to show login
      }
    }
    
    setIsLoading(false)
    // Show login modal if not authenticated
    setIsLoginOpen(true)
  }, [])
  
  // Update view when URL param changes
  useEffect(() => {
    const viewParam = searchParams.get('view')
    if (viewParam === 'producer' || viewParam === 'consumer') {
      setView(viewParam)
    }
  }, [searchParams])

  const handleAuthSuccess = async (_token: string, userData: any) => {
    setUser(userData)
    setIsLoginOpen(false)
    setIsSignupOpen(false)
    
    // Endpoints are automatically maintained when data is uploaded
    // No need to call ensureWarehouseEndpoints on login
    
    // Check if there's an intended view from sessionStorage
    const intendedView = sessionStorage.getItem('intendedView')
    if (intendedView && (intendedView === 'producer' || intendedView === 'consumer')) {
      setView(intendedView)
      sessionStorage.removeItem('intendedView')
      navigate(`/dashboard?view=${intendedView}`, { replace: true })
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('user')
    localStorage.removeItem('token') // Remove for backwards compatibility
    setUser(null)
    navigate('/')
  }

  if (isLoading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-spinner"></div>
      </div>
    )
  }

  if (!user) {
    return (
      <>
        <div className="dashboard-auth-required">
          <div className="auth-prompt">
            <h2>Authentication Required</h2>
            <p>Please log in to access the dashboard.</p>
          </div>
        </div>
        <LoginModal
          isOpen={isLoginOpen}
          onClose={() => {
            setIsLoginOpen(false)
            navigate('/')
          }}
          onSwitchToSignup={() => {
            setIsLoginOpen(false)
            setIsSignupOpen(true)
          }}
          onSuccess={handleAuthSuccess}
        />
        <SignupModal
          isOpen={isSignupOpen}
          onClose={() => {
            setIsSignupOpen(false)
            navigate('/')
          }}
          onSwitchToLogin={() => {
            setIsSignupOpen(false)
            setIsLoginOpen(true)
          }}
          onSuccess={handleAuthSuccess}
        />
      </>
    )
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div className="dashboard-header-left">
          <h1 className="dashboard-title">DataMonkey</h1>
        </div>
        <div className="dashboard-header-right">
          <div className="view-toggle">
            <button
              className={`toggle-btn ${view === 'producer' ? 'active' : ''}`}
              onClick={() => setView('producer')}
            >
              <span className="toggle-icon">🍌</span>
              Producer
            </button>
            <button
              className={`toggle-btn ${view === 'consumer' ? 'active' : ''}`}
              onClick={() => setView('consumer')}
            >
              <span className="toggle-icon">🐵</span>
              Consumer
            </button>
          </div>
          <ProfileMenu user={user} onLogout={handleLogout} />
        </div>
      </div>

      <div className="dashboard-content">
        {view === 'producer' ? <SellerView /> : <BuyerView />}
      </div>
    </div>
  )
}

export default Dashboard

