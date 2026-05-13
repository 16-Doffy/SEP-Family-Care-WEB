import { Router } from 'express'
import * as planCtrl from '../controllers/subscription-plan.controller'
import { authenticate } from '../middleware/auth'

const router = Router()

router.use(authenticate)
router.get('/', planCtrl.listPlans)

export default router
