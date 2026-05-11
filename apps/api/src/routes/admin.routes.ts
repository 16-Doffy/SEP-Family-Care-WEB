import { Router } from 'express'
import * as ctrl from '../controllers/admin.controller'
import * as planCtrl from '../controllers/subscription-plan.controller'
import { authenticate, requireRole } from '../middleware/auth'

const router = Router()

router.use(authenticate, requireRole('SUPER_ADMIN'))

router.get('/stats', ctrl.getStats)
router.get('/families', ctrl.getFamilies)
router.get('/users', ctrl.getUsers)
router.put('/users/:id', ctrl.updateUser)

// Subscription plans CRUD
router.get('/plans', planCtrl.listPlans)
router.post('/plans', planCtrl.createPlan)
router.get('/plans/:id', planCtrl.getPlan)
router.put('/plans/:id', planCtrl.updatePlan)
router.delete('/plans/:id', planCtrl.deletePlan)

// Assign plan to family
router.put('/families/:familyId/plan', planCtrl.assignToFamily)

export default router
