import { createContext, useContext, useState, ReactNode } from 'react'

interface Notification {
  id: string
  type: 'info' | 'success' | 'error' | 'warning'
  message: string
  timestamp: Date
}

interface NotificationContextType {
  addNotification: (type: Notification['type'], message: string) => void
  notifications: Notification[]
  clearNotifications: () => void
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([])

  const addNotification = (type: Notification['type'], message: string) => {
    const notification: Notification = {
      id: Date.now().toString() + Math.random(),
      type,
      message,
      timestamp: new Date(),
    }
    setNotifications((prev) => [...prev, notification])
    
    // Auto-remove after 5 seconds for success/info, 10 seconds for errors/warnings
    const timeout = type === 'success' || type === 'info' ? 5000 : 10000
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== notification.id))
    }, timeout)
  }

  const clearNotifications = () => {
    setNotifications([])
  }

  return (
    <NotificationContext.Provider value={{ addNotification, notifications, clearNotifications }}>
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotification() {
  const context = useContext(NotificationContext)
  if (context === undefined) {
    throw new Error('useNotification must be used within a NotificationProvider')
  }
  return context
}

