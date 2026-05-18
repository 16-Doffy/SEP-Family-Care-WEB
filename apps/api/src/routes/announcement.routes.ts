import { Router } from 'express'
import * as ctrl from '../controllers/announcement.controller'
import { authenticate, requireFamily } from '../middleware/auth'

const router = Router()

router.use(authenticate, requireFamily)

/** POST /announcements — Mọi thành viên gửi announcement / support request (FE-22) */
router.post('/', ctrl.createAnnouncement)

/** GET /announcements — Mọi thành viên xem danh sách */
router.get('/', ctrl.getAnnouncements)

/** DELETE /announcements/:id — Người gửi hoặc PARENT / SUPER_ADMIN xóa */
router.delete('/:id', ctrl.deleteAnnouncement)

export default router
