/**
 * @module auth.service
 * @description Dịch vụ xác thực người dùng.
 * Xử lý đăng ký, đăng nhập, làm mới token, đăng xuất và lấy thông tin
 * người dùng hiện tại. Mỗi phiên đăng nhập sử dụng cặp access token /
 * refresh token theo chuẩn JWT; refresh token được lưu trong database để
 * có thể thu hồi (rotation strategy).
 */

import * as bcrypt from 'bcryptjs'
import { prisma } from '../config/database'
import type { Prisma } from '@prisma/client'
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt'
import { Errors } from '../utils/errors'
import { validateInviteCode, joinFamily } from './family.service'

/** Dữ liệu đầu vào khi đăng ký tài khoản mới */
interface RegisterInput {
  /** Địa chỉ email (duy nhất trong hệ thống) */
  email: string
  /** Mật khẩu dạng plain-text, sẽ được hash trước khi lưu */
  password: string
  /** Tên hiển thị của người dùng */
  displayName: string
  /**
   * Tên gia đình — bắt buộc khi đăng ký tạo gia đình mới (Flow 2).
   * Không cần cung cấp khi tham gia gia đình có sẵn qua invite code (Flow 1).
   */
  familyName?: string
  /** Vai trò người dùng trong gia đình; mặc định là PARENT khi tạo gia đình mới */
  role?: 'PARENT' | 'CHILD'
  /**
   * Mã mời (invite code) để tham gia gia đình đã tồn tại.
   * Nếu có, hệ thống bỏ qua familyName và dùng Flow 1.
   */
  inviteCode?: string
}

/**
 * Đăng ký tài khoản người dùng mới.
 *
 * Hệ thống hỗ trợ hai luồng đăng ký:
 * - **Flow 1 — Tham gia gia đình qua invite code**: người dùng cung cấp `inviteCode`,
 *   tài khoản sẽ được tạo với vai trò CHILD và được ghép vào gia đình tương ứng.
 * - **Flow 2 — Tạo gia đình mới**: người dùng cung cấp `familyName`, tài khoản được
 *   tạo cùng một gia đình mới, ví chung (JOINT) và ví cá nhân (PERSONAL) trong một
 *   transaction duy nhất.
 *
 * @param input - Dữ liệu đăng ký từ client
 * @returns Cặp access/refresh token và thông tin người dùng (không bao gồm passwordHash)
 * @throws {ConflictError} Khi email đã tồn tại trong hệ thống
 * @throws {BadRequestError} Khi invite code không hợp lệ / hết hạn, hoặc thiếu familyName ở Flow 2
 */
