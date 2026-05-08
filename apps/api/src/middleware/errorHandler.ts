import type { Request, Response, NextFunction } from 'express'
import { AppError } from '../utils/errors'
import { ZodError } from 'zod'

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message })
  }

  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Validation error',
      details: err.errors.map((e) => ({ field: e.path.join('.'), message: e.message })),
    })
  }

  console.error('[500]', err)
  const message = process.env.NODE_ENV === 'development' && err instanceof Error ? err.message : 'Internal server error'
  return res.status(500).json({ error: message })
}
