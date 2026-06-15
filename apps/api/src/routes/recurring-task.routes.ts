/**
 * @module recurring-task.routes
 * @description Endpoints REST cho nhiệm vụ định kỳ (Core flow 2).
 *
 * Mount tại `/api/recurring-tasks`.
 */

import { Router, type Router as ExpressRouter } from 'express'
import * as ctrl from '../controllers/recurring-task.controller'
import { authenticate, requireFamily, requireRole } from '../middleware/auth'

const router: ExpressRouter = Router()
router.use(authenticate, requireFamily)

// Template CRUD — chỉ PARENT/SUPER_ADMIN mới tạo/sửa/vô hiệu hoá
router.get('/', ctrl.listTemplates)
router.post('/', requireRole('PARENT', 'SUPER_ADMIN'), ctrl.createTemplate)
router.patch('/:id', requireRole('PARENT', 'SUPER_ADMIN'), ctrl.updateTemplate)
router.delete('/:id', requireRole('PARENT', 'SUPER_ADMIN'), ctrl.deleteTemplate)

// Sinh instance hôm nay (debug / on-demand). PARENT-only.
router.post('/generate-today', requireRole('PARENT', 'SUPER_ADMIN'), ctrl.generateToday)

// Leave / claim / parent override (xử lý task instance, không phải template)
router.post('/tasks/:id/request-leave', ctrl.requestLeave)
router.post('/tasks/:id/claim', ctrl.claimTask)
router.post('/tasks/:id/reassign', requireRole('PARENT', 'SUPER_ADMIN'), ctrl.reassignByParent)

export default router
