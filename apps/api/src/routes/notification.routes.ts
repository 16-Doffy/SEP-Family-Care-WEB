import { Router } from 'express'
import * as ctrl from '../controllers/notification.controller'
import { authenticate } from '../middleware/auth'

const router = Router()

router.use(authenticate)

router.get('/', ctrl.getNotifications)
router.patch('/read-all', ctrl.markAllRead)
router.patch('/:id/read', ctrl.markRead)

export default router