export async function register(input: RegisterInput) {
  // Kiểm tra email trùng lặp trước khi thực hiện bất kỳ thao tác nào khác
  const existing = await prisma.user.findUnique({ where: { email: input.email } })
  if (existing) throw Errors.Conflict('Email already in use')

  // Hash mật khẩu với cost factor 10 (cân bằng giữa bảo mật và hiệu năng)
  const passwordHash = await bcrypt.hash(input.password, 10)

  // --- Flow 1: Đăng ký bằng invite code (tham gia gia đình có sẵn) ---
  if (input.inviteCode) {
    // Xác thực invite code TRƯỚC khi tạo user để fail-fast và tránh tạo user "mồ côi"
    await validateInviteCode(input.inviteCode)

    // Tạo user với role CHILD — invite flow luôn tạo thành viên phụ
    const user = await prisma.user.create({
      data: { email: input.email, passwordHash, displayName: input.displayName, role: 'CHILD' },
    })

    let member
    try {
      // Thực hiện ghép user vào gia đình và đánh dấu invite code đã dùng
      member = await joinFamily(user.id, input.inviteCode)
    } catch (err) {
      // Nếu joinFamily thất bại (vd: gia đình đã đầy), xóa user vừa tạo để
      // tránh để lại tài khoản không thuộc gia đình nào trong database
      await prisma.user.delete({ where: { id: user.id } })
      throw err
    }

    // Lấy lại thông tin đầy đủ của user sau khi đã có familyMember
    const updatedUser = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      include: { familyMember: { include: { family: true } } },
    })

    const tokens = generateTokens(updatedUser.id, updatedUser.email, updatedUser.role, member.familyId, member.id)
    await saveRefreshToken(updatedUser.id, tokens.refreshToken)

    // Loại bỏ passwordHash trước khi trả về client
    const { passwordHash: _, ...safeUser } = updatedUser
    return { ...tokens, user: { ...safeUser, familyMember: updatedUser.familyMember } }
  }

  // --- Flow 2: Đăng ký thông thường (tạo gia đình mới) ---
  if (!input.familyName) throw Errors.BadRequest('Family name is required')

  // Mặc định người tạo gia đình sẽ có vai trò PARENT
  const role = input.role ?? 'PARENT'

  // Dùng transaction để đảm bảo user, family, member và các ví được tạo nguyên tử —
  // nếu bất kỳ bước nào thất bại, toàn bộ sẽ được rollback
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

    // Tạo ví chung cho cả gia đình
    await tx.wallet.create({
      data: { familyId: family.id, name: 'Ví Gia Đình', type: 'JOINT', balance: 0 },
    })

    // Tạo ví cá nhân cho thành viên đầu tiên (người tạo gia đình)
    await tx.wallet.create({
      data: { familyId: family.id, name: `Ví ${input.displayName}`, type: 'PERSONAL', balance: 0, ownerId: member.id },
    })

    return { user, family, member }
  })

  const tokens = generateTokens(result.user.id, result.user.email, result.user.role, result.family.id, result.member.id)
  await saveRefreshToken(result.user.id, tokens.refreshToken)

  // Loại bỏ passwordHash trước khi trả về client
  const { passwordHash: _, ...safeUser } = result.user
  return {
    ...tokens,
    user: { ...safeUser, familyMember: { ...result.member, family: result.family } },
  }
}

/**
 * Đăng nhập bằng email và mật khẩu.
 *
 * Xác thực thông tin đăng nhập, kiểm tra tài khoản còn hoạt động,
 * sau đó phát hành cặp token mới cho phiên làm việc.
 *
 * @param email - Địa chỉ email của người dùng
 * @param password - Mật khẩu plain-text để đối chiếu với hash trong database
 * @returns Cặp access/refresh token và thông tin người dùng (không bao gồm passwordHash)
 * @throws {BadRequestError} Khi email hoặc mật khẩu không đúng
 * @throws {ForbiddenError} Khi tài khoản đã bị vô hiệu hóa (isActive = false)
 */
export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    include: { familyMember: { include: { family: true } } },
  })

  // Dùng thông báo lỗi chung để tránh tiết lộ email nào tồn tại (security best practice)
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw Errors.BadRequest('Invalid email or password')
  }

  // Từ chối đăng nhập nếu tài khoản đã bị khóa bởi admin
  if (!user.isActive) throw Errors.Forbidden()

  const familyId = user.familyMember?.familyId
  const memberId = user.familyMember?.id

  const tokens = generateTokens(user.id, user.email, user.role, familyId, memberId)
  await saveRefreshToken(user.id, tokens.refreshToken)

  // Loại bỏ passwordHash trước khi trả về client
  const { passwordHash: _, ...safeUser } = user
  return { ...tokens, user: safeUser }
}

/**
 * Làm mới cặp access token / refresh token (token rotation).
 *
 * Chiến lược rotation: mỗi lần gọi refresh, refresh token cũ bị xóa và
 * một refresh token mới được cấp. Điều này giới hạn thời gian kẻ tấn công
 * có thể sử dụng token bị đánh cắp.
 *
 * @param oldRefreshToken - Refresh token hiện tại của client
 * @returns Cặp access token và refresh token mới
 * @throws {UnauthorizedError} Khi refresh token không tồn tại, đã hết hạn trong DB,
 *         hoặc chữ ký JWT không hợp lệ
 */
