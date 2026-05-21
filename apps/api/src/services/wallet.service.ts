/**
 * @module wallet.service
 * @description Dịch vụ quản lý ví tiền trong hệ thống gia đình.
 * Cung cấp các chức năng: xem danh sách ví, xem lịch sử giao dịch,
 * chuyển tiền giữa các ví và nạp tiền vào ví.
 *
 * Tất cả các thao tác thay đổi số dư đều được thực hiện trong một
 * database transaction để đảm bảo tính toàn vẹn dữ liệu (atomicity).
 */

import { prisma } from '../config/database'
import { Errors } from '../utils/errors'
import type { Prisma } from '@prisma/client'

type WalletAccess = {
  role: string
  familyMemberId?: string
}

/**
 * Lấy danh sách tất cả ví thuộc một gia đình.
 * Kết quả bao gồm thông tin chủ sở hữu (tên hiển thị, ảnh đại diện).
 * Được sắp xếp theo loại ví (type) rồi đến ngày tạo.
 *
 * @param familyId - ID của gia đình cần truy vấn.
 * @returns Danh sách các ví kèm thông tin chủ sở hữu.
 */
export async function getWallets(familyId: string, access?: WalletAccess) {
  return prisma.wallet.findMany({
    where: {
      familyId,
      ...(access?.role === 'FAMILY_MEMBER' && { ownerId: access.familyMemberId }),
    },
    include: {
      owner: {
        include: {
          // Chỉ lấy những trường cần thiết để tránh lộ thông tin nhạy cảm
          user: { select: { displayName: true, avatarUrl: true } },
        },
      },
    },
    // Sắp xếp: ví chung (JOINT) lên trước, trong cùng loại thì theo ngày tạo
    orderBy: [{ type: 'asc' }, { createdAt: 'asc' }],
  })
}

/**
 * Lấy thông tin chi tiết của một ví kèm theo 50 giao dịch gần nhất.
 * Giao dịch bao gồm cả chiều gửi (fromWallet) và chiều nhận (toWallet).
 *
 * @param walletId - ID của ví cần xem.
 * @param familyId - ID gia đình dùng để kiểm tra quyền truy cập (ví phải thuộc gia đình này).
 * @returns Đối tượng chứa thông tin ví và danh sách giao dịch.
 * @throws {NotFoundError} Nếu ví không tồn tại hoặc không thuộc gia đình.
 */
export async function getWalletWithTransactions(walletId: string, familyId: string, access?: WalletAccess) {
  // Kiểm tra ví tồn tại và thuộc gia đình hiện tại
  const wallet = await prisma.wallet.findFirst({
    where: {
      id: walletId,
      familyId,
      ...(access?.role === 'FAMILY_MEMBER' && { ownerId: access.familyMemberId }),
    },
    include: {
      owner: {
        include: {
          user: { select: { displayName: true, avatarUrl: true } },
        },
      },
    },
  })
  if (!wallet) throw Errors.NotFound('Wallet')

  // Lấy giao dịch từ cả hai chiều: ví này đã gửi đi hoặc đã nhận vào
  const transactions = await prisma.transaction.findMany({
    where: {
      OR: [{ fromWalletId: walletId }, { toWalletId: walletId }],
    },
    include: {
      fromWallet: { select: { id: true, name: true } },
      toWallet: { select: { id: true, name: true } },
      // Liên kết nhiệm vụ nếu giao dịch là phần thưởng task
      task: { select: { id: true, title: true } },
    },
    // Hiển thị giao dịch mới nhất trước
    orderBy: { createdAt: 'desc' },
    // Giới hạn 50 giao dịch để tránh trả về quá nhiều dữ liệu
    take: 50,
  })

  return { wallet, transactions }
}

/**
 * Chuyển tiền giữa hai ví trong cùng một gia đình.
 *
 * Toàn bộ quá trình (trừ số dư ví nguồn, cộng số dư ví đích, tạo bản ghi giao dịch)
 * được thực hiện trong một database transaction duy nhất. Nếu bất kỳ bước nào thất bại,
 * tất cả thay đổi sẽ được rollback để tránh mất tiền hoặc tạo tiền từ không khí.
 *
 * @param input - Thông tin chuyển tiền.
 * @param input.fromWalletId - ID ví nguồn (ví bị trừ tiền).
 * @param input.toWalletId - ID ví đích (ví được cộng tiền).
 * @param input.amount - Số tiền cần chuyển (phải > 0).
 * @param input.description - Mô tả giao dịch (tuỳ chọn).
 * @param input.familyId - ID gia đình để xác thực cả hai ví đều thuộc gia đình này.
 * @param input.type - Loại giao dịch, mặc định là 'TRANSFER'. Dùng 'TASK_REWARD' khi trả thưởng task.
 * @param input.taskId - ID nhiệm vụ liên quan (chỉ dùng khi type là 'TASK_REWARD').
 * @returns Bản ghi giao dịch vừa được tạo kèm thông tin ví nguồn và ví đích.
 * @throws {BadRequestError} Nếu amount <= 0.
 * @throws {NotFoundError} Nếu ví nguồn hoặc ví đích không tồn tại trong gia đình.
 * @throws {InsufficientFundsError} Nếu số dư ví nguồn không đủ.
 */
