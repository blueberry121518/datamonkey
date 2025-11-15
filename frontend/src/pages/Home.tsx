import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import Hero from '../components/Hero'
import Features from '../components/Features'
import HowItWorks from '../components/HowItWorks'
import Marketplace from '../components/Marketplace'
import CTA from '../components/CTA'
import Footer from '../components/Footer'
import LoginModal from '../components/LoginModal'
import SignupModal from '../components/SignupModal'

function Home() {
  const [scrolled, setScrolled] = useState(false)
  const [isLoginOpen, setIsLoginOpen] = useState(false)
  const [isSignupOpen, setIsSignupOpen] = useState(false)
  const [user, setUser] = useState<any>(null)
  const navigate = useNavigate()

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    // Check if user is already logged in
    const storedUser = localStorage.getItem('user')
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser)
        if (user.token) {
          setUser(user)
        }
      } catch {
        // Invalid JSON, ignore
      }
    }
  }, [])

  const handleAuthSuccess = (_token: string, userData: any) => {
    setUser(userData)
  }

  const handleLogout = () => {
    localStorage.removeItem('user')
    localStorage.removeItem('token') // Remove for backwards compatibility
    setUser(null)
  }

  const handleNavigateToDashboard = (view?: 'producer' | 'consumer') => {
    const storedUser = localStorage.getItem('user')
    
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser)
        if (user.token) {
          if (view) {
            navigate(`/dashboard?view=${view}`)
          } else {
            navigate('/dashboard')
          }
          return
        }
      } catch {
        // Invalid JSON, continue to signup
      }
    }
    
    // Not logged in - store intended view and open login
    if (view) {
      setIsLoginOpen(true)
      // Store the intended view in sessionStorage to use after login
      if (view) {
        sessionStorage.setItem('intendedView', view)
      }
    }
  }

  return (
    <div className="App">
      <Navbar 
        scrolled={scrolled} 
        onLoginClick={() => setIsLoginOpen(true)}
        onSignupClick={() => setIsSignupOpen(true)}
        user={user}
        onLogout={handleLogout}
      />
      <Hero 
        onStartSelling={() => handleNavigateToDashboard('producer')} 
        onLaunchAgent={() => handleNavigateToDashboard('consumer')} 
      />
      <Features />
      <HowItWorks />
      <Marketplace />
      <CTA 
        onStartSelling={() => handleNavigateToDashboard('producer')} 
        onDeployAgent={() => handleNavigateToDashboard('consumer')} 
      />
      <Footer />
      
      <LoginModal
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        onSwitchToSignup={() => {
          setIsLoginOpen(false)
          setIsSignupOpen(true)
        }}
        onSuccess={handleAuthSuccess}
      />
      
      <SignupModal
        isOpen={isSignupOpen}
        onClose={() => setIsSignupOpen(false)}
        onSwitchToLogin={() => {
          setIsSignupOpen(false)
          setIsLoginOpen(true)
        }}
        onSuccess={handleAuthSuccess}
      />
    </div>
  )
}

export default Home