export async function refreshTokens(oldRefreshToken: string) {
  // Kiểm tra sự tồn tại và thời hạn của token trong database trước
  // để phát hiện token đã bị thu hồi (logout) hoặc hết hạn
  const record = await prisma.refreshToken.findUnique({ where: { token: oldRefreshToken } })
  if (!record || record.expiresAt < new Date()) {
    throw Errors.Unauthorized()
  }

  // Xác minh thêm chữ ký JWT — đề phòng token bị giả mạo
  verifyRefreshToken(oldRefreshToken) // throws if invalid/expired

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: record.userId },
    include: { familyMember: true },
  })

  const familyId = user.familyMember?.familyId
  const memberId = user.familyMember?.id

  const tokens = generateTokens(user.id, user.email, user.role, familyId, memberId)

  // Rotation refresh token — dùng deleteMany thay vì delete để tránh lỗi P2025
  // trong trường hợp nhiều request gọi đồng thời (race condition)
  await prisma.$transaction([
    prisma.refreshToken.deleteMany({ where: { token: oldRefreshToken } }),
    prisma.refreshToken.create({
      data: {
        token: tokens.refreshToken,
        userId: user.id,
        // Refresh token có hiệu lực 7 ngày kể từ thời điểm cấp
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    }),
  ])

  return tokens
}

/**
 * Đăng xuất bằng cách thu hồi refresh token.
 *
 * Xóa refresh token khỏi database, khiến client không thể làm mới phiên.
 * Dùng deleteMany để tránh lỗi nếu token đã bị xóa trước đó.
 *
 * @param refreshToken - Refresh token cần thu hồi
 */
export async function logout(refreshToken: string) {
  // deleteMany không ném lỗi nếu token không tồn tại — đảm bảo idempotency
  await prisma.refreshToken.deleteMany({ where: { token: refreshToken } })
}

/**
 * Lấy thông tin người dùng hiện đang đăng nhập.
 *
 * @param userId - ID của người dùng (lấy từ JWT payload)
 * @returns Thông tin người dùng kèm thông tin gia đình, không bao gồm passwordHash
 * @throws {NotFoundError} Khi userId không tồn tại trong database
 */
export async function getMe(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: {
      familyMember: {
        include: { family: true },
      },
    },
  })
  // Loại bỏ passwordHash trước khi trả về client
  const { passwordHash: _, ...safeUser } = user
  return safeUser
}

/**
 * Tạo cặp access token và refresh token cho người dùng.
 *
 * Access token mang đầy đủ thông tin ngữ cảnh (user, role, gia đình) để
 * middleware xác thực có thể đọc mà không cần truy vấn database mỗi request.
 *
 * @param userId - ID người dùng
 * @param email - Email người dùng
 * @param role - Vai trò hệ thống (PARENT / CHILD / SUPER_ADMIN)
 * @param familyId - ID gia đình (có thể undefined nếu chưa thuộc gia đình nào)
 * @param familyMemberId - ID bản ghi FamilyMember (có thể undefined)
 * @returns Object chứa accessToken và refreshToken dạng JWT string
 */
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
    // Refresh token chỉ mang userId để giảm thiểu rủi ro khi bị lộ
    refreshToken: signRefreshToken({ userId }),
  }
}

/**
 * Lưu refresh token mới vào database và dọn dẹp các token đã hết hạn của user.
 *
 * Dọn dẹp token cũ trong cùng transaction để tránh tích lũy bản ghi hết hạn
 * theo thời gian mà không cần scheduled job riêng.
 *
 * @param userId - ID người dùng sở hữu token
 * @param token - Giá trị refresh token cần lưu
 */
async function saveRefreshToken(userId: string, token: string) {
  await prisma.$transaction([
    // Xóa các token đã hết hạn của user này trước khi thêm mới
    prisma.refreshToken.deleteMany({
      where: { userId, expiresAt: { lt: new Date() } },
    }),
    prisma.refreshToken.create({
      data: {
        token,
        userId,
        // Refresh token có hiệu lực 7 ngày kể từ thời điểm cấp
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    }),
  ])
}
