import app from './app.js'
import dotenv from 'dotenv'

dotenv.config()

const PORT = process.env.PORT || 8000

app.listen(PORT, () => {
  console.log('')
  console.log('🚀 Server started')
  console.log(`   Port: ${PORT}`)
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`)
  console.log(`   Health: http://localhost:${PORT}/health`)
  console.log(`   Auth: http://localhost:${PORT}/api/auth/signup`)
  console.log('')
})

