import { Router } from 'express'
import * as ctrl from '../controllers/location.controller'
import { authenticate, requireFamily } from '../middleware/auth'

const router = Router()
router.use(authenticate, requireFamily)

router.get('/family', ctrl.getFamilyLocations)
router.get('/me', ctrl.getMyShare)
router.patch('/toggle', ctrl.toggleSharing)
router.post('/update', ctrl.updateLocation)

export default router
