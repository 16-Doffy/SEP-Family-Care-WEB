import { Router } from 'express'
import authRoutes from './auth.routes'
import familyRoutes from './family.routes'
import walletRoutes from './wallet.routes'
import taskRoutes from './task.routes'
import notificationRoutes from './notification.routes'
import adminRoutes from './admin.routes'

const router = Router()

router.use('/auth', authRoutes)
router.use('/family', familyRoutes)
router.use('/wallets', walletRoutes)
router.use('/tasks', taskRoutes)
router.use('/notifications', notificationRoutes)
router.use('/admin', adminRoutes)

export { router as apiRouter }
