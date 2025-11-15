import './Footer.css'

function Footer() {
  return (
    <footer className="footer">
      <div className="footer-content">
        <div className="footer-brand">
          <div className="footer-logo">
            <span className="logo-icon">🐵</span>
            <span className="logo-text">Data Monkey</span>
          </div>
          <p className="footer-tagline">Autonomous data marketplace powered by AI agents</p>
        </div>
        <div className="footer-links">
          <div className="footer-column">
            <h4>Product</h4>
            <a href="#features">Features</a>
            <a href="#how-it-works">How It Works</a>
            <a href="#marketplace">Marketplace</a>
            <a href="#pricing">Pricing</a>
          </div>
          <div className="footer-column">
            <h4>Resources</h4>
            <a href="#docs">Documentation</a>
            <a href="#api">API Reference</a>
            <a href="#guides">Guides</a>
            <a href="#support">Support</a>
          </div>
          <div className="footer-column">
            <h4>Company</h4>
            <a href="#about">About</a>
            <a href="#blog">Blog</a>
            <a href="#careers">Careers</a>
            <a href="#contact">Contact</a>
          </div>
        </div>
      </div>
      <div className="footer-bottom">
        <p>&copy; 2025 Data Monkey. All rights reserved.</p>
        <div className="footer-legal">
          <a href="#privacy">Privacy</a>
          <a href="#terms">Terms</a>
        </div>
      </div>
    </footer>
  )
}

export default Footer

