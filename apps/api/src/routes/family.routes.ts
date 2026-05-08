import { Router } from 'express'
import * as ctrl from '../controllers/family.controller'
import { authenticate, requireFamily, requireRole } from '../middleware/auth'

const router = Router()

router.use(authenticate)

router.get('/', requireFamily, ctrl.getFamily)
router.put('/', requireFamily, requireRole('PARENT', 'SUPER_ADMIN'), ctrl.updateFamily)
router.post('/invite', requireFamily, requireRole('PARENT', 'SUPER_ADMIN'), ctrl.generateInvite)
router.post('/join', ctrl.joinFamily)
router.delete('/members/:userId', requireFamily, requireRole('PARENT', 'SUPER_ADMIN'), ctrl.removeMember)

export default router
