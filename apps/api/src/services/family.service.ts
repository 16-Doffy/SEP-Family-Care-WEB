/**
 * @module family.service
 * @description Dịch vụ quản lý gia đình.
 *
 * Chịu trách nhiệm toàn bộ business logic liên quan đến:
 *   - Truy vấn và cập nhật thông tin gia đình
 *   - Sinh và xác thực mã mời (invite code) để thêm thành viên
 *   - Xử lý luồng tham gia gia đình (joinFamily): tạo FamilyMember, ví cá nhân,
 *     đánh dấu invite đã dùng và tự động thêm vào các group chat
 *   - Xóa (vô hiệu hóa) thành viên khỏi gia đình
 */

import { prisma } from '../config/database'
import { Errors } from '../utils/errors'
import type { Prisma } from '@prisma/client'
import { randomBytes } from 'crypto'
import { assertCanAddMember } from './plan-limits.service'

/**
 * Lấy thông tin chi tiết của một gia đình.
 *
 * Trả về danh sách thành viên đang hoạt động (isActive = true) kèm thông tin
 * người dùng và số dư ví cá nhân, cùng các ví chung (JOINT) của gia đình.
 *
 * @param familyId - ID gia đình cần truy vấn
 * @returns Đối tượng Family kèm thông tin subscription, thành viên và ví chung
 * @throws {NotFoundError} Khi familyId không tồn tại
 */
export async function getFamily(familyId: string) {
  return prisma.family.findUniqueOrThrow({
    where: { id: familyId },
    include: {
      subscriptionPlan: true,
      members: {
        include: {
          user: {
            // Chỉ lấy các trường cần thiết, tránh trả về passwordHash
            select: { id: true, email: true, displayName: true, avatarUrl: true, role: true },
          },
          wallet: { select: { id: true, balance: true } },
        },
        // Lọc chỉ lấy thành viên thuộc tài khoản còn hoạt động
        where: { user: { isActive: true } },
      },
      wallets: {
        // Chỉ lấy ví chung — ví cá nhân đã có trong mỗi member ở trên
        where: { type: 'JOINT' },
        select: { id: true, name: true, balance: true, currency: true },
      },
    },
  })
}

/**
 * Cập nhật tên gia đình.
 *
 * @param familyId - ID gia đình cần cập nhật
 * @param name - Tên mới của gia đình
 * @returns Đối tượng Family sau khi cập nhật
 * @throws {NotFoundError} Khi familyId không tồn tại
 */
export async function updateFamily(familyId: string, name: string) {
  return prisma.family.update({ where: { id: familyId }, data: { name } })
}

/**
 * Xác thực mã mời (invite code) có hợp lệ không.
 *
 * Kiểm tra theo thứ tự:
 *   1. Mã tồn tại trong database
 *   2. Mã chưa được sử dụng (usedAt = null)
 *   3. Mã chưa hết hạn (expiresAt > now)
 *
 * Hàm này được tái sử dụng trong cả `generateInviteCode` (auth flow) và
 * `joinFamily` để tránh lặp logic kiểm tra.
 *
 * @param code - Mã mời dạng hex string 32 ký tự
 * @returns Đối tượng FamilyInvite hợp lệ
 * @throws {NotFoundError} Khi mã không tồn tại
 * @throws {BadRequestError} Khi mã đã được dùng hoặc đã hết hạn
 */
export async function validateInviteCode(code: string) {
  const invite = await prisma.familyInvite.findUnique({ where: { code } })
  if (!invite) throw Errors.NotFound('Invite code')
  if (invite.usedAt) throw Errors.BadRequest('Invite code already used')
  if (invite.expiresAt.getTime() < Date.now()) {
    throw Errors.BadRequest('Invite code expired')
  }
  return invite
}

/**
 * Sinh mã mời mới để người dùng khác có thể tham gia gia đình.
 *
 * Mã được tạo bằng `randomBytes` (cryptographically secure) để tránh bị
 * đoán hay brute-force. Mỗi mã có hiệu lực 7 ngày và chỉ dùng được một lần.
 *
 * @param familyId - ID gia đình cần sinh mã mời
 * @param role - Vai trò sẽ được gán cho người dùng khi dùng mã này (PARENT | CHILD)
 * @returns Mã mời dạng hex string 32 ký tự
 */
