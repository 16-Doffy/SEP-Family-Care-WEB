import * as bcrypt from 'bcryptjs'
import { prisma } from '../config/database'
import type { Prisma } from '@prisma/client'
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt'
import { Errors } from '../utils/errors'
import { validateInviteCode, joinFamily } from './family.service'

interface RegisterInput {
  email: string
  password: string
  displayName: string
  familyName?: string
  role?: 'PARENT' | 'CHILD'
  inviteCode?: string
}

export async function register(input: RegisterInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } })
  if (existing) throw Errors.Conflict('Email already in use')

  const passwordHash = await bcrypt.hash(input.password, 10)

  // --- Flow 1: Register with invite code (join existing family) ---
  if (input.inviteCode) {
    // Validate invite before creating user to fail fast
    validateInviteCode(input.inviteCode)

    const user = await prisma.user.create({
      data: { email: input.email, passwordHash, displayName: input.displayName, role: 'CHILD' },
    })

    let member
    try {
      member = await joinFamily(user.id, input.inviteCode)
    } catch (err) {
      await prisma.user.delete({ where: { id: user.id } })
      throw err
    }

    const updatedUser = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      include: { familyMember: { include: { family: true } } },
    })

    const tokens = generateTokens(updatedUser.id, updatedUser.email, updatedUser.role, member.familyId, member.id)
    await saveRefreshToken(updatedUser.id, tokens.refreshToken)

    const { passwordHash: _, ...safeUser } = updatedUser
    return { ...tokens, user: { ...safeUser, familyMember: updatedUser.familyMember } }
  }

  // --- Flow 2: Normal registration (create new family) ---
  if (!input.familyName) throw Errors.BadRequest('Family name is required')

  const role = input.role ?? 'PARENT'

  const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const user = await tx.user.create({
      data: { email: input.email, passwordHash, displayName: input.displayName, role },
    })

    const family = await tx.family.create({
      data: { name: input.familyName! },
    })

    const member = await tx.familyMember.create({
      data: { userId: user.id, familyId: family.id },
    })

    await tx.wallet.create({
      data: { familyId: family.id, name: 'Ví Gia Đình', type: 'JOINT', balance: 0 },
    })

    await tx.wallet.create({
      data: { familyId: family.id, name: `Ví ${input.displayName}`, type: 'PERSONAL', balance: 0, ownerId: member.id },
    })

    return { user, family, member }
  })

  const tokens = generateTokens(result.user.id, result.user.email, result.user.role, result.family.id, result.member.id)
  await saveRefreshToken(result.user.id, tokens.refreshToken)

  const { passwordHash: _, ...safeUser } = result.user
  return {
    ...tokens,
    user: { ...safeUser, familyMember: { ...result.member, family: result.family } },
  }
}

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    include: { familyMember: { include: { family: true } } },
  })

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw Errors.BadRequest('Invalid email or password')
  }

  if (!user.isActive) throw Errors.Forbidden()

  const familyId = user.familyMember?.familyId
  const memberId = user.familyMember?.id

  const tokens = generateTokens(user.id, user.email, user.role, familyId, memberId)
  await saveRefreshToken(user.id, tokens.refreshToken)

  const { passwordHash: _, ...safeUser } = user
  return { ...tokens, user: safeUser }
}

export async function refreshTokens(oldRefreshToken: string) {
  const record = await prisma.refreshToken.findUnique({ where: { token: oldRefreshToken } })
  if (!record || record.expiresAt < new Date()) {
    throw Errors.Unauthorized()
  }

  verifyRefreshToken(oldRefreshToken) // throws if invalid/expired

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: record.userId },
    include: { familyMember: true },
  })

  const familyId = user.familyMember?.familyId
  const memberId = user.familyMember?.id

  const tokens = generateTokens(user.id, user.email, user.role, familyId, memberId)

  // Rotate refresh token
  await prisma.$transaction([
    prisma.refreshToken.delete({ where: { token: oldRefreshToken } }),
    prisma.refreshToken.create({
      data: {
        token: tokens.refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    }),
  ])

  return tokens
}

export async function logout(refreshToken: string) {
  await prisma.refreshToken.deleteMany({ where: { token: refreshToken } })
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: {
      familyMember: {
        include: { family: true },
      },
    },
  })
  const { passwordHash: _, ...safeUser } = user
  return safeUser
}

function generateTokens(
  userId: string,
  email: string,
  role: string,
  familyId?: string,
  familyMemberId?: string,
) {
  const payload = { userId, email, role, familyId, familyMemberId }
  return {
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken({ userId }),
  }
}

async function saveRefreshToken(userId: string, token: string) {
  await prisma.refreshToken.create({
    data: {
      token,
      userId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  })
}
