/**
 * @module album.service
 * @description Dịch vụ quản lý album ảnh gia đình.
 * Cung cấp các thao tác tải lên, xem, xóa ảnh và thống kê album.
 * Ảnh được lưu trữ dưới dạng file vật lý trong thư mục `uploads/`
 * và đường dẫn URL được ghi vào bảng `AlbumPhoto` trong database.
 */

import { prisma } from '../config/database'

const db = prisma as any
import { Errors } from '../utils/errors'
import path from 'path'
import fs from 'fs'

/**
 * Tải lên nhiều ảnh cùng lúc cho album gia đình.
 * Toàn bộ danh sách ảnh được tạo trong một transaction để đảm bảo
 * tính toàn vẹn dữ liệu — nếu một ảnh thất bại thì tất cả sẽ bị rollback.
 *
 * @param input - Thông tin tải lên
 * @param input.familyId - ID của gia đình sở hữu album
 * @param input.uploaderId - ID của `FamilyMember` (không phải `User`) đang tải lên
 * @param input.files - Danh sách file cần tạo, mỗi file gồm URL và chú thích tùy chọn
 * @returns Danh sách bản ghi `AlbumPhoto` vừa được tạo, kèm thông tin người tải lên.
 * @throws {BadRequestError} Nếu danh sách file rỗng
 */
export async function uploadPhotos(input: {
  familyId: string
  uploaderId: string  // FamilyMember.id
  categoryId?: string
  tags?: string[]
  files: { url: string; caption?: string }[]
}) {
  if (input.files.length === 0) throw Errors.BadRequest('Không có ảnh nào')

  if (input.categoryId) {
    const category = await db.albumCategory.findFirst({ where: { id: input.categoryId, familyId: input.familyId } })
    if (!category) throw Errors.BadRequest('Album category không hợp lệ')
  }

  // Dùng $transaction để đảm bảo tất cả ảnh được lưu cùng lúc (all-or-nothing)
  const photos = await prisma.$transaction(
    input.files.map((f) =>
      db.albumPhoto.create({
        data: {
          familyId: input.familyId,
          uploaderId: input.uploaderId,
          categoryId: input.categoryId,
          imageUrl: f.url,
          caption: f.caption,
          tags: input.tags ?? [],
          aiStatus: input.tags?.length ? 'CONFIRMED' : 'PENDING',
        },
        include: {
          uploader: { include: { user: { select: { id: true, displayName: true, avatarUrl: true } } } },
          category: true,
        },
      }),
    ),
  )
  return photos
}

/**
 * Lấy danh sách ảnh của một gia đình theo trang (cursor-based pagination).
 * Mỗi trang tải tối đa 60 ảnh, sắp xếp mới nhất lên đầu.
 *
 * Cursor-based pagination được dùng thay vì offset để tránh trùng lặp dữ liệu
 * khi người dùng cuộn vô tận (infinite scroll) — offset có thể bỏ sót hoặc
 * hiển thị trùng ảnh khi có ảnh mới được thêm vào trong lúc cuộn.
 *
 * @param familyId - ID của gia đình cần lấy ảnh
 * @param cursor - ID của ảnh cuối cùng trong trang trước (dùng để phân trang),
 *                 bỏ qua nếu đây là trang đầu tiên
 * @returns Danh sách `AlbumPhoto` kèm thông tin người tải lên.
 */
export async function getFamilyPhotos(familyId: string, cursor?: string, categoryId?: string) {
  return db.albumPhoto.findMany({
    where: { familyId, ...(categoryId ? { categoryId } : {}) },
    orderBy: { createdAt: 'desc' },
    take: 60,
    // Nếu có cursor thì bỏ qua bản ghi tại cursor (skip: 1) và bắt đầu từ bản ghi kế tiếp
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: {
      uploader: { include: { user: { select: { id: true, displayName: true, avatarUrl: true } } } },
      category: true,
    },
  })
}

/**
 * Lấy thông tin chi tiết của một ảnh cụ thể trong album gia đình.
 * Kết hợp kiểm tra `id` lẫn `familyId` để ngăn người dùng truy cập ảnh của gia đình khác.
 *
 * @param id - ID của ảnh cần lấy
 * @param familyId - ID của gia đình mà ảnh phải thuộc về
 * @returns Bản ghi `AlbumPhoto` kèm thông tin người tải lên.
 * @throws {NotFoundError} Nếu ảnh không tồn tại hoặc không thuộc gia đình này
 */
export async function getPhoto(id: string, familyId: string) {
  const photo = await db.albumPhoto.findFirst({
    where: { id, familyId },
    include: {
      uploader: { include: { user: { select: { id: true, displayName: true, avatarUrl: true } } } },
      category: true,
    },
  })
  if (!photo) throw Errors.NotFound('Ảnh')
  return photo
}

