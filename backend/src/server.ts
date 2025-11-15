import app from './app.js'
import dotenv from 'dotenv'

dotenv.config()

const PORT = process.env.PORT || 8000

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`)
  console.log(`📊 Health check: http://localhost:${PORT}/health`)
  console.log(`🔐 Auth endpoints:`)
  console.log(`   POST http://localhost:${PORT}/api/auth/signup`)
  console.log(`   POST http://localhost:${PORT}/api/auth/login`)
})

