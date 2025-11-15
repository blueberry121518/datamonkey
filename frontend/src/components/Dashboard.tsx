import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import LoginModal from './LoginModal'
import SignupModal from './SignupModal'
import SellerView from './SellerView'
import BuyerView from './BuyerView'
import './Dashboard.css'

function Dashboard() {
  const [user, setUser] = useState<any>(null)
  const [searchParams] = useSearchParams()
  const initialView = (searchParams.get('view') as 'seller' | 'buyer') || 'seller'
  const [view, setView] = useState<'seller' | 'buyer'>(initialView)
  const [isLoginOpen, setIsLoginOpen] = useState(false)
  const [isSignupOpen, setIsSignupOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    // Check if user is logged in
    const storedUser = localStorage.getItem('user')
    const storedToken = localStorage.getItem('token')
    
    if (storedUser && storedToken) {
      setUser(JSON.parse(storedUser))
      setIsLoading(false)
      
      // Check if there's an intended view from sessionStorage (after login)
      const intendedView = sessionStorage.getItem('intendedView')
      if (intendedView && (intendedView === 'seller' || intendedView === 'buyer')) {
        setView(intendedView)
        sessionStorage.removeItem('intendedView')
      }
    } else {
      setIsLoading(false)
      // Show login modal if not authenticated
      setIsLoginOpen(true)
    }
  }, [])
  
  // Update view when URL param changes
  useEffect(() => {
    const viewParam = searchParams.get('view')
    if (viewParam === 'seller' || viewParam === 'buyer') {
      setView(viewParam)
    }
  }, [searchParams])

  const handleAuthSuccess = (token: string, userData: any) => {
    setUser(userData)
    setIsLoginOpen(false)
    setIsSignupOpen(false)
    
    // Check if there's an intended view from sessionStorage
    const intendedView = sessionStorage.getItem('intendedView')
    if (intendedView && (intendedView === 'seller' || intendedView === 'buyer')) {
      setView(intendedView)
      sessionStorage.removeItem('intendedView')
      navigate(`/dashboard?view=${intendedView}`, { replace: true })
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
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
            <p>Please log in or sign up to access the dashboard.</p>
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
          <h1 className="dashboard-title">Dashboard</h1>
          <span className="dashboard-user">{user.email}</span>
        </div>
        <div className="dashboard-header-right">
          <div className="view-toggle">
            <button
              className={`toggle-btn ${view === 'seller' ? 'active' : ''}`}
              onClick={() => setView('seller')}
            >
              <span className="toggle-icon">📊</span>
              Seller
            </button>
            <button
              className={`toggle-btn ${view === 'buyer' ? 'active' : ''}`}
              onClick={() => setView('buyer')}
            >
              <span className="toggle-icon">🤖</span>
              Buyer
            </button>
          </div>
          <button onClick={handleLogout} className="btn-ghost">
            Log Out
          </button>
        </div>
      </div>

      <div className="dashboard-content">
        {view === 'seller' ? <SellerView /> : <BuyerView />}
      </div>
    </div>
  )
}

export default Dashboard

