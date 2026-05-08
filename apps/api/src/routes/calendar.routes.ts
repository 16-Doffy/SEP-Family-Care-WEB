import { Router } from 'express'
import * as ctrl from '../controllers/calendar.controller'
import { authenticate, requireFamily } from '../middleware/auth'

const router = Router()
router.use(authenticate, requireFamily)

router.get('/', ctrl.getEvents)
router.post('/', ctrl.createEvent)
router.put('/:id', ctrl.updateEvent)
router.delete('/:id', ctrl.deleteEvent)

export default router
