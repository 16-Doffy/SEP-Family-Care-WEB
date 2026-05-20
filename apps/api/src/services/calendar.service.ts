/**
 * @module calendar.service
 * @description Cung cấp các hàm nghiệp vụ để quản lý sự kiện lịch gia đình.
 *
 * Các tính năng chính:
 *  - Lấy sự kiện theo tháng (mặc định hiển thị 2 tháng để hỗ trợ xem tháng kế tiếp)
 *  - Tạo, cập nhật, xóa sự kiện với kiểm tra quyền truy cập theo familyId
 *  - Khi sự kiện được cập nhật có thay đổi ngày giờ, cờ `reminderSent` được reset
 *    để hệ thống nhắc nhở gửi lại thông báo đúng thời điểm mới
 */

import { prisma } from '../config/database'
import { Errors } from '../utils/errors'

/**
 * Lấy danh sách sự kiện của gia đình trong khoảng thời gian từ đầu tháng chỉ định
 * đến hết tháng tiếp theo (window 2 tháng để hiển thị trước các sự kiện sắp tới).
 *
 * @param familyId - ID của gia đình cần lấy sự kiện
 * @param month - Chuỗi ngày tháng bắt đầu (ví dụ: "2024-03-01"), mặc định là tháng hiện tại
 * @returns Danh sách sự kiện kèm thông tin người tạo, sắp xếp theo ngày bắt đầu tăng dần
 */
export async function getEvents(familyId: string, month?: string) {
  // Parse tháng được yêu cầu hoặc dùng thời điểm hiện tại nếu không truyền
  const now = month ? new Date(month) : new Date()

  // Lấy ngày đầu tiên của tháng hiện tại
  const start = new Date(now.getFullYear(), now.getMonth(), 1)

  // Lấy đến hết tháng kế tiếp (ngày 0 của tháng +2 = ngày cuối của tháng +1)
  // Mở rộng 2 tháng giúp giao diện lịch hiển thị được các sự kiện ở tuần cuối tháng
  // khi người dùng đang xem lịch tháng hiện tại
  const end = new Date(now.getFullYear(), now.getMonth() + 2, 0)

  return prisma.familyEvent.findMany({
    where: {
      familyId,
      startDate: { gte: start, lte: end },
    },
    include: {
      createdBy: {
        include: { user: { select: { id: true, displayName: true, avatarUrl: true } } },
      },
    },
    orderBy: { startDate: 'asc' },
  })
}

/**
 * Tạo sự kiện mới trong lịch gia đình.
 * Màu mặc định (#3b82f6) là màu xanh Tailwind blue-500, phù hợp giao diện mặc định.
 *
 * @param familyId - ID của gia đình sở hữu sự kiện
 * @param createdById - ID của thành viên gia đình đang tạo sự kiện (FamilyMember.id)
 * @param data - Thông tin chi tiết của sự kiện
 * @param data.title - Tiêu đề sự kiện (bắt buộc)
 * @param data.description - Mô tả thêm (tùy chọn)
 * @param data.startDate - Thời điểm bắt đầu dạng chuỗi ISO 8601 (bắt buộc)
 * @param data.endDate - Thời điểm kết thúc dạng chuỗi ISO 8601 (tùy chọn)
 * @param data.allDay - Cờ sự kiện cả ngày (mặc định: false)
 * @param data.color - Mã màu hex để hiển thị trên lịch (mặc định: '#3b82f6')
 * @returns Sự kiện vừa được tạo kèm thông tin người tạo
 */
export async function createEvent(
  familyId: string,
  createdById: string,
  data: {
    title: string
    description?: string
    startDate: string
    endDate?: string
    allDay?: boolean
    color?: string
  },
) {
  return prisma.familyEvent.create({
    data: {
      familyId,
      createdById,
      title: data.title,
      description: data.description,
      startDate: new Date(data.startDate),
      endDate: data.endDate ? new Date(data.endDate) : undefined,
      allDay: data.allDay ?? false,
      color: data.color ?? '#3b82f6',
    },
    include: {
      createdBy: {
        include: { user: { select: { id: true, displayName: true, avatarUrl: true } } },
      },
    },
  })
}

