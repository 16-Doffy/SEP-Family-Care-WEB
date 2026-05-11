import { Router } from 'express'
import * as ctrl from '../controllers/sos.controller'
import { authenticate } from '../middleware/auth'

const router = Router()

router.use(authenticate)

router.post('/', ctrl.createSOSAlert)
router.get('/', ctrl.getSOSAlerts)
router.get('/active', ctrl.getActiveSOSAlerts)
router.patch('/:id', ctrl.updateSOSStatus)

export default router
