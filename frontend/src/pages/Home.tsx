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
    const storedToken = localStorage.getItem('token')
    if (storedUser && storedToken) {
      setUser(JSON.parse(storedUser))
    }
  }, [])

  const handleAuthSuccess = (token: string, userData: any) => {
    setUser(userData)
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
  }

  const handleNavigateToDashboard = (view?: 'seller' | 'buyer') => {
    const storedUser = localStorage.getItem('user')
    const storedToken = localStorage.getItem('token')
    
    if (storedUser && storedToken) {
      if (view) {
        navigate(`/dashboard?view=${view}`)
      } else {
        navigate('/dashboard')
      }
    } else {
      setIsSignupOpen(true)
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
        onStartSelling={() => handleNavigateToDashboard('seller')} 
        onLaunchAgent={() => handleNavigateToDashboard('buyer')} 
      />
      <Features />
      <HowItWorks />
      <Marketplace />
      <CTA 
        onStartSelling={() => handleNavigateToDashboard('seller')} 
        onDeployAgent={() => handleNavigateToDashboard('buyer')} 
      />
      <Footer />
      
      <LoginModal
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        onSwitchToSignup={() => setIsSignupOpen(true)}
        onSuccess={handleAuthSuccess}
      />
      
      <SignupModal
        isOpen={isSignupOpen}
        onClose={() => setIsSignupOpen(false)}
        onSwitchToLogin={() => setIsLoginOpen(true)}
        onSuccess={handleAuthSuccess}
      />
    </div>
  )
}

export default Home

