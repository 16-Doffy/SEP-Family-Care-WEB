/** Routes cho module Wearable/GPS Device. */
import { Router } from 'express'
import * as ctrl from '../controllers/device.controller'
import { authenticate, requireFamily, requireRole } from '../middleware/auth'

const router = Router()
router.use(authenticate, requireFamily)

router.get('/', ctrl.listDevices)
router.post('/', requireRole('PARENT', 'SUPER_ADMIN'), ctrl.pairDevice)
router.patch('/:id', requireRole('PARENT', 'SUPER_ADMIN'), ctrl.updateDevice)
router.post('/:id/location', ctrl.recordRoutePoint)
router.get('/:id/routes', ctrl.getRoutes)
router.get('/:id/habit-analysis', ctrl.analyzeHabit)
router.post('/:id/sos', ctrl.triggerSOS)

export default router
