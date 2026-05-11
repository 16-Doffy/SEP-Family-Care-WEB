import { Router } from 'express'
import authRoutes from './auth.routes'
import familyRoutes from './family.routes'
import walletRoutes from './wallet.routes'
import taskRoutes from './task.routes'
import notificationRoutes from './notification.routes'
import adminRoutes from './admin.routes'
import chatRoutes from './chat.routes'
import calendarRoutes from './calendar.routes'
import sosRoutes from './sos.routes'
import moneyRequestRoutes from './money-request.routes'
import albumRoutes from './album.routes'
import locationRoutes from './location.routes'

const router = Router()

router.use('/auth', authRoutes)
router.use('/family', familyRoutes)
router.use('/wallets', walletRoutes)
router.use('/tasks', taskRoutes)
router.use('/notifications', notificationRoutes)
router.use('/admin', adminRoutes)
router.use('/chat', chatRoutes)
router.use('/calendar', calendarRoutes)
router.use('/sos', sosRoutes)
router.use('/money-requests', moneyRequestRoutes)
router.use('/album', albumRoutes)
router.use('/location', locationRoutes)

export { router as apiRouter }
