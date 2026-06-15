/**
 * @module album.routes
 * Routes cho album gia đình: upload media, xem ảnh, category setup và xác nhận AI tag.
 */
import { Router, type Router as ExpressRouter } from 'express'
import * as ctrl from '../controllers/album.controller'
import { authenticate, requireFamily, requireRole } from '../middleware/auth'

const router: ExpressRouter = Router()
router.use(authenticate, requireFamily)

router.get('/stats', ctrl.getStats)
router.get('/categories', ctrl.listCategories)
router.post('/categories', requireRole('PARENT', 'SUPER_ADMIN'), ctrl.createCategory)
router.patch('/categories/:id', requireRole('PARENT', 'SUPER_ADMIN'), ctrl.updateCategory)
router.delete('/categories/:id', requireRole('PARENT', 'SUPER_ADMIN'), ctrl.deleteCategory)
router.get('/', ctrl.getPhotos)
router.post('/', ctrl.albumUpload.array('photos', 10), ctrl.uploadPhotos)
router.get('/:id', ctrl.getPhoto)
router.patch('/:id/category', ctrl.assignPhotoCategory)
router.delete('/:id', ctrl.deletePhoto)

export default router
