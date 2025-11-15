// Simple console logger for terminal output
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
    if (process.env.NODE_ENV === 'development') {
      const timestamp = getTimestamp()
      if (data) {
        console.log(`[${timestamp}] [DEBUG] ${message}`, data)
      } else {
        console.log(`[${timestamp}] [DEBUG] ${message}`)
      }
    }
  },
}

export default logger