/**
 * Xóa một ảnh khỏi album và xóa file vật lý tương ứng trên đĩa.
 *
 * Quy tắc phân quyền:
 * - Người tải ảnh lên có thể xóa ảnh của chính mình.
 * - Phụ huynh (`PARENT`) hoặc quản trị viên (`SUPER_ADMIN`) có thể xóa bất kỳ ảnh nào.
 *
 * Việc xóa file vật lý được thực hiện trong try/catch riêng để tránh
 * lỗi filesystem làm thất bại toàn bộ thao tác (ảnh đã bị xóa trong DB vẫn ok).
 *
 * @param input - Thông tin xóa ảnh
 * @param input.id - ID của ảnh cần xóa
 * @param input.familyId - ID của gia đình sở hữu ảnh (để kiểm tra quyền truy cập)
 * @param input.userId - ID của `User` đang thực hiện thao tác xóa
 * @param input.isParent - `true` nếu người dùng có vai trò PARENT hoặc SUPER_ADMIN
 * @returns `{ ok: true }` khi xóa thành công
 * @throws {NotFoundError} Nếu ảnh không tồn tại trong gia đình này
 * @throws {ForbiddenError} Nếu người dùng không có quyền xóa ảnh này
 */
export async function deletePhoto(input: {
  id: string
  familyId: string
  userId: string
  isParent: boolean
}) {
  const photo = await db.albumPhoto.findFirst({
    where: { id: input.id, familyId: input.familyId },
    include: { uploader: { select: { userId: true } } },
  })
  if (!photo) throw Errors.NotFound('Ảnh')

  // Chỉ người tải lên hoặc phụ huynh/admin mới được xóa ảnh
  if (photo.uploader.userId !== input.userId && !input.isParent) {
    throw Errors.Forbidden()
  }

  await db.albumPhoto.delete({ where: { id: input.id } })

  // Xóa file vật lý; bỏ qua lỗi nếu file không tồn tại hoặc không có quyền xóa
  try {
    const filename = path.basename(photo.imageUrl)
    const filePath = path.join(process.cwd(), 'uploads', filename)
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
  } catch {}

  return { ok: true }
}

/**
 * Lấy thống kê album của một gia đình.
 * Trả về tổng số ảnh và số ảnh theo từng thành viên (groupBy uploaderId).
 *
 * Dùng `Promise.all` để chạy song song hai truy vấn, tối ưu hiệu năng.
 *
 * @param familyId - ID của gia đình cần thống kê
 * @returns Đối tượng gồm:
 *          - `total`: tổng số ảnh trong album
 *          - `byMember`: mảng `{ uploaderId, _count }` thống kê theo từng thành viên
 */
export async function getStats(familyId: string) {
  // Chạy song song để giảm thời gian chờ thay vì tuần tự
  const [total, byMember, byCategory] = await Promise.all([
    db.albumPhoto.count({ where: { familyId } }),
    db.albumPhoto.groupBy({
      by: ['uploaderId'],
      where: { familyId },
      _count: true,
    }),
    db.albumPhoto.groupBy({
      by: ['categoryId'],
      where: { familyId },
      _count: true,
    }),
  ])
  return { total, byMember, byCategory }
}

export async function listCategories(familyId: string) {
  return db.albumCategory.findMany({
    where: { familyId },
    orderBy: [{ ruleType: 'asc' }, { createdAt: 'desc' }],
    include: { _count: { select: { photos: true } } },
  })
}

export async function createCategory(input: {
  familyId: string
  name: string
  description?: string
  color?: string
  ruleType?: string
  criteria?: unknown
  createdById?: string
}) {
  return db.albumCategory.create({
    data: {
      familyId: input.familyId,
      name: input.name,
      description: input.description,
      color: input.color ?? '#ec4899',
      ruleType: input.ruleType ?? 'MANUAL',
      criteria: input.criteria as any,
      createdById: input.createdById,
    },
    include: { _count: { select: { photos: true } } },
  })
}

export async function updateCategory(id: string, familyId: string, data: {
  name?: string
  description?: string | null
  color?: string
  ruleType?: string
  criteria?: unknown
}) {
  const category = await db.albumCategory.findFirst({ where: { id, familyId } })
  if (!category) throw Errors.NotFound('Album category')
  return db.albumCategory.update({ where: { id }, data, include: { _count: { select: { photos: true } } } })
}

export async function deleteCategory(id: string, familyId: string) {
  const category = await db.albumCategory.findFirst({ where: { id, familyId } })
  if (!category) throw Errors.NotFound('Album category')
  await db.albumPhoto.updateMany({ where: { familyId, categoryId: id }, data: { categoryId: null } })
  await db.albumCategory.delete({ where: { id } })
  return { ok: true }
}

export async function assignPhotoCategory(input: {
  photoId: string
  familyId: string
  categoryId?: string | null
  tags?: string[]
  aiStatus?: 'PENDING' | 'SUGGESTED' | 'CONFIRMED' | 'SKIPPED'
}) {
  const photo = await db.albumPhoto.findFirst({ where: { id: input.photoId, familyId: input.familyId } })
  if (!photo) throw Errors.NotFound('Ảnh')
  if (input.categoryId) {
    const category = await db.albumCategory.findFirst({ where: { id: input.categoryId, familyId: input.familyId } })
    if (!category) throw Errors.BadRequest('Album category không hợp lệ')
  }
  return db.albumPhoto.update({
    where: { id: input.photoId },
    data: {
      categoryId: input.categoryId ?? null,
      ...(input.tags ? { tags: input.tags } : {}),
      ...(input.aiStatus ? { aiStatus: input.aiStatus } : {}),
    },
    include: {
      uploader: { include: { user: { select: { id: true, displayName: true, avatarUrl: true } } } },
      category: true,
    },
  })
}
