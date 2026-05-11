import { prisma } from '../config/database'
import { Errors } from '../utils/errors'
import { transfer } from './wallet.service'

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

export async function getMoneyRequests(familyId: string) {
  return prisma.moneyRequest.findMany({
    where: { familyId },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    take: 100,
    include: {
      requester: { include: { user: { select: { id: true, displayName: true, avatarUrl: true } } } },
      resolvedBy: { include: { user: { select: { id: true, displayName: true } } } },
    },
  })
}

export async function getPendingRequests(familyId: string) {
  return prisma.moneyRequest.findMany({
    where: { familyId, status: 'PENDING' },
    orderBy: { createdAt: 'desc' },
    include: {
      requester: { include: { user: { select: { id: true, displayName: true, avatarUrl: true } } } },
    },
  })
}

export async function resolveMoneyRequest(input: {
  id: string
  familyId: string
  status: 'APPROVED' | 'REJECTED'
  resolvedById: string  // FamilyMember.id
  note?: string
}) {
  const request = await prisma.moneyRequest.findFirst({
    where: { id: input.id, familyId: input.familyId, status: 'PENDING' },
    include: {
      requester: { include: { wallet: true, user: { select: { displayName: true } } } },
    },
  })
  if (!request) throw Errors.NotFound('Yêu cầu không tồn tại hoặc đã được xử lý')

  if (input.status === 'APPROVED') {
    // Find joint wallet
    const jointWallet = await prisma.wallet.findFirst({
      where: { familyId: input.familyId, type: 'JOINT' },
    })
    if (!jointWallet) throw Errors.NotFound('Ví chung')

    const personalWallet = request.requester.wallet
    if (!personalWallet) throw Errors.NotFound('Ví cá nhân của người yêu cầu')

    const balance = Number(jointWallet.balance)
    const amount = Number(request.amount)
    if (balance < amount) throw Errors.InsufficientFunds()

    // Execute transfer
    await transfer({
      fromWalletId: jointWallet.id,
      toWalletId: personalWallet.id,
      amount,
      description: `Duyệt yêu cầu: ${request.reason ?? 'Xin tiền'}`,
      familyId: input.familyId,
    })
  }

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

export async function getParentUserIds(familyId: string): Promise<string[]> {
  const members = await prisma.familyMember.findMany({
    where: { familyId, user: { role: { in: ['PARENT', 'SUPER_ADMIN'] } } },
    select: { userId: true },
  })
  return members.map((m) => m.userId)
}