export async function generateInviteCode(familyId: string, role: string): Promise<string> {
  // 16 bytes ngẫu nhiên → 32 ký tự hex; đủ entropy để không thể đoán được
  const code = randomBytes(16).toString('hex')
  await prisma.familyInvite.create({
    data: {
      familyId,
      code,
      role: role as 'PARENT' | 'CHILD',
      // Mã hết hạn sau 7 ngày kể từ thời điểm tạo
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  })
  return code
}

/**
 * Xử lý luồng người dùng tham gia gia đình bằng mã mời.
 *
 * Các bước thực hiện trong một transaction duy nhất:
 *   1. Xác thực mã mời (gọi validateInviteCode)
 *   2. Kiểm tra người dùng chưa thuộc gia đình nào
 *   3. Kiểm tra giới hạn số thành viên theo gói (assertCanAddMember)
 *   4. Cập nhật role của user theo invite
 *   5. Tạo bản ghi FamilyMember
 *   6. Tạo ví cá nhân cho thành viên mới
 *   7. Đánh dấu invite code đã dùng (usedAt = now)
 *
 * Sau transaction, tự động thêm thành viên vào các group chat của gia đình
 * (import động để tránh circular dependency với chat.service).
 *
 * @param userId - ID người dùng muốn tham gia
 * @param code - Mã mời hợp lệ
 * @returns Đối tượng FamilyMember vừa được tạo
 * @throws {BadRequestError} Khi mã mời không hợp lệ / đã dùng / hết hạn
 * @throws {ConflictError} Khi người dùng đã thuộc một gia đình
 * @throws {ForbiddenError} Khi gia đình đã đạt giới hạn số thành viên của gói
 */
export async function joinFamily(userId: string, code: string) {
  const invite = await validateInviteCode(code)

  // Mỗi user chỉ được thuộc một gia đình tại một thời điểm
  const existingMember = await prisma.familyMember.findUnique({ where: { userId } })
  if (existingMember) throw Errors.Conflict('You are already in a family')

  // Kiểm tra giới hạn thành viên theo gói subscription của gia đình
  await assertCanAddMember(invite.familyId)

  const member = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // Cập nhật role của user theo role được chỉ định trong invite code
    await tx.user.update({
      where: { id: userId },
      data: { role: invite.role as 'PARENT' | 'CHILD' },
    })

    const newMember = await tx.familyMember.create({
      data: { userId, familyId: invite.familyId },
    })

    // Tạo ví cá nhân cho thành viên mới — mọi thành viên đều có ví riêng
    const user = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { displayName: true },
    })
    await tx.wallet.create({
      data: {
        familyId: invite.familyId,
        name: `Ví ${user.displayName}`,
        type: 'PERSONAL',
        balance: 0,
        ownerId: newMember.id,
      },
    })

    // Đánh dấu invite code đã được sử dụng để ngăn dùng lại
    await tx.familyInvite.update({
      where: { code },
      data: { usedAt: new Date() },
    })

    return newMember
  })

  // Tự động thêm thành viên mới vào tất cả group chat của gia đình.
  // Dùng import động để tránh circular dependency (chat.service cũng import family.service).
  // Bọc trong try/catch để lỗi chat không làm hỏng luồng join family chính.
  try {
    const { addParticipantToGroupChats } = await import('./chat.service')
    await addParticipantToGroupChats(invite.familyId, userId)
  } catch {}

  return member
}

/**
 * Xóa thành viên khỏi gia đình (vô hiệu hóa tài khoản).
 *
 * Thay vì xóa cứng bản ghi, hệ thống đặt `isActive = false` để:
 *   - Giữ lại lịch sử giao dịch, tin nhắn liên quan đến thành viên cũ
 *   - Có thể khôi phục tài khoản khi cần
 *
 * @param familyId - ID gia đình chứa thành viên cần xóa
 * @param targetUserId - ID người dùng cần xóa khỏi gia đình
 * @param requesterId - ID người thực hiện yêu cầu (dùng để ngăn tự xóa mình)
 * @throws {BadRequestError} Khi người dùng cố xóa chính họ
 * @throws {NotFoundError} Khi targetUserId không thuộc familyId
 */
export async function removeMember(familyId: string, targetUserId: string, requesterId: string) {
  // Ngăn PARENT tự xóa tài khoản của mình qua API này
  if (targetUserId === requesterId) throw Errors.BadRequest('Cannot remove yourself')

  const member = await prisma.familyMember.findFirst({
    where: { userId: targetUserId, familyId },
  })
  if (!member) throw Errors.NotFound('Family member')

  // Soft-delete: vô hiệu hóa tài khoản thay vì xóa để giữ lại dữ liệu lịch sử
  await prisma.user.update({
    where: { id: targetUserId },
    data: { isActive: false },
  })
}
