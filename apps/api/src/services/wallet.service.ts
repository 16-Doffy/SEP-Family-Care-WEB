import { prisma } from '../config/database'
import { Errors } from '../utils/errors'
import type { Prisma } from '@prisma/client'

export async function getWallets(familyId: string) {
  return prisma.wallet.findMany({
    where: { familyId },
    include: {
      owner: {
        include: {
          user: { select: { displayName: true, avatarUrl: true } },
        },
      },
    },
    orderBy: [{ type: 'asc' }, { createdAt: 'asc' }],
  })
}

export async function getWalletWithTransactions(walletId: string, familyId: string) {
  const wallet = await prisma.wallet.findFirst({
    where: { id: walletId, familyId },
    include: {
      owner: {
        include: {
          user: { select: { displayName: true, avatarUrl: true } },
        },
      },
    },
  })
  if (!wallet) throw Errors.NotFound('Wallet')

  const transactions = await prisma.transaction.findMany({
    where: {
      OR: [{ fromWalletId: walletId }, { toWalletId: walletId }],
    },
    include: {
      fromWallet: { select: { id: true, name: true } },
      toWallet: { select: { id: true, name: true } },
      task: { select: { id: true, title: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  return { wallet, transactions }
}

export async function transfer(input: {
  fromWalletId: string
  toWalletId: string
  amount: number
  description?: string
  familyId: string
  type?: 'TRANSFER' | 'TASK_REWARD'
  taskId?: string
}) {
  if (input.amount <= 0) throw Errors.BadRequest('Amount must be greater than 0')

  const transaction = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const fromWallet = await tx.wallet.findFirst({
      where: { id: input.fromWalletId, familyId: input.familyId },
    })
    if (!fromWallet) throw Errors.NotFound('Source wallet')

    const toWallet = await tx.wallet.findFirst({
      where: { id: input.toWalletId, familyId: input.familyId },
    })
    if (!toWallet) throw Errors.NotFound('Destination wallet')

    const currentBalance = Number(fromWallet.balance)
    if (currentBalance < input.amount) throw Errors.InsufficientFunds()

    await tx.wallet.update({
      where: { id: input.fromWalletId },
      data: { balance: { decrement: input.amount } },
    })

    await tx.wallet.update({
      where: { id: input.toWalletId },
      data: { balance: { increment: input.amount } },
    })

    return tx.transaction.create({
      data: {
        fromWalletId: input.fromWalletId,
        toWalletId: input.toWalletId,
        amount: input.amount,
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

export async function deposit(walletId: string, amount: number, description: string, familyId: string) {
  if (amount <= 0) throw Errors.BadRequest('Amount must be greater than 0')

  const wallet = await prisma.wallet.findFirst({ where: { id: walletId, familyId } })
  if (!wallet) throw Errors.NotFound('Wallet')

  const [, transaction] = await prisma.$transaction([
    prisma.wallet.update({
      where: { id: walletId },
      data: { balance: { increment: amount } },
    }),
    prisma.transaction.create({
      data: {
        toWalletId: walletId,
        amount,
        type: 'DEPOSIT',
        description,
      },
    }),
  ])

  return transaction
}
