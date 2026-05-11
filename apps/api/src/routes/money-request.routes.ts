import { Router } from 'express'
import * as ctrl from '../controllers/money-request.controller'
import { authenticate, requireFamily, requireRole } from '../middleware/auth'

const router = Router()

router.use(authenticate, requireFamily)

router.post('/', ctrl.createMoneyRequest)
router.get('/', ctrl.getMoneyRequests)
router.get('/pending', ctrl.getPendingRequests)
router.patch('/:id', requireRole('PARENT', 'SUPER_ADMIN'), ctrl.resolveMoneyRequest)

export default router
