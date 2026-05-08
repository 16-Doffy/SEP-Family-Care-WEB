import { Router } from 'express'
import * as ctrl from '../controllers/task.controller'
import { authenticate, requireFamily, requireRole } from '../middleware/auth'
import multer from 'multer'
import path from 'path'
import fs from 'fs'

const uploadDir = path.join(process.cwd(), 'uploads')
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`
    cb(null, `${unique}${path.extname(file.originalname)}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/
    cb(null, allowed.test(path.extname(file.originalname).toLowerCase()))
  },
})

const router = Router()

router.use(authenticate, requireFamily)

router.get('/', ctrl.getTasks)
router.post('/', requireRole('PARENT', 'SUPER_ADMIN'), ctrl.createTask)
router.get('/:id', ctrl.getTask)
router.patch('/:id/assign', requireRole('PARENT', 'SUPER_ADMIN'), ctrl.assignTask)
router.patch('/:id/start', ctrl.startTask)
router.post('/:id/proof', upload.single('image'), ctrl.submitProof)
router.patch('/:id/approve', requireRole('PARENT', 'SUPER_ADMIN'), ctrl.approveTask)
router.patch('/:id/reject', requireRole('PARENT', 'SUPER_ADMIN'), ctrl.rejectTask)
router.delete('/:id', requireRole('PARENT', 'SUPER_ADMIN'), ctrl.cancelTask)

export default router
