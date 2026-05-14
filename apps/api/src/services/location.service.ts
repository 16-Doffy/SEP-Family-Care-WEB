/**
 * @module location.service
 * @description Dịch vụ quản lý chia sẻ vị trí thực thời giữa các thành viên trong gia đình.
 * Sử dụng bảng `LocationShare` trong database để lưu trữ trạng thái chia sẻ
 * và tọa độ GPS của từng thành viên.
 */

import { prisma } from '../config/database'

/**
 * Lấy danh sách vị trí của tất cả thành viên đang bật chia sẻ trong một gia đình.
 *
 * @param familyId - ID của gia đình cần truy vấn
 * @returns Danh sách các bản ghi LocationShare (chỉ những người đang `isSharing = true`),
 *          bao gồm thông tin cơ bản của người dùng (id, tên hiển thị, avatar),
 *          sắp xếp theo thời gian cập nhật mới nhất.
 */
export async function getFamilyLocations(familyId: string) {
  return prisma.locationShare.findMany({
    where: { familyId, isSharing: true },
    include: {
      user: { select: { id: true, displayName: true, avatarUrl: true } },
    },
    orderBy: { updatedAt: 'desc' },
  })
}

/**
 * Lấy trạng thái chia sẻ vị trí hiện tại của một người dùng cụ thể.
 *
 * @param userId - ID của người dùng cần kiểm tra
 * @returns Bản ghi LocationShare của người dùng đó, hoặc `null` nếu chưa tồn tại.
 */
export async function getMyShare(userId: string) {
  return prisma.locationShare.findUnique({ where: { userId } })
}

/**
 * Bật hoặc tắt tính năng chia sẻ vị trí cho người dùng trong một gia đình.
 *
 * Khi tắt chia sẻ (`isSharing = false`), tọa độ GPS sẽ được xóa khỏi database
 * để bảo vệ quyền riêng tư của người dùng.
 * Sử dụng `upsert` để đảm bảo bản ghi luôn được tạo nếu chưa có.
 *
 * @param userId - ID của người dùng cần cập nhật trạng thái
 * @param familyId - ID của gia đình mà người dùng đang thuộc về
 * @param isSharing - `true` để bật chia sẻ, `false` để tắt
 * @returns Bản ghi LocationShare đã được cập nhật, kèm thông tin người dùng.
 */
export async function setSharing(userId: string, familyId: string, isSharing: boolean) {
  return prisma.locationShare.upsert({
    where: { userId },
    create: { userId, familyId, isSharing },
    // Khi tắt chia sẻ, xóa tọa độ để tránh lộ vị trí cũ cho các thành viên khác
    update: { isSharing, ...(isSharing ? {} : { latitude: null, longitude: null, accuracy: null }) },
    include: {
      user: { select: { id: true, displayName: true, avatarUrl: true } },
    },
  })
}

/**
 * Cập nhật tọa độ GPS mới nhất của người dùng và tự động bật chia sẻ.
 *
 * Sử dụng `upsert` để tạo bản ghi mới nếu người dùng chưa từng chia sẻ trước đó.
 * Việc gọi hàm này sẽ luôn đặt `isSharing = true` vì nếu client gửi tọa độ
 * thì nghĩa là người dùng đang muốn chia sẻ vị trí.
 *
 * @param userId - ID của người dùng đang cập nhật vị trí
 * @param familyId - ID của gia đình mà người dùng thuộc về
 * @param data - Dữ liệu tọa độ GPS
 * @param data.latitude - Vĩ độ (từ -90 đến 90)
 * @param data.longitude - Kinh độ (từ -180 đến 180)
 * @param data.accuracy - Độ chính xác của GPS tính bằng mét (tùy chọn)
 * @returns Bản ghi LocationShare đã được cập nhật, kèm thông tin người dùng.
 */
export async function updateLocation(
  userId: string,
  familyId: string,
  data: { latitude: number; longitude: number; accuracy?: number },
) {
  return prisma.locationShare.upsert({
    where: { userId },
    create: {
      userId,
      familyId,
      isSharing: true,
      latitude: data.latitude,
      longitude: data.longitude,
      accuracy: data.accuracy,
    },
    update: {
      isSharing: true,
      latitude: data.latitude,
      longitude: data.longitude,
      accuracy: data.accuracy,
    },
    include: {
      user: { select: { id: true, displayName: true, avatarUrl: true } },
    },
  })
}
