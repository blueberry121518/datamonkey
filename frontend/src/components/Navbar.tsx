import './Navbar.css'

interface NavbarProps {
  scrolled: boolean
  onLoginClick: () => void
  onSignupClick: () => void
  user?: any
  onLogout: () => void
}

function Navbar({ scrolled, onLoginClick, onSignupClick, user, onLogout }: NavbarProps) {
  return (
    <nav className={`navbar ${scrolled ? 'scrolled' : ''}`}>
      <div className="nav-container">
        <div className="nav-logo">
          <span className="logo-icon">🐵</span>
          <span className="logo-text">Data Monkey</span>
        </div>
        <div className="nav-links">
          <a href="#features">Features</a>
          <a href="#how-it-works">How It Works</a>
          <a href="#marketplace">Marketplace</a>
        </div>
        <div className="nav-actions">
          {user ? (
            <>
              <span className="user-email">{user.email}</span>
              <button onClick={onLogout} className="btn-ghost">Log Out</button>
            </>
          ) : (
            <>
              <button onClick={onLoginClick} className="btn-ghost">Log In</button>
              <button onClick={onSignupClick} className="btn-primary">Get Started</button>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}

export default Navbar

