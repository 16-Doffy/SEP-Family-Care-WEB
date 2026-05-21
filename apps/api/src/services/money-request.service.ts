/**
 * @module money-request.service
 * @description Dịch vụ quản lý yêu cầu xin tiền trong gia đình.
 * Cho phép thành viên gửi yêu cầu xin tiền tới phụ huynh; phụ huynh có thể
 * duyệt (APPROVED) hoặc từ chối (REJECTED) yêu cầu.
 *
 * Khi duyệt, hệ thống tự động thực hiện chuyển khoản từ ví chung (JOINT)
 * sang ví cá nhân của người yêu cầu thông qua `wallet.service`.
 */

import { prisma } from '../config/database'
import { Errors } from '../utils/errors'
import { transfer } from './wallet.service'

type MoneyRequestAccess = {
  role: string
  familyMemberId?: string
}

/**
 * Tạo một yêu cầu xin tiền mới trong gia đình.
 *
 * @param input - Thông tin yêu cầu
 * @param input.familyId - ID của gia đình
 * @param input.requesterId - ID của `FamilyMember` (không phải `User`) đang gửi yêu cầu
 * @param input.amount - Số tiền cần xin (phải lớn hơn 0)
 * @param input.reason - Lý do xin tiền (tùy chọn)
 * @returns Bản ghi `MoneyRequest` vừa tạo, kèm thông tin người yêu cầu.
 * @throws {BadRequestError} Nếu số tiền <= 0
 */
export async function createMoneyRequest(input: {
  familyId: string
  requesterId: string  // FamilyMember.id
  amount: number
  reason?: string
}) {
  if (input.amount <= 0) throw Errors.BadRequest('Số tiền phải lớn hơn 0')

  return prisma.moneyRequest.create({
    data: {
      familyId: input.familyId,
      requesterId: input.requesterId,
      amount: input.amount,
      reason: input.reason,
    },
    include: {
      requester: { include: { user: { select: { id: true, displayName: true } } } },
    },
  })
}

/**
 * Lấy toàn bộ lịch sử yêu cầu xin tiền của một gia đình.
 * Sắp xếp: các yêu cầu đang chờ (PENDING) lên trước, trong mỗi trạng thái
 * sắp theo mới nhất. Giới hạn 100 bản ghi để tránh quá tải.
 *
 * @param familyId - ID của gia đình cần truy vấn
 * @returns Mảng `MoneyRequest` kèm thông tin người yêu cầu và người xử lý.
 */
export async function getMoneyRequests(familyId: string, access?: MoneyRequestAccess) {
  return prisma.moneyRequest.findMany({
    where: {
      familyId,
      ...(access?.role === 'FAMILY_MEMBER' && { requesterId: access.familyMemberId }),
    },
    // status 'asc': APPROVED < PENDING < REJECTED theo alphabet → PENDING lên trước
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    take: 100,
    include: {
      requester: { include: { user: { select: { id: true, displayName: true, avatarUrl: true } } } },
      resolvedBy: { include: { user: { select: { id: true, displayName: true } } } },
    },
  })
}

/**
 * Lấy danh sách các yêu cầu xin tiền đang chờ xử lý (PENDING) trong một gia đình.
 * Thường dùng để hiển thị badge số yêu cầu cần duyệt cho phụ huynh.
 *
 * @param familyId - ID của gia đình cần truy vấn
 * @returns Mảng `MoneyRequest` có trạng thái PENDING, kèm thông tin người yêu cầu.
 */
export async function getPendingRequests(familyId: string, access?: MoneyRequestAccess) {
  return prisma.moneyRequest.findMany({
    where: {
      familyId,
      status: 'PENDING',
      ...(access?.role === 'FAMILY_MEMBER' && { requesterId: access.familyMemberId }),
    },
    orderBy: { createdAt: 'desc' },
    include: {
      requester: { include: { user: { select: { id: true, displayName: true, avatarUrl: true } } } },
    },
  })
}

