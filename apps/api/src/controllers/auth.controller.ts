import type { Request, Response, NextFunction } from 'express'
import * as authService from '../services/auth.service'
import { z } from 'zod'

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  displayName: z.string().min(1).max(100),
  familyName: z.string().min(1).max(200),
  role: z.enum(['PARENT', 'CHILD']).optional(),
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const data = registerSchema.parse(req.body)
    const result = await authService.register(data)
    res.status(201).json(result)
  } catch (e) {
    next(e)
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = loginSchema.parse(req.body)
    const result = await authService.login(email, password)
    res.json(result)
  } catch (e) {
    next(e)
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction) {
  try {
    const { refreshToken } = z.object({ refreshToken: z.string() }).parse(req.body)
    const tokens = await authService.refreshTokens(refreshToken)
    res.json(tokens)
  } catch (e) {
    next(e)
  }
}

export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    const { refreshToken } = z.object({ refreshToken: z.string() }).parse(req.body)
    await authService.logout(refreshToken)
    res.json({ message: 'Logged out successfully' })
  } catch (e) {
    next(e)
  }
}

export async function me(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await authService.getMe(req.user.userId)
    res.json(user)
  } catch (e) {
    next(e)
  }
}
