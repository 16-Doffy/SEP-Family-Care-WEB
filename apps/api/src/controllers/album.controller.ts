import type { Request, Response, NextFunction } from 'express'
import * as albumService from '../services/album.service'
import multer from 'multer'
import path from 'path'
import fs from 'fs'

const uploadDir = path.join(process.cwd(), 'uploads')
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })

export const albumUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) =>
      cb(null, `album-${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) =>
    cb(null, /jpeg|jpg|png|gif|webp|jfif|jpe|heic|heif|avif|bmp|tiff|tif/.test(path.extname(file.originalname).toLowerCase())),
})

export async function uploadPhotos(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user.familyId || !req.user.familyMemberId) {
      res.status(400).json({ error: 'Not in a family' })
      return
    }

    const files = req.files as Express.Multer.File[] | undefined
    if (!files || files.length === 0) {
      res.status(400).json({ error: 'Không có file nào' })
      return
    }

    const caption = (req.body.caption as string | undefined)?.trim() || undefined

    const photos = await albumService.uploadPhotos({
      familyId: req.user.familyId,
      uploaderId: req.user.familyMemberId,
      files: files.map((f) => ({
        url: `/uploads/${f.filename}`,
        caption,
      })),
    })

    res.status(201).json({ photos })
  } catch (e) { next(e) }
}

export async function getPhotos(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user.familyId) {
      res.status(400).json({ error: 'Not in a family' })
      return
    }
    const { cursor } = req.query
    const photos = await albumService.getFamilyPhotos(req.user.familyId, cursor as string | undefined)
    res.json({ photos })
  } catch (e) { next(e) }
}

export async function getPhoto(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user.familyId) {
      res.status(400).json({ error: 'Not in a family' })
      return
    }
    const photo = await albumService.getPhoto(req.params.id, req.user.familyId)
    res.json({ photo })
  } catch (e) { next(e) }
}

export async function deletePhoto(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user.familyId) {
      res.status(400).json({ error: 'Not in a family' })
      return
    }
    const isParent = req.user.role === 'PARENT' || req.user.role === 'SUPER_ADMIN'
    await albumService.deletePhoto({
      id: req.params.id,
      familyId: req.user.familyId,
      userId: req.user.userId,
      isParent,
    })
    res.json({ ok: true })
  } catch (e) { next(e) }
}

export async function getStats(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user.familyId) {
      res.status(400).json({ error: 'Not in a family' })
      return
    }
    const stats = await albumService.getStats(req.user.familyId)
    res.json(stats)
  } catch (e) { next(e) }
}