export async function transfer(input: {
  fromWalletId: string
  toWalletId: string
  amount: number
  description?: string
  familyId: string
  type?: 'TRANSFER' | 'TASK_REWARD' | 'MONEY_REQUEST_PAYOUT'
  taskId?: string
}) {
  if (input.amount <= 0) throw Errors.BadRequest('Amount must be greater than 0')

  // Dùng prisma.$transaction với callback để đảm bảo tính nguyên tử (atomicity):
  // tất cả các thao tác đọc/ghi xảy ra trong cùng một transaction của database.
  // Nếu bất kỳ lệnh nào ném lỗi, Prisma sẽ tự động rollback toàn bộ.
  const transaction = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // Đọc ví nguồn bên trong transaction để có số dư chính xác (tránh race condition)
    const fromWallet = await tx.wallet.findFirst({
      where: { id: input.fromWalletId, familyId: input.familyId },
    })
    if (!fromWallet) throw Errors.NotFound('Source wallet')

    // Xác nhận ví đích cũng thuộc cùng gia đình
    const toWallet = await tx.wallet.findFirst({
      where: { id: input.toWalletId, familyId: input.familyId },
    })
    if (!toWallet) throw Errors.NotFound('Destination wallet')

    // Kiểm tra số dư trước khi trừ để tránh số dư âm
    const currentBalance = Number(fromWallet.balance)
    if (currentBalance < input.amount) throw Errors.InsufficientFunds()

    // Trừ tiền ở ví nguồn
    await tx.wallet.update({
      where: { id: input.fromWalletId },
      data: { balance: { decrement: input.amount } },
    })

    // Cộng tiền vào ví đích
    await tx.wallet.update({
      where: { id: input.toWalletId },
      data: { balance: { increment: input.amount } },
    })

    // Tạo bản ghi lịch sử giao dịch
    return tx.transaction.create({
      data: {
        fromWalletId: input.fromWalletId,
        toWalletId: input.toWalletId,
        amount: input.amount,
        // Nếu không truyền type thì mặc định là TRANSFER (chuyển khoản thông thường)
        type: input.type ?? 'TRANSFER',
        description: input.description,
        taskId: input.taskId,
      },
      include: {
        fromWallet: { select: { id: true, name: true } },
        toWallet: { select: { id: true, name: true } },
      },
    })
  })

  return transaction
}

/**
 * Nạp tiền vào một ví (không cần ví nguồn, tiền được tạo mới từ bên ngoài).
 * Thường dùng khi phụ huynh muốn thêm tiền vào ví chung hoặc ví cá nhân.
 *
 * Cập nhật số dư và tạo bản ghi giao dịch DEPOSIT được thực hiện trong
 * cùng một database transaction để đảm bảo nhất quán.
 *
 * @param walletId - ID ví cần nạp tiền.
 * @param amount - Số tiền nạp vào (phải > 0).
 * @param description - Mô tả lý do nạp tiền.
 * @param familyId - ID gia đình để xác thực ví thuộc gia đình này.
 * @returns Bản ghi giao dịch DEPOSIT vừa được tạo.
 * @throws {BadRequestError} Nếu amount <= 0.
 * @throws {NotFoundError} Nếu ví không tồn tại hoặc không thuộc gia đình.
 */
export async function deposit(walletId: string, amount: number, description: string, familyId: string) {
  if (amount <= 0) throw Errors.BadRequest('Amount must be greater than 0')

  // Xác thực ví trước khi bắt đầu transaction
  const wallet = await prisma.wallet.findFirst({ where: { id: walletId, familyId } })
  if (!wallet) throw Errors.NotFound('Wallet')

  // Dùng mảng transaction (sequential) để cập nhật số dư và tạo lịch sử trong cùng một lần
  // Đây là dạng batch transaction — Prisma thực thi tuần tự và rollback nếu có lỗi.
  const [, transaction] = await prisma.$transaction([
    // Bước 1: Cộng số tiền nạp vào số dư hiện tại của ví
    prisma.wallet.update({
      where: { id: walletId },
      data: { balance: { increment: amount } },
    }),
    // Bước 2: Ghi lại lịch sử giao dịch loại DEPOSIT (chỉ có toWallet, không có fromWallet)
    prisma.transaction.create({
      data: {
        toWalletId: walletId,
        amount,
        type: 'DEPOSIT',
        description,
      },
    }),
  ])

  // Trả về bản ghi giao dịch (phần tử thứ hai trong mảng kết quả)
  return transaction
}

/**
 * Trừ tiền khỏi một ví (WITHDRAWAL) — không có ví đích.
 * Dùng khi ghi nhận chi tiêu thực tế và chọn "trừ ví":
 *  - FamilyExpense → trừ ví JOINT
 *  - PersonalExpense → trừ ví PERSONAL của member
 *
 * Idempotent: nếu số dư không đủ, ném `InsufficientFunds` (KHÔNG cho phép âm).
 *
 * @returns Transaction WITHDRAWAL vừa tạo (kèm `id` để gắn vào expense record).
 */
export async function withdraw(input: {
  walletId: string
  amount: number
  description?: string
  familyId: string
}) {
  if (input.amount <= 0) throw Errors.BadRequest('Amount must be greater than 0')

  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const wallet = await tx.wallet.findFirst({
      where: { id: input.walletId, familyId: input.familyId },
    })
    if (!wallet) throw Errors.NotFound('Wallet')
    if (Number(wallet.balance) < input.amount) throw Errors.InsufficientFunds()

    await tx.wallet.update({
      where: { id: input.walletId },
      data: { balance: { decrement: input.amount } },
    })

    return tx.transaction.create({
      data: {
        fromWalletId: input.walletId,
        amount: input.amount,
        type: 'WITHDRAWAL',
        description: input.description,
      },
    })
  })
}
