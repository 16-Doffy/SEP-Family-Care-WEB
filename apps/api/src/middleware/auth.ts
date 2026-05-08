import type { Request, Response, NextFunction } from 'express'
import { verifyAccessToken } from '../utils/jwt'
import { Errors } from '../utils/errors'

declare global {
  namespace Express {
    interface Request {
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

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) throw Errors.Unauthorized()

    const token = authHeader.split(' ')[1]
    const payload = verifyAccessToken(token)
    req.user = payload
    next()
  } catch {
    next(Errors.Unauthorized())
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(Errors.Unauthorized())
    if (!roles.includes(req.user.role)) return next(Errors.Forbidden())
    next()
  }
}

export function requireFamily(req: Request, _res: Response, next: NextFunction) {
  if (!req.user?.familyId) {
    return next(Errors.BadRequest('You are not part of a family'))
  }
  next()
}

