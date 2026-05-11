import type { Request, Response, NextFunction } from 'express'
import * as chatService from '../services/chat.service'
import { z } from 'zod'
import path from 'path'
import multer from 'multer'
import fs from 'fs'

const uploadDir = path.join(process.cwd(), 'uploads')
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })

export const chatUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, /jpeg|jpg|png|gif|webp/.test(path.extname(file.originalname).toLowerCase())),
})

export async function getConversations(req: Request, res: Response, next: NextFunction) {
  try {
    const conversations = await chatService.getConversations(req.user.userId, req.user.familyId!)
    res.json(conversations)
  } catch (e) { next(e) }
}

export async function getOrCreateGroupChat(req: Request, res: Response, next: NextFunction) {
  try {
    const convo = await chatService.getOrCreateFamilyGroupChat(req.user.familyId!)
    res.json(convo)
  } catch (e) { next(e) }
}

export async function getOrCreatePrivateChat(req: Request, res: Response, next: NextFunction) {
  try {
    const { targetUserId } = z.object({ targetUserId: z.string() }).parse(req.body)
    const convo = await chatService.getOrCreatePrivateChat(req.user.familyId!, req.user.userId, targetUserId)
    res.json(convo)
  } catch (e) { next(e) }
}

export async function getMessages(req: Request, res: Response, next: NextFunction) {
  try {
    const { cursor } = req.query
    const result = await chatService.getMessages(req.params.id, req.user.userId, cursor as string | undefined)
    res.json(result)
  } catch (e) { next(e) }
}

export async function sendTextMessage(req: Request, res: Response, next: NextFunction) {
  try {
    const { content } = z.object({ content: z.string().min(1).max(2000) }).parse(req.body)
    const message = await chatService.sendMessage({
      conversationId: req.params.id,
      senderId: req.user.userId,
      type: 'TEXT',
      content,
    })
    // Emit via socket
    try {
      const { getIO } = await import('../config/socket')
      getIO().to(`conversation:${req.params.id}`).emit('chat:message', message)
    } catch {}
    res.status(201).json(message)
  } catch (e) { next(e) }
}

export async function sendImageMessage(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.file) throw new Error('No file uploaded')
    const imageUrl = `/uploads/${req.file.filename}`
    const message = await chatService.sendMessage({
      conversationId: req.params.id,
      senderId: req.user.userId,
      type: 'IMAGE',
      content: imageUrl,
      metadata: { imageUrl },
    })
    try {
      const { getIO } = await import('../config/socket')
      getIO().to(`conversation:${req.params.id}`).emit('chat:message', message)
    } catch {}
    res.status(201).json(message)
  } catch (e) { next(e) }
}

export async function markRead(req: Request, res: Response, next: NextFunction) {
  try {
    await chatService.markRead(req.params.id, req.user.userId)
    res.json({ ok: true })
  } catch (e) { next(e) }
}
