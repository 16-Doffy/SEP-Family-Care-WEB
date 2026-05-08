import { Router } from 'express'
import * as ctrl from '../controllers/wallet.controller'
import { authenticate, requireFamily, requireRole } from '../middleware/auth'

const router = Router()

router.use(authenticate, requireFamily)

router.get('/', ctrl.getWallets)
router.get('/:id', ctrl.getWallet)
router.post('/transfer', requireRole('PARENT', 'SUPER_ADMIN'), ctrl.transfer)
router.post('/deposit', requireRole('PARENT', 'SUPER_ADMIN'), ctrl.deposit)

export default router
