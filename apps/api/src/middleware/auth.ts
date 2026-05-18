/**
 * Middleware xác thực và phân quyền cho các route Express.
 * Cung cấp ba lớp bảo vệ: xác thực JWT, kiểm tra vai trò, và kiểm tra tư cách thành viên gia đình.
 */
import type { Request, Response, NextFunction } from 'express'
import { verifyAccessToken } from '../utils/jwt'
import { Errors } from '../utils/errors'
import { prisma } from '../config/database'

/**
 * Mở rộng interface `Request` của Express để thêm thuộc tính `user`.
 * Thuộc tính này được gán bởi middleware `authenticate` sau khi xác thực JWT thành công.
 */
declare global {
  namespace Express {
    interface Request {
      /** Thông tin người dùng đã xác thực, được trích xuất từ JWT payload */
      user: {
        userId: string
        email: string
        role: string
        familyId?: string
        familyMemberId?: string
      }
    }
  }
}

/**
 * Middleware xác thực JWT cho mọi request.
 *
 * Quy trình:
 * 1. Kiểm tra header `Authorization` có dạng `Bearer <token>`.
 * 2. Giải mã và xác minh access token.
 * 3. Gắn thông tin người dùng vào `req.user` để các handler phía sau sử dụng.
 *
 * Trả về lỗi `401 Unauthorized` nếu header thiếu, sai định dạng, hoặc token không hợp lệ.
 *
 * @param req - Đối tượng request của Express
 * @param _res - Đối tượng response (không dùng trong middleware này)
 * @param next - Hàm chuyển tiếp sang middleware hoặc handler tiếp theo
 */
export function authenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization
    // Yêu cầu header có đúng định dạng "Bearer <token>"
    if (!authHeader?.startsWith('Bearer ')) throw Errors.Unauthorized()

    // Tách lấy phần token sau "Bearer "
    const token = authHeader.split(' ')[1]
    const payload = verifyAccessToken(token)
    // Gắn thông tin người dùng vào request để dùng ở các middleware/handler tiếp theo
    req.user = payload
    next()
  } catch {
    next(Errors.Unauthorized())
  }
}

/**
 * Tạo middleware kiểm tra vai trò người dùng (role-based access control).
 * Phải được dùng sau middleware `authenticate`.
 *
 * @param roles - Danh sách các vai trò được phép truy cập route này
 * @returns Middleware Express kiểm tra `req.user.role` có nằm trong danh sách cho phép không
 *
 * @example
 * router.delete('/users/:id', authenticate, requireRole('admin'), deleteUser)
 */
export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(Errors.Unauthorized())
    if (!roles.includes(req.user.role)) return next(Errors.Forbidden())
    next()
  }
}

/**
 * Middleware kiểm tra người dùng đã thuộc về một gia đình hay chưa.
 * Phải được dùng sau middleware `authenticate`.
 *
 * Trả về lỗi `400 Bad Request` nếu `req.user.familyId` không tồn tại.
 *
 * @param req - Đối tượng request của Express
 * @param _res - Đối tượng response (không dùng trong middleware này)
 * @param next - Hàm chuyển tiếp sang middleware hoặc handler tiếp theo
 */
export async function requireFamily(req: Request, _res: Response, next: NextFunction) {
  if (!req.user?.familyId) {
    return next(Errors.BadRequest('You are not part of a family'))
  }
  try {
    const family = await prisma.family.findUnique({
      where: { id: req.user.familyId },
      select: { status: true },
    })
    if (!family) return next(Errors.BadRequest('You are not part of a family'))
    if (req.user.role !== 'SUPER_ADMIN' && family.status !== 'ACTIVE') {
      return next(Errors.Forbidden())
    }
    next()
  } catch (e) {
    next(e)
  }
}
