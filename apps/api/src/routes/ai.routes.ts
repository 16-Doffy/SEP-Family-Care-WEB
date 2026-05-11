import { Router } from 'express'
import * as ctrl from '../controllers/ai-chat.controller'
import { authenticate } from '../middleware/auth'

const router = Router()
router.use(authenticate)

router.get('/history', ctrl.getHistory)
router.post('/message', ctrl.sendMessage)
router.delete('/history', ctrl.clearHistory)

export default router
