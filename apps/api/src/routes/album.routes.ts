import { Router } from 'express'
import * as ctrl from '../controllers/album.controller'
import { authenticate, requireFamily } from '../middleware/auth'

const router = Router()

router.use(authenticate, requireFamily)

router.get('/', ctrl.getPhotos)
router.get('/stats', ctrl.getStats)
router.get('/:id', ctrl.getPhoto)
router.post('/', ctrl.albumUpload.array('photos', 10), ctrl.uploadPhotos)
router.delete('/:id', ctrl.deletePhoto)

export default router
