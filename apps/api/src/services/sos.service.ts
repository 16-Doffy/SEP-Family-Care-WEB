/**
 * @module sos.service
 * @description Cung cấp các hàm nghiệp vụ cho hệ thống cảnh báo khẩn cấp SOS.
 *
 * Vòng đời của một SOS alert:
 *  ACTIVE → ACKNOWLEDGED → RESOLVED | FALSE_ALARM
 *
 *  - ACTIVE: Cảnh báo vừa được tạo, chưa ai phản hồi
 *  - ACKNOWLEDGED: Một thành viên đã xác nhận nhận được cảnh báo
 *  - RESOLVED: Tình huống khẩn cấp đã được giải quyết
 *  - FALSE_ALARM: Xác nhận đây là cảnh báo nhầm
 *
 * Thông tin vị trí (latitude, longitude, address) là tùy chọn vì người dùng
 * có thể không cấp quyền định vị hoặc thiết bị không hỗ trợ GPS.
 */

import { prisma } from '../config/database'
import { Errors } from '../utils/errors'

/**
 * Dữ liệu đầu vào để tạo một SOS alert mới.
 */
interface CreateSOSInput {
  /** ID của gia đình gửi cảnh báo */
  familyId: string
  /** ID của người dùng kích hoạt SOS */
  senderId: string
  /** Nguồn kích hoạt: app mobile, wearable hoặc GPS device */
  source?: 'MOBILE_APP' | 'WEARABLE' | 'GPS_DEVICE' | 'MOCK'
  /** Thiết bị kích hoạt SOS nếu có */
  deviceId?: string
  /** true khi cảnh báo đến từ fall detection */
  fallDetected?: boolean
  /** Vĩ độ (latitude) của vị trí khẩn cấp (tùy chọn) */
  latitude?: number
  /** Kinh độ (longitude) của vị trí khẩn cấp (tùy chọn) */
  longitude?: number
  /** Địa chỉ text của vị trí khẩn cấp (tùy chọn, có thể là kết quả reverse geocoding) */
  address?: string
  /** Tin nhắn đính kèm mô tả tình huống khẩn cấp (tùy chọn) */
  message?: string
}

/**
 * Tạo một SOS alert mới với trạng thái ban đầu là ACTIVE.
 * Alert mới luôn được đặt ACTIVE để phân biệt với các alert đã xử lý.
 *
 * @param input - Thông tin của cảnh báo SOS cần tạo
 * @returns SOS alert vừa tạo kèm thông tin người gửi
 */
export async function createSOSAlert(input: CreateSOSInput) {
  return prisma.sosAlert.create({
    data: {
      familyId: input.familyId,
      senderId: input.senderId,
      latitude: input.latitude,
      longitude: input.longitude,
      address: input.address,
      message: input.message,
      source: input.source ?? 'MOBILE_APP',
      deviceId: input.deviceId,
      fallDetected: input.fallDetected ?? false,
      // Trạng thái khởi tạo luôn là ACTIVE để thành viên biết cần phản hồi ngay
      status: 'ACTIVE',
    },
    include: {
      sender: { select: { id: true, displayName: true, avatarUrl: true } },
      device: { select: { id: true, name: true, type: true, deviceCode: true } },
    },
  })
}

/**
 * Lấy lịch sử tất cả SOS alert của một gia đình (bao gồm cả đã giải quyết).
 * Giới hạn 50 bản ghi mới nhất để tránh tải quá nhiều dữ liệu.
 *
 * @param familyId - ID của gia đình cần lấy lịch sử
 * @returns Danh sách SOS alert, sắp xếp theo thời gian tạo giảm dần (mới nhất trước)
 */
export async function getFamilySOSAlerts(familyId: string) {
  return prisma.sosAlert.findMany({
    where: { familyId },
    orderBy: { createdAt: 'desc' },
    // Giới hạn 50 bản ghi để tránh overfetch; có thể thêm pagination sau nếu cần
    take: 50,
    include: {
      sender: { select: { id: true, displayName: true, avatarUrl: true } },
      // resolvedBy chỉ có giá trị khi status là RESOLVED hoặc FALSE_ALARM
      resolvedBy: { select: { id: true, displayName: true } },
      device: { select: { id: true, name: true, type: true, deviceCode: true } },
    },
  })
}

