import { Router } from 'express'
import { AuthController } from '../controllers/auth.controller.js'

const router = Router()
const authController = new AuthController()

// Auth routes
router.post('/signup', (req, res) => authController.signup(req, res))
router.post('/login', (req, res) => authController.login(req, res))

export default router