/**
 * Xử lý (duyệt hoặc từ chối) một yêu cầu xin tiền.
 *
 * Luồng khi APPROVED:
 * 1. Tìm ví chung (JOINT) của gia đình và ví cá nhân của người yêu cầu.
 * 2. Kiểm tra số dư ví chung có đủ không.
 * 3. Thực hiện chuyển tiền từ ví chung sang ví cá nhân.
 * 4. Cập nhật trạng thái yêu cầu thành APPROVED.
 *
 * Chỉ xử lý được yêu cầu đang ở trạng thái PENDING — nếu đã xử lý rồi sẽ báo lỗi.
 *
 * @param input - Thông tin xử lý yêu cầu
 * @param input.id - ID của yêu cầu cần xử lý
 * @param input.familyId - ID của gia đình (để xác nhận quyền truy cập)
 * @param input.status - Trạng thái mới: `'APPROVED'` để duyệt, `'REJECTED'` để từ chối
 * @param input.resolvedById - ID của `FamilyMember` (phụ huynh) đang xử lý
 * @param input.note - Ghi chú kèm theo khi từ chối (tùy chọn)
 * @returns Bản ghi `MoneyRequest` đã cập nhật, kèm thông tin người yêu cầu và người xử lý.
 * @throws {NotFoundError} Nếu yêu cầu không tồn tại, không thuộc gia đình, hoặc đã được xử lý
 * @throws {NotFoundError} Nếu ví chung hoặc ví cá nhân không tồn tại (khi APPROVED)
 * @throws {InsufficientFundsError} Nếu số dư ví chung không đủ (khi APPROVED)
 */
export async function resolveMoneyRequest(input: {
  id: string
  familyId: string
  status: 'APPROVED' | 'REJECTED'
  resolvedById: string  // FamilyMember.id
  note?: string
}) {
  // Chỉ tìm yêu cầu đang PENDING để tránh xử lý lại yêu cầu đã được giải quyết
  const request = await prisma.moneyRequest.findFirst({
    where: { id: input.id, familyId: input.familyId, status: 'PENDING' },
    include: {
      requester: { include: { wallet: true, user: { select: { displayName: true } } } },
    },
  })
  if (!request) throw Errors.NotFound('Yêu cầu không tồn tại hoặc đã được xử lý')

  if (input.status === 'APPROVED') {
    // Tìm ví chung của gia đình để trừ tiền ra
    const jointWallet = await prisma.wallet.findFirst({
      where: { familyId: input.familyId, type: 'JOINT' },
    })
    if (!jointWallet) throw Errors.NotFound('Ví chung')

    const personalWallet = request.requester.wallet
    if (!personalWallet) throw Errors.NotFound('Ví cá nhân của người yêu cầu')

    // Chuyển về Number vì Prisma trả về Decimal cho trường tiền tệ
    const balance = Number(jointWallet.balance)
    const amount = Number(request.amount)
    if (balance < amount) throw Errors.InsufficientFunds()

    // Thực hiện chuyển khoản; hàm transfer xử lý ghi transaction log và cập nhật số dư
    await transfer({
      fromWalletId: jointWallet.id,
      toWalletId: personalWallet.id,
      amount,
      description: `Duyệt yêu cầu: ${request.reason ?? 'Xin tiền'}`,
      familyId: input.familyId,
      type: 'MONEY_REQUEST_PAYOUT',
    })
  }

  // Cập nhật trạng thái sau khi chuyển tiền thành công (hoặc khi từ chối)
  return prisma.moneyRequest.update({
    where: { id: input.id },
    data: {
      status: input.status,
      note: input.note,
      resolvedAt: new Date(),
      resolvedById: input.resolvedById,
    },
    include: {
      requester: { include: { user: { select: { id: true, displayName: true } } } },
      resolvedBy: { include: { user: { select: { id: true, displayName: true } } } },
    },
  })
}

/**
 * Lấy danh sách `userId` của tất cả phụ huynh trong một gia đình.
 * Dùng để gửi thông báo đến tất cả phụ huynh khi có yêu cầu xin tiền mới.
 *
 * Lọc theo vai trò `PARENT` và `SUPER_ADMIN` vì cả hai đều có quyền duyệt yêu cầu.
 *
 * @param familyId - ID của gia đình cần lấy danh sách phụ huynh
 * @returns Mảng `userId` (string[]) của các thành viên có vai trò phụ huynh.
 */
export async function getParentUserIds(familyId: string): Promise<string[]> {
  const members = await prisma.familyMember.findMany({
    where: { familyId, user: { role: { in: ['PARENT', 'SUPER_ADMIN'] } } },
    select: { userId: true },
  })
  return members.map((m) => m.userId)
}