/**
 * Lấy danh sách các SOS alert đang cần xử lý (chưa được giải quyết).
 * Bao gồm cả ACTIVE và ACKNOWLEDGED vì cả hai đều cần được theo dõi.
 * Không bao gồm RESOLVED và FALSE_ALARM vì đã kết thúc vòng đời.
 *
 * @param familyId - ID của gia đình
 * @returns Danh sách SOS alert đang hoạt động, sắp xếp mới nhất trước
 */
export async function getActiveSOSAlerts(familyId: string) {
  return prisma.sosAlert.findMany({
    where: {
      familyId,
      // Dùng `in` thay vì điều kiện OR để rõ ràng và dễ mở rộng sau này
      status: { in: ['ACTIVE', 'ACKNOWLEDGED'] },
    },
    orderBy: { createdAt: 'desc' },
    include: {
      sender: { select: { id: true, displayName: true, avatarUrl: true } },
      resolvedBy: { select: { id: true, displayName: true } },
      device: { select: { id: true, name: true, type: true, deviceCode: true } },
    },
  })
}

/**
 * Cập nhật trạng thái của một SOS alert.
 * `resolvedById` và `resolvedAt` chỉ được set khi chuyển sang RESOLVED hoặc FALSE_ALARM,
 * vì chỉ ở hai trạng thái này mới coi là "kết thúc" vòng đời của alert.
 * Trạng thái ACKNOWLEDGED chỉ là xác nhận đã nhìn thấy, chưa phải kết thúc.
 *
 * @param id - ID của SOS alert cần cập nhật
 * @param familyId - ID của gia đình (để đảm bảo chỉ cập nhật alert của đúng gia đình)
 * @param status - Trạng thái mới: ACKNOWLEDGED | RESOLVED | FALSE_ALARM
 * @param resolvedById - ID của người xử lý (bắt buộc khi RESOLVED/FALSE_ALARM)
 * @returns SOS alert sau khi cập nhật kèm thông tin người gửi và người xử lý
 * @throws {NotFoundError} Nếu alert không tồn tại hoặc không thuộc gia đình
 */
export async function updateSOSStatus(
  id: string,
  familyId: string,
  status: 'ACKNOWLEDGED' | 'RESOLVED' | 'FALSE_ALARM',
  resolvedById?: string,
) {
  // Kiểm tra alert tồn tại và thuộc đúng gia đình trước khi cập nhật.
  // Prisma update chỉ chấp nhận unique field (id) trong where — không thể kết hợp
  // non-unique field (familyId) trực tiếp trong where của update.
  const existing = await prisma.sosAlert.findFirst({ where: { id, familyId } })
  if (!existing) throw Errors.NotFound('SOS Alert')

  return prisma.sosAlert.update({
    where: { id },
    data: {
      status,
      // Chỉ ghi nhận người giải quyết và thời điểm khi alert thực sự kết thúc
      resolvedById: status === 'RESOLVED' || status === 'FALSE_ALARM' ? resolvedById : undefined,
      resolvedAt: status === 'RESOLVED' || status === 'FALSE_ALARM' ? new Date() : undefined,
    },
    include: {
      sender: { select: { id: true, displayName: true, avatarUrl: true } },
      resolvedBy: { select: { id: true, displayName: true } },
      device: { select: { id: true, name: true, type: true, deviceCode: true } },
    },
  })
}

/**
 * Lấy danh sách userId của các thành viên trong gia đình, ngoại trừ một người dùng cụ thể.
 * Được dùng để gửi thông báo SOS đến tất cả thành viên khác (không gửi lại cho người kích hoạt).
 *
 * @param familyId - ID của gia đình
 * @param excludeUserId - ID của người dùng cần loại trừ khỏi danh sách
 * @returns Mảng userId của các thành viên còn lại trong gia đình
 */
export async function getFamilyMemberUserIds(familyId: string, excludeUserId: string) {
  const members = await prisma.familyMember.findMany({
    where: { familyId, userId: { not: excludeUserId } },
    select: { userId: true },
  })
  // Trích xuất mảng userId thuần từ kết quả query
  return members.map((m) => m.userId)
}
