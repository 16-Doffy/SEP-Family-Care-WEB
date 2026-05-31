/**
 * @module album.controller
 * @description Controller xử lý các yêu cầu HTTP liên quan đến album ảnh gia đình.
 * Quản lý việc tải lên file ảnh qua `multer`, sau đó lưu thông tin vào database
 * thông qua `album.service`. Hỗ trợ tải lên nhiều ảnh cùng lúc (tối đa 10 file),
 * xem, và xóa ảnh với kiểm tra phân quyền.
 */

import type { Request, Response, NextFunction } from 'express'
import * as albumService from '../services/album.service'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { z } from 'zod'

/** Thư mục lưu trữ file ảnh tải lên; được tạo tự động nếu chưa tồn tại */
const uploadDir = path.join(process.cwd(), 'uploads')
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })

/**
 * Instance Multer được cấu hình sẵn cho việc tải lên ảnh album.
 *
 * Cấu hình:
 * - **storage**: lưu file trực tiếp lên đĩa (DiskStorage) vào thư mục `uploads/`
 * - **filename**: tên file dạng `album-{timestamp}-{random}.{ext}` để tránh xung đột
 * - **limits**: giới hạn mỗi file tối đa 10 MB
 * - **fileFilter**: chỉ chấp nhận các định dạng ảnh phổ biến (jpeg, png, gif, webp,
 *   jfif, heic, heif, avif, bmp, tiff)
 *
 * Middleware này được export để router có thể gắn vào route tải lên.
 */
