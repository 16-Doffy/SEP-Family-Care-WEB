import { Router } from 'express'
import * as ctrl from '../controllers/payment.controller'
import { authenticate, requireFamily } from '../middleware/auth'

const router = Router()
router.use(authenticate, requireFamily)

router.post('/checkout', ctrl.createCheckout)
router.post('/:id/confirm-mock', ctrl.confirmMock)
router.get('/history', ctrl.listMyPayments)

export default router
