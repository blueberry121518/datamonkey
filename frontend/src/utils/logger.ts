// Simple console logger for browser console
const getTimestamp = () => new Date().toISOString()

const logger = {
  info: (message: string, data?: any) => {
    const timestamp = getTimestamp()
    if (data) {
      console.log(`[${timestamp}] [INFO] ${message}`, data)
    } else {
      console.log(`[${timestamp}] [INFO] ${message}`)
    }
  },

  error: (message: string, error?: any) => {
    const timestamp = getTimestamp()
    if (error) {
      console.error(`[${timestamp}] [ERROR] ${message}`, error)
    } else {
      console.error(`[${timestamp}] [ERROR] ${message}`)
    }
  },

  warn: (message: string, data?: any) => {
    const timestamp = getTimestamp()
    if (data) {
      console.warn(`[${timestamp}] [WARN] ${message}`, data)
    } else {
      console.warn(`[${timestamp}] [WARN] ${message}`)
    }
  },

  debug: (message: string, data?: any) => {
    if (import.meta.env.DEV || import.meta.env.MODE === 'development') {
      const timestamp = getTimestamp()
      if (data) {
        console.log(`[${timestamp}] [DEBUG] ${message}`, data)
      } else {
        console.log(`[${timestamp}] [DEBUG] ${message}`)
      }
    }
  },

  // API request logging
  apiRequest: (method: string, url: string, data?: any) => {
    const timestamp = getTimestamp()
    console.log(`[${timestamp}] [API] ${method} ${url}`, data || '')
  },

  // API response logging
  apiResponse: (method: string, url: string, status: number, duration?: number) => {
    const timestamp = getTimestamp()
    const statusEmoji = status >= 400 ? '❌' : status >= 300 ? '⚠️' : '✅'
    const durationStr = duration ? ` (${duration}ms)` : ''
    console.log(`[${timestamp}] [API] ${statusEmoji} ${method} ${url} → ${status}${durationStr}`)
  },
}

export default logger