export const albumUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    // Thêm timestamp + số ngẫu nhiên để tên file luôn duy nhất dù tải lên đồng thời
    filename: (_req, file, cb) =>
      cb(null, `album-${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) =>
    cb(null, /jpeg|jpg|png|gif|webp|jfif|jpe|heic|heif|avif|bmp|tiff|tif/.test(path.extname(file.originalname).toLowerCase())),
})

/**
 * Tải lên một hoặc nhiều ảnh vào album gia đình.
 * Multer đã xử lý file trước khi vào đây, nên `req.files` chứa danh sách file đã lưu.
 *
 * @route POST /album
 * @param req - Express Request; `req.files` là mảng file từ Multer,
 *              `req.body.caption` là chú thích chung cho tất cả ảnh (tùy chọn)
 * @param res - Express Response; trả về `{ photos: AlbumPhoto[] }` với status 201
 * @param next - Express NextFunction để chuyển lỗi tới error handler
 */
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

    // Trim caption để loại bỏ khoảng trắng thừa; nếu rỗng thì không lưu
    const caption = (req.body.caption as string | undefined)?.trim() || undefined
    const categoryId = (req.body.categoryId as string | undefined)?.trim() || undefined
    const tagsRaw = (req.body.tags as string | undefined)?.trim()
    const tags = tagsRaw ? tagsRaw.split(',').map((t) => t.trim()).filter(Boolean) : undefined

    const photos = await albumService.uploadPhotos({
      familyId: req.user.familyId,
      uploaderId: req.user.familyMemberId,
      categoryId,
      tags,
      files: files.map((f) => ({
        url: `/uploads/${f.filename}`,
        caption,
      })),
    })

    res.status(201).json({ photos })
  } catch (e) { next(e) }
}

/**
 * Lấy danh sách ảnh trong album của gia đình hiện tại (có hỗ trợ phân trang).
 *
 * @route GET /album
 * @param req - Express Request; query param `cursor` (string, tùy chọn) là ID của ảnh
 *              cuối cùng trong trang trước để tiếp tục tải thêm (infinite scroll)
 * @param res - Express Response; trả về `{ photos: AlbumPhoto[] }`
 * @param next - Express NextFunction để chuyển lỗi tới error handler
 */
export async function getPhotos(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user.familyId) {
      res.status(400).json({ error: 'Not in a family' })
      return
    }
    const { cursor, categoryId } = req.query
    const photos = await albumService.getFamilyPhotos(
      req.user.familyId,
      cursor as string | undefined,
      categoryId as string | undefined,
    )
    res.json({ photos })
  } catch (e) { next(e) }
}

/**
 * Lấy thông tin chi tiết của một ảnh cụ thể trong album gia đình.
 *
 * @route GET /album/:id
 * @param req - Express Request; `req.params.id` là ID của ảnh cần xem
 * @param res - Express Response; trả về `{ photo: AlbumPhoto }`
 * @param next - Express NextFunction để chuyển lỗi tới error handler
 * @throws {NotFoundError} Nếu ảnh không tồn tại hoặc không thuộc gia đình này
 */
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

/**
 * Xóa một ảnh khỏi album gia đình.
 * Phụ huynh (`PARENT`) và quản trị viên (`SUPER_ADMIN`) có thể xóa bất kỳ ảnh nào;
 * các thành viên thường chỉ xóa được ảnh do chính mình tải lên.
 *
 * @route DELETE /album/:id
 * @param req - Express Request; `req.params.id` là ID của ảnh cần xóa
 * @param res - Express Response; trả về `{ ok: true }` khi thành công
 * @param next - Express NextFunction để chuyển lỗi tới error handler
 * @throws {NotFoundError} Nếu ảnh không tồn tại
 * @throws {ForbiddenError} Nếu người dùng không có quyền xóa ảnh này
 */
export async function deletePhoto(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user.familyId) {
      res.status(400).json({ error: 'Not in a family' })
      return
    }
    // Cả PARENT và SUPER_ADMIN đều có quyền xóa ảnh của bất kỳ thành viên nào
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

/**
 * Lấy thống kê album của gia đình: tổng số ảnh và phân bổ theo từng thành viên.
 * Thường được dùng để hiển thị dashboard hoặc bảng xếp hạng người tải nhiều nhất.
 *
 * @route GET /album/stats
 * @param req - Express Request
 * @param res - Express Response; trả về `{ total: number, byMember: { uploaderId, _count }[] }`
 * @param next - Express NextFunction để chuyển lỗi tới error handler
 */
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


export async function listCategories(req: Request, res: Response, next: NextFunction) {
  try {
    const categories = await albumService.listCategories(req.user.familyId!)
    res.json({ categories })
  } catch (e) { next(e) }
}

export async function createCategory(req: Request, res: Response, next: NextFunction) {
  try {
    const body = z.object({
      name: z.string().min(1).max(80),
      description: z.string().max(300).optional(),
      color: z.string().max(20).optional(),
      ruleType: z.enum(['MANUAL', 'EVENT', 'MEMBER', 'AI_FACE', 'CUSTOM']).optional(),
      criteria: z.unknown().optional(),
    }).parse(req.body)
    const category = await albumService.createCategory({
      familyId: req.user.familyId!,
      createdById: req.user.familyMemberId,
      ...body,
    })
    res.status(201).json({ category })
  } catch (e) { next(e) }
}

export async function updateCategory(req: Request, res: Response, next: NextFunction) {
  try {
    const body = z.object({
      name: z.string().min(1).max(80).optional(),
      description: z.string().max(300).nullable().optional(),
      color: z.string().max(20).optional(),
      ruleType: z.enum(['MANUAL', 'EVENT', 'MEMBER', 'AI_FACE', 'CUSTOM']).optional(),
      criteria: z.unknown().optional(),
    }).parse(req.body)
    const category = await albumService.updateCategory(req.params.id, req.user.familyId!, body)
    res.json({ category })
  } catch (e) { next(e) }
}

export async function deleteCategory(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await albumService.deleteCategory(req.params.id, req.user.familyId!)
    res.json(result)
  } catch (e) { next(e) }
}

export async function assignPhotoCategory(req: Request, res: Response, next: NextFunction) {
  try {
    const body = z.object({
      categoryId: z.string().nullable().optional(),
      tags: z.array(z.string()).optional(),
      aiStatus: z.enum(['PENDING', 'SUGGESTED', 'CONFIRMED', 'SKIPPED']).optional(),
    }).parse(req.body)
    const photo = await albumService.assignPhotoCategory({
      photoId: req.params.id,
      familyId: req.user.familyId!,
      ...body,
    })
    res.json({ photo })
  } catch (e) { next(e) }
}
