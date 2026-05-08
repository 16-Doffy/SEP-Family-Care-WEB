import { Router } from 'express'
import * as ctrl from '../controllers/chat.controller'
import { authenticate, requireFamily } from '../middleware/auth'

const router = Router()
router.use(authenticate, requireFamily)

router.get('/conversations', ctrl.getConversations)
router.get('/conversations/group', ctrl.getOrCreateGroupChat)
router.post('/conversations/private', ctrl.getOrCreatePrivateChat)
router.get('/conversations/:id/messages', ctrl.getMessages)
router.post('/conversations/:id/messages', ctrl.sendTextMessage)
router.post('/conversations/:id/messages/image', ctrl.chatUpload.single('image'), ctrl.sendImageMessage)
router.patch('/conversations/:id/read', ctrl.markRead)

export default router
