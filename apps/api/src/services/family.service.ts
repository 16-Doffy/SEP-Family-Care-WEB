import { prisma } from '../config/database'
import { Errors } from '../utils/errors'
import type { Prisma } from '@prisma/client'
import { randomBytes } from 'crypto'
import { assertCanAddMember } from './plan-limits.service'

export async function getFamily(familyId: string) {
  return prisma.family.findUniqueOrThrow({
    where: { id: familyId },
    include: {
      subscriptionPlan: true,
      members: {
        include: {
          user: {
            select: { id: true, email: true, displayName: true, avatarUrl: true, role: true },
          },
          wallet: { select: { id: true, balance: true } },
        },
        where: { user: { isActive: true } },
      },
      wallets: {
        where: { type: 'JOINT' },
        select: { id: true, name: true, balance: true, currency: true },
      },
    },
  })
}

export async function updateFamily(familyId: string, name: string) {
  return prisma.family.update({ where: { id: familyId }, data: { name } })
}

export async function validateInviteCode(code: string) {
  const invite = await prisma.familyInvite.findUnique({ where: { code } })
  if (!invite) throw Errors.NotFound('Invite code')
  if (invite.usedAt) throw Errors.BadRequest('Invite code already used')
  if (invite.expiresAt.getTime() < Date.now()) {
    throw Errors.BadRequest('Invite code expired')
  }
  return invite
}

export async function generateInviteCode(familyId: string, role: string): Promise<string> {
  const code = randomBytes(16).toString('hex')
  await prisma.familyInvite.create({
    data: {
      familyId,
      code,
      role: role as 'PARENT' | 'CHILD',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  })
  return code
}

export async function joinFamily(userId: string, code: string) {
  const invite = await validateInviteCode(code)

  const existingMember = await prisma.familyMember.findUnique({ where: { userId } })
  if (existingMember) throw Errors.Conflict('You are already in a family')

  await assertCanAddMember(invite.familyId)

  const member = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // Update user role
    await tx.user.update({
      where: { id: userId },
      data: { role: invite.role as 'PARENT' | 'CHILD' },
    })

    const newMember = await tx.familyMember.create({
      data: { userId, familyId: invite.familyId },
    })

    // Create personal wallet
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

    await tx.familyInvite.update({
      where: { code },
      data: { usedAt: new Date() },
    })

    return newMember
  })

  // Auto-join group chats of the family
  try {
    const { addParticipantToGroupChats } = await import('./chat.service')
    await addParticipantToGroupChats(invite.familyId, userId)
  } catch {}

  return member
}

export async function removeMember(familyId: string, targetUserId: string, requesterId: string) {
  if (targetUserId === requesterId) throw Errors.BadRequest('Cannot remove yourself')

  const member = await prisma.familyMember.findFirst({
    where: { userId: targetUserId, familyId },
  })
  if (!member) throw Errors.NotFound('Family member')

  await prisma.user.update({
    where: { id: targetUserId },
    data: { isActive: false },
  })
}
