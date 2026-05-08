import { Router } from 'express'
import * as ctrl from '../controllers/auth.controller'
import { authenticate } from '../middleware/auth'

const router = Router()

router.post('/register', ctrl.register)
router.post('/login', ctrl.login)
router.post('/refresh', ctrl.refresh)
router.post('/logout', ctrl.logout)
router.get('/me', authenticate, ctrl.me)

export default router
