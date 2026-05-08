import { Router } from 'express'
import * as ctrl from '../controllers/admin.controller'
import { authenticate, requireRole } from '../middleware/auth'

const router = Router()

router.use(authenticate, requireRole('SUPER_ADMIN'))

router.get('/stats', ctrl.getStats)
router.get('/families', ctrl.getFamilies)
router.get('/users', ctrl.getUsers)
router.put('/users/:id', ctrl.updateUser)

export default router