/**
 * Cập nhật thông tin của một sự kiện lịch.
 * Chỉ cập nhật các trường được truyền vào (partial update).
 *
 * Quan trọng: Nếu `startDate` bị thay đổi, cờ `reminderSent` sẽ được reset về `false`
 * để scheduler nhắc nhở tự động gửi lại thông báo theo thời gian mới.
 *
 * Phân quyền: Chỉ người tạo sự kiện (createdById) hoặc PARENT / SUPER_ADMIN mới được
 * cập nhật. FAMILY_MEMBER chỉ được cập nhật sự kiện do chính họ tạo ra.
 *
 * @param eventId - ID của sự kiện cần cập nhật
 * @param familyId - ID của gia đình (để kiểm tra quyền sở hữu)
 * @param data - Các trường cần cập nhật (tất cả đều tùy chọn)
 * @param requesterId - FamilyMember.id của người thực hiện cập nhật (tùy chọn)
 * @param requesterRole - Role của người thực hiện cập nhật (tùy chọn)
 * @returns Sự kiện sau khi đã cập nhật kèm thông tin người tạo
 * @throws {NotFoundError} Nếu không tìm thấy sự kiện với eventId và familyId tương ứng
 * @throws {ForbiddenError} Nếu người dùng không có quyền cập nhật sự kiện này
 */
export async function updateEvent(
  eventId: string,
  familyId: string,
  data: { title?: string; description?: string; startDate?: string; endDate?: string; allDay?: boolean; color?: string },
  requesterId?: string,
  requesterRole?: string,
) {
  // Kiểm tra sự kiện tồn tại và thuộc về đúng gia đình trước khi cập nhật
  const event = await prisma.familyEvent.findFirst({ where: { id: eventId, familyId } })
  if (!event) throw Errors.NotFound('Event')

  // Kiểm tra quyền: FAMILY_MEMBER chỉ được sửa sự kiện do chính họ tạo
  const isPrivileged = requesterRole === 'PARENT' || requesterRole === 'SUPER_ADMIN'
  const isOwner = requesterId && event.createdById === requesterId
  if (!isPrivileged && !isOwner) throw Errors.Forbidden()

  return prisma.familyEvent.update({
    where: { id: eventId },
    data: {
      ...data,
      // Chuyển đổi chuỗi ISO 8601 sang Date object nếu được cung cấp
      startDate: data.startDate ? new Date(data.startDate) : undefined,
      endDate: data.endDate ? new Date(data.endDate) : undefined,
      // Reset reminderSent khi ngày giờ thay đổi để tránh bỏ sót nhắc nhở
      // Nếu không reset, scheduler sẽ nghĩ đã gửi nhắc nhở rồi và bỏ qua
      ...(data.startDate && { reminderSent: false }),
    },
    include: {
      createdBy: {
        include: { user: { select: { id: true, displayName: true, avatarUrl: true } } },
      },
    },
  })
}

/**
 * Xóa một sự kiện khỏi lịch gia đình.
 * Chỉ xóa được sự kiện thuộc về đúng gia đình (kiểm tra theo familyId).
 *
 * @param eventId - ID của sự kiện cần xóa
 * @param familyId - ID của gia đình (để kiểm tra quyền sở hữu)
 * @throws {NotFoundError} Nếu không tìm thấy sự kiện với eventId và familyId tương ứng
 */
export async function deleteEvent(eventId: string, familyId: string) {
  // Kiểm tra sự kiện tồn tại và thuộc về đúng gia đình trước khi xóa
  const event = await prisma.familyEvent.findFirst({ where: { id: eventId, familyId } })
  if (!event) throw Errors.NotFound('Event')
  await prisma.familyEvent.delete({ where: { id: eventId } })
}
