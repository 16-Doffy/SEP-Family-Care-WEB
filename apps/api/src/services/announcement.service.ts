import { prisma } from '../config/database'
import { Errors } from '../utils/errors'
import type { AnnouncementType } from '@prisma/client'

/**
 * Tạo announcement hoặc support request gửi đến toàn gia đình (FE-22).
 *
 * @param familyId - ID gia đình
 * @param senderId - ID FamilyMember người gửi
 * @param type - ANNOUNCEMENT hoặc SUPPORT_REQUEST
 * @param content - Nội dung thông báo
 */
export async function createAnnouncement(
  familyId: string,
  senderId: string,
  type: AnnouncementType,
  content: string,
) {
  const announcement = await prisma.announcement.create({
    data: { familyId, senderId, type, content },
    include: {
      sender: {
        include: {
          user: { select: { id: true, displayName: true, avatarUrl: true } },
        },
      },
    },
  })
  return announcement
}

/**
 * Lấy danh sách announcements của gia đình, mới nhất trước.
 *
 * @param familyId - ID gia đình
 * @param type - Lọc theo loại (tùy chọn)
 * @param cursor - ID announcement cuối cùng đã nhận (cursor pagination)
 * @param limit - Số lượng mục trả về (mặc định 20)
 */
export async function getAnnouncements(
  familyId: string,
  type?: AnnouncementType,
  cursor?: string,
  limit = 20,
) {
  // Resolve cursor thành createdAt trước khi query chính để tránh nested async
  // trong Prisma where clause (có thể gây lỗi không mong đợi)
  let cursorDate: Date | undefined
  if (cursor) {
    const cursorRecord = await prisma.announcement.findUnique({ where: { id: cursor } })
    cursorDate = cursorRecord?.createdAt
  }

  return prisma.announcement.findMany({
    where: {
      familyId,
      ...(type ? { type } : {}),
      ...(cursorDate ? { createdAt: { lt: cursorDate } } : {}),
    },
    include: {
      sender: {
        include: {
          user: { select: { id: true, displayName: true, avatarUrl: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
}

/**
 * Xóa một announcement — chỉ người gửi hoặc PARENT / SUPER_ADMIN.
 *
 * @param id - ID announcement cần xóa
 * @param requesterId - FamilyMember ID của người thực hiện
 * @param requesterRole - Role của người thực hiện
 */
export async function deleteAnnouncement(id: string, requesterId: string, requesterRole: string) {
  const ann = await prisma.announcement.findUnique({ where: { id } })
  if (!ann) throw Errors.NotFound('Announcement')

  const isOwner = ann.senderId === requesterId
  const isPrivileged = requesterRole === 'PARENT' || requesterRole === 'SUPER_ADMIN'
  if (!isOwner && !isPrivileged) throw Errors.Forbidden()

  await prisma.announcement.delete({ where: { id } })
}
