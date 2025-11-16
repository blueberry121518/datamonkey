import { useState, useRef, useEffect } from 'react'
import './ProfileMenu.css'

interface ProfileMenuProps {
  user: {
    email: string
    [key: string]: any
  }
  onLogout: () => void
}

function ProfileMenu({ user, onLogout }: ProfileMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleMenuItemClick = (action: string) => {
    setIsOpen(false)
    if (action === 'logout') {
      onLogout()
    } else if (action === 'settings') {
      // TODO: Navigate to settings
    } else if (action === 'docs') {
      // TODO: Open docs
      window.open('https://docs.datamonkey.com', '_blank')
    }
  }

  // Get initials from email
  const getInitials = (email: string) => {
    const parts = email.split('@')[0]
    if (parts.length >= 2) {
      return parts.substring(0, 2).toUpperCase()
    }
    return email.substring(0, 1).toUpperCase()
  }

  return (
    <div className="profile-menu" ref={menuRef}>
      <button
        className="profile-button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Profile menu"
      >
        <div className="profile-avatar">
          {getInitials(user.email)}
        </div>
      </button>

      {isOpen && (
        <div className="profile-dropdown">
          <div className="profile-dropdown-header">
            <div className="profile-dropdown-avatar">
              {getInitials(user.email)}
            </div>
            <div className="profile-dropdown-info">
              <div className="profile-dropdown-email">{user.email.split('@')[0]}</div>
            </div>
          </div>
          <div className="profile-dropdown-divider"></div>
          <div className="profile-dropdown-menu">
            <button
              className="profile-menu-item"
              onClick={() => handleMenuItemClick('settings')}
            >
              <span className="menu-icon">🐵</span>
              <span>Settings</span>
            </button>
            <button
              className="profile-menu-item"
              onClick={() => handleMenuItemClick('docs')}
            >
              <span className="menu-icon">🌿</span>
              <span>Docs</span>
            </button>
            <div className="profile-dropdown-divider"></div>
            <button
              className="profile-menu-item danger"
              onClick={() => handleMenuItemClick('logout')}
            >
              <span className="menu-icon">🐒</span>
              <span>Log Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default ProfileMenu

