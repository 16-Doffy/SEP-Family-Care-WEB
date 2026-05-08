import { Router } from 'express'
import authRoutes from './auth.routes'
import familyRoutes from './family.routes'
import walletRoutes from './wallet.routes'
import taskRoutes from './task.routes'
import notificationRoutes from './notification.routes'
import adminRoutes from './admin.routes'
import chatRoutes from './chat.routes'
import calendarRoutes from './calendar.routes'

const router = Router()

router.use('/auth', authRoutes)
router.use('/family', familyRoutes)
router.use('/wallets', walletRoutes)
router.use('/tasks', taskRoutes)
router.use('/notifications', notificationRoutes)
router.use('/admin', adminRoutes)
router.use('/chat', chatRoutes)
router.use('/calendar', calendarRoutes)

export { router as apiRouter }
